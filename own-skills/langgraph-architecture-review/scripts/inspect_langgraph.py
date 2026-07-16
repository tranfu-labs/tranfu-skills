#!/usr/bin/env python3
"""Statically inventory Python LangGraph builders and render Mermaid diagrams.

The scanner never imports project modules. It intentionally prefers incomplete,
source-grounded output over a complete-looking graph produced by side effects.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SKIP_DIRS = {
    ".git",
    ".hg",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "site-packages",
    "venv",
}
GRAPH_METHODS = {"add_node", "add_edge", "add_conditional_edges", "set_entry_point", "set_finish_point"}
MODEL_METHODS = {
    "ainvoke",
    "astream",
    "generate",
    "generate_structured",
    "invoke",
    "stream",
    "with_structured_output",
}
DB_METHODS = {"add", "commit", "delete", "execute", "flush", "merge", "rollback", "scalar"}


@dataclass
class Location:
    file: str
    line: int


@dataclass
class StateField:
    name: str
    annotation: str
    reducer: str = ""


@dataclass
class StateSchema:
    name: str
    kind: str
    location: Location
    fields: list[StateField] = field(default_factory=list)


@dataclass
class FunctionInfo:
    name: str
    qualified_name: str
    location: Location
    kind: str = "deterministic"
    signals: list[str] = field(default_factory=list)
    command_targets: list[str] = field(default_factory=list)


@dataclass
class NodeInfo:
    name: str
    callable_name: str
    location: Location
    kind: str = "unknown"
    signals: list[str] = field(default_factory=list)


@dataclass
class EdgeInfo:
    source: str
    target: str
    kind: str
    condition: str = ""
    location: Location | None = None


@dataclass
class GraphInfo:
    id: str
    builder: str
    scope: str
    location: Location
    state_schema: str = ""
    compiled_as: list[str] = field(default_factory=list)
    compile_options: dict[str, str] = field(default_factory=dict)
    nodes: list[NodeInfo] = field(default_factory=list)
    edges: list[EdgeInfo] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def source_segment(source: str, node: ast.AST | None) -> str:
    if node is None:
        return ""
    return (ast.get_source_segment(source, node) or "").strip()


def dotted_name(node: ast.AST | None) -> str:
    if node is None:
        return ""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        left = dotted_name(node.value)
        return f"{left}.{node.attr}" if left else node.attr
    if isinstance(node, ast.Call):
        return dotted_name(node.func)
    if isinstance(node, ast.Subscript):
        return dotted_name(node.value)
    return ""


def root_name(node: ast.AST | None) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return root_name(node.value)
    if isinstance(node, ast.Call):
        return root_name(node.func.value) if isinstance(node.func, ast.Attribute) else root_name(node.func)
    return ""


def literal_text(node: ast.AST | None, source: str) -> str:
    if node is None:
        return ""
    if isinstance(node, ast.Constant):
        return str(node.value)
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return dotted_name(node)
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return ", ".join(literal_text(item, source) for item in node.elts)
    return source_segment(source, node)


def extract_literal_values(node: ast.AST | None) -> list[str]:
    if node is None:
        return []
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return [node.value]
    if isinstance(node, (ast.Name, ast.Attribute)):
        value = dotted_name(node)
        return [value] if value else []
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        result: list[str] = []
        for item in node.elts:
            result.extend(extract_literal_values(item))
        return result
    if isinstance(node, ast.Dict):
        result = []
        for value in node.values:
            result.extend(extract_literal_values(value))
        return result
    return []


def annotation_details(node: ast.AST | None, source: str) -> tuple[str, str]:
    text = source_segment(source, node)
    reducer = ""
    if isinstance(node, ast.Subscript) and dotted_name(node.value).endswith("Annotated"):
        slice_node = node.slice
        if isinstance(slice_node, ast.Tuple) and len(slice_node.elts) > 1:
            reducer = source_segment(source, slice_node.elts[1])
    return text, reducer


class FileScanner(ast.NodeVisitor):
    def __init__(self, root: Path, path: Path, source: str) -> None:
        self.root = root
        self.path = path
        self.rel = str(path.relative_to(root))
        self.source = source
        self.scope: list[str] = ["module"]
        self.graphs: dict[tuple[str, str], GraphInfo] = {}
        self.functions: dict[str, FunctionInfo] = {}
        self.state_schemas: list[StateSchema] = []
        self.has_langgraph_signal = "langgraph" in source.lower()

    def location(self, node: ast.AST) -> Location:
        return Location(self.rel, getattr(node, "lineno", 1))

    def scope_name(self) -> str:
        return ".".join(self.scope)

    def graph_key(self, builder: str) -> tuple[str, str]:
        return self.scope_name(), builder

    def _find_graph(self, builder: str) -> GraphInfo | None:
        key = self.graph_key(builder)
        if key in self.graphs:
            return self.graphs[key]
        for scope_index in range(len(self.scope) - 1, 0, -1):
            candidate = (".".join(self.scope[:scope_index]), builder)
            if candidate in self.graphs:
                return self.graphs[candidate]
        return None

    def visit_ClassDef(self, node: ast.ClassDef) -> Any:
        bases = [dotted_name(base) for base in node.bases]
        kind = next((base.split(".")[-1] for base in bases if base.split(".")[-1] in {"TypedDict", "BaseModel", "MessagesState"}), "")
        if kind:
            fields = []
            for item in node.body:
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    annotation, reducer = annotation_details(item.annotation, self.source)
                    fields.append(StateField(item.target.id, annotation, reducer))
            self.state_schemas.append(StateSchema(node.name, kind, self.location(node), fields))
        self.scope.append(node.name)
        self.generic_visit(node)
        self.scope.pop()

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        qualified = f"{self.scope_name()}.{node.name}"
        signals: set[str] = set()
        command_targets: set[str] = set()
        decorators = {dotted_name(item).split(".")[-1] for item in node.decorator_list}
        if "tool" in decorators:
            signals.add("@tool")
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            call_name = dotted_name(child.func)
            method = call_name.split(".")[-1]
            lower = call_name.lower()
            model_argument = any(
                re.search(r"(^|[.\[\"'])((llm)|(model)|(provider))([\]\"']|$)", source_segment(self.source, item), re.I)
                for item in child.args
            ) or any(
                keyword.arg in {"llm", "model", "provider"}
                for keyword in child.keywords
            )
            semantic_model_call = model_argument and any(
                token in lower for token in ("agent", "answer", "generate", "model", "polish", "research", "rewrite", "section")
            )
            if (method in MODEL_METHODS and any(token in lower for token in ("llm", "model", "agent", "provider"))) or semantic_model_call:
                signals.add(f"model:{method}")
            if "toolnode" in lower or method in {"call_tool", "tool_call"}:
                signals.add("tool")
            if method in DB_METHODS and any(token in lower for token in ("db", "session", "repo", "store")):
                signals.add(f"persistence:{method}")
            if any(token in lower for token in ("httpx", "requests", "aiohttp", "urlopen")):
                signals.add("network")
            if method == "interrupt":
                signals.add("interrupt")
            if method == "Send":
                signals.add("Send")
            if method == "Command":
                signals.add("Command")
                for keyword in child.keywords:
                    if keyword.arg == "goto":
                        command_targets.update(extract_literal_values(keyword.value))
        kind = "deterministic"
        if "interrupt" in signals:
            kind = "human_checkpoint"
        elif any(item.startswith("model:") for item in signals):
            kind = "llm"
        elif "tool" in signals or "@tool" in signals:
            kind = "tool"
        elif any(item.startswith("persistence:") for item in signals):
            kind = "persistence"
        elif "network" in signals:
            kind = "side_effect"
        info = FunctionInfo(node.name, qualified, self.location(node), kind, sorted(signals), sorted(command_targets))
        self.functions[qualified] = info
        self.functions.setdefault(node.name, info)
        self.scope.append(node.name)
        self.generic_visit(node)
        self.scope.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> Any:
        self._visit_function(node)

    def visit_Assign(self, node: ast.Assign) -> Any:
        value = node.value
        if isinstance(value, ast.Call) and dotted_name(value.func).split(".")[-1] == "StateGraph":
            state_schema = literal_text(value.args[0], self.source) if value.args else ""
            for target in node.targets:
                if not isinstance(target, ast.Name):
                    continue
                graph_id = f"{self.rel}:{self.scope_name()}:{target.id}"
                self.graphs[self.graph_key(target.id)] = GraphInfo(
                    id=graph_id,
                    builder=target.id,
                    scope=self.scope_name(),
                    location=self.location(node),
                    state_schema=state_schema,
                )
        if isinstance(value, ast.Call) and isinstance(value.func, ast.Attribute) and value.func.attr == "compile":
            builder = root_name(value.func.value)
            graph = self._find_graph(builder)
            if graph:
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id not in graph.compiled_as:
                        graph.compiled_as.append(target.id)
                for keyword in value.keywords:
                    if keyword.arg:
                        graph.compile_options[keyword.arg] = literal_text(keyword.value, self.source)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> Any:
        if node.value is not None:
            fake = ast.Assign(targets=[node.target], value=node.value)
            ast.copy_location(fake, node)
            self.visit_Assign(fake)
        else:
            self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> Any:
        if not isinstance(node.func, ast.Attribute):
            self.generic_visit(node)
            return
        builder = root_name(node.func.value)
        graph = self._find_graph(builder)
        if node.func.attr == "compile" and graph is not None:
            if "inline" not in graph.compiled_as:
                graph.compiled_as.append("inline")
            for keyword in node.keywords:
                if keyword.arg:
                    graph.compile_options[keyword.arg] = literal_text(keyword.value, self.source)
            self.generic_visit(node)
            return
        if node.func.attr not in GRAPH_METHODS:
            self.generic_visit(node)
            return
        if graph is None:
            self.generic_visit(node)
            return
        method = node.func.attr
        if method == "add_node" and node.args:
            if len(node.args) >= 2:
                node_name = literal_text(node.args[0], self.source)
                callable_name = dotted_name(node.args[1]) or source_segment(self.source, node.args[1])
            else:
                callable_name = dotted_name(node.args[0]) or source_segment(self.source, node.args[0])
                node_name = callable_name.split(".")[-1]
            if not any(item.name == node_name for item in graph.nodes):
                graph.nodes.append(NodeInfo(node_name, callable_name, self.location(node)))
        elif method == "add_edge" and len(node.args) >= 2:
            edge = EdgeInfo(
                literal_text(node.args[0], self.source),
                literal_text(node.args[1], self.source),
                "static",
                location=self.location(node),
            )
            if not any((item.source, item.target, item.kind) == (edge.source, edge.target, edge.kind) for item in graph.edges):
                graph.edges.append(edge)
        elif method == "add_conditional_edges" and len(node.args) >= 2:
            source = literal_text(node.args[0], self.source)
            router = dotted_name(node.args[1]) or source_segment(self.source, node.args[1])
            targets: list[str] = []
            if len(node.args) >= 3:
                targets = extract_literal_values(node.args[2])
            for keyword in node.keywords:
                if keyword.arg in {"path_map", "pathMap"}:
                    targets.extend(extract_literal_values(keyword.value))
            if targets:
                for target in dict.fromkeys(targets):
                    graph.edges.append(EdgeInfo(source, target, "conditional", router, self.location(node)))
            else:
                graph.edges.append(EdgeInfo(source, "<dynamic>", "conditional", router, self.location(node)))
                graph.warnings.append(f"Conditional targets for {source} are dynamic and require manual verification")
        elif method == "set_entry_point" and node.args:
            graph.edges.append(EdgeInfo("START", literal_text(node.args[0], self.source), "static", location=self.location(node)))
        elif method == "set_finish_point" and node.args:
            graph.edges.append(EdgeInfo(literal_text(node.args[0], self.source), "END", "static", location=self.location(node)))
        self.generic_visit(node)

    def finalize(self) -> None:
        for graph in self.graphs.values():
            static_sources = {edge.source for edge in graph.edges if edge.kind == "static"}
            for node in graph.nodes:
                function = self.functions.get(node.callable_name) or self.functions.get(node.callable_name.split(".")[-1])
                if function:
                    node.kind = function.kind
                    node.signals = function.signals
                    for target in function.command_targets:
                        graph.edges.append(EdgeInfo(node.name, target, "command", "Command.goto", function.location))
                    if function.command_targets and node.name in static_sources:
                        graph.warnings.append(
                            f"Node {node.name} uses Command.goto and also has a static outgoing edge; verify both should execute"
                        )
            if not graph.compiled_as:
                graph.warnings.append("Builder compile assignment was not discovered")
            interrupt_nodes = [node.name for node in graph.nodes if node.kind == "human_checkpoint"]
            if interrupt_nodes and not any("checkpointer" in key for key in graph.compile_options):
                graph.warnings.append(
                    f"Interrupt nodes {', '.join(interrupt_nodes)} were found without an explicit compile(checkpointer=...) option"
                )
            node_names = {node.name for node in graph.nodes}
            for edge in graph.edges:
                for endpoint in (edge.source, edge.target):
                    if endpoint not in node_names | {"START", "END", "__start__", "__end__", "<dynamic>"}:
                        graph.warnings.append(f"Edge endpoint {endpoint} is not a discovered node; verify dynamic or aliased construction")
            graph.warnings = list(dict.fromkeys(graph.warnings))


def scan_project(root: Path) -> dict[str, Any]:
    scanners: list[FileScanner] = []
    all_schemas: list[StateSchema] = []
    parse_errors: list[str] = []
    files_scanned = 0
    langgraph_files = 0
    for path in sorted(root.rglob("*.py")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        files_scanned += 1
        try:
            source = path.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(path))
        except (OSError, UnicodeDecodeError, SyntaxError) as exc:
            parse_errors.append(f"{path.relative_to(root)}: {exc}")
            continue
        scanner = FileScanner(root, path, source)
        scanner.visit(tree)
        scanner.finalize()
        all_schemas.extend(scanner.state_schemas)
        if scanner.has_langgraph_signal or scanner.graphs:
            langgraph_files += 1
            scanners.append(scanner)

    graphs = [graph for scanner in scanners for graph in scanner.graphs.values()]
    referenced_schema_names = {
        graph.state_schema.split(".")[-1].split("[")[0].strip()
        for graph in graphs
        if graph.state_schema
    }
    schemas = [schema for schema in all_schemas if schema.name in referenced_schema_names]
    warnings = [warning for graph in graphs for warning in graph.warnings]
    if not graphs:
        warnings.append("No StateGraph builders were discovered")
    return {
        "schema_version": "langgraph_architecture_inventory_v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "files_scanned": files_scanned,
        "langgraph_files": langgraph_files,
        "graphs": [asdict(item) for item in graphs],
        "state_schemas": [asdict(item) for item in schemas],
        "parse_errors": parse_errors,
        "warnings": list(dict.fromkeys(warnings)),
    }


def mermaid_id(graph_id: str, name: str) -> str:
    digest = hashlib.sha1(f"{graph_id}:{name}".encode()).hexdigest()[:8]
    return f"n_{digest}"


def escape_label(value: str) -> str:
    return value.replace('"', "'").replace("\n", " ")


def render_mermaid(graph: dict[str, Any]) -> str:
    names = {node["name"] for node in graph["nodes"]}
    names.update(edge[endpoint] for edge in graph["edges"] for endpoint in ("source", "target"))
    names.discard("<dynamic>")
    lines = ["flowchart TD"]
    for name in sorted(names):
        identifier = mermaid_id(graph["id"], name)
        if name in {"START", "__start__"}:
            lines.append(f'  {identifier}(["START"])')
        elif name in {"END", "__end__"}:
            lines.append(f'  {identifier}(["END"])')
        else:
            node = next((item for item in graph["nodes"] if item["name"] == name), None)
            suffix = f"\\n{node['kind']}" if node else ""
            lines.append(f'  {identifier}["{escape_label(name)}{suffix}"]')
    for edge in graph["edges"]:
        if edge["target"] == "<dynamic>":
            continue
        source = mermaid_id(graph["id"], edge["source"])
        target = mermaid_id(graph["id"], edge["target"])
        condition = escape_label(edge.get("condition", ""))
        if edge["kind"] == "static":
            lines.append(f"  {source} --> {target}")
        else:
            label = condition or edge["kind"]
            lines.append(f'  {source} -. "{label}" .-> {target}')
    if len(lines) == 1:
        lines.append('  empty["No static graph structure discovered"]')
    return "\n".join(lines)


def location_text(location: dict[str, Any] | None) -> str:
    if not location:
        return ""
    return f"{location['file']}:{location['line']}"


def render_markdown(inventory: dict[str, Any]) -> str:
    lines = [
        "# LangGraph Architecture Inventory",
        "",
        f"Generated: `{inventory['generated_at']}`",
        f"Project root: `{inventory['root']}`",
        "",
        "## Discovery Summary",
        "",
        f"- Python files scanned: {inventory['files_scanned']}",
        f"- Files with LangGraph signals: {inventory['langgraph_files']}",
        f"- StateGraph builders discovered: {len(inventory['graphs'])}",
        f"- State schemas discovered: {len(inventory['state_schemas'])}",
        "",
        "## Graph Registry",
        "",
        "| Graph | Builder | Scope | State | Compiled as | Evidence |",
        "|---|---|---|---|---|---|",
    ]
    for graph in inventory["graphs"]:
        lines.append(
            f"| `{graph['id']}` | `{graph['builder']}` | `{graph['scope']}` | "
            f"`{graph['state_schema'] or 'unknown'}` | `{', '.join(graph['compiled_as']) or 'not discovered'}` | "
            f"`{location_text(graph['location'])}` |"
        )
    if not inventory["graphs"]:
        lines.append("| none | - | - | - | - | No StateGraph builders were discovered |")

    for index, graph in enumerate(inventory["graphs"], start=1):
        lines.extend(
            [
                "",
                f"## Graph {index}: `{graph['id']}`",
                "",
                "```mermaid",
                render_mermaid(graph),
                "```",
                "",
                "### Nodes",
                "",
                "| Node | Callable | Type | Signals | Evidence |",
                "|---|---|---|---|---|",
            ]
        )
        for node in graph["nodes"]:
            lines.append(
                f"| `{node['name']}` | `{node['callable_name']}` | `{node['kind']}` | "
                f"{', '.join(node['signals']) or '-'} | `{location_text(node['location'])}` |"
            )
        if not graph["nodes"]:
            lines.append("| none | - | - | - | - |")
        lines.extend(["", "### Edges", "", "| Source | Target | Type | Condition | Evidence |", "|---|---|---|---|---|"])
        for edge in graph["edges"]:
            lines.append(
                f"| `{edge['source']}` | `{edge['target']}` | `{edge['kind']}` | "
                f"`{edge['condition'] or '-'}` | `{location_text(edge.get('location'))}` |"
            )
        if not graph["edges"]:
            lines.append("| none | - | - | - | - |")
        lines.extend(["", "### Compile And Persistence", ""])
        if graph["compile_options"]:
            for key, value in graph["compile_options"].items():
                lines.append(f"- `{key}`: `{value}`")
        else:
            lines.append("- No explicit compile options discovered.")
        if graph["warnings"]:
            lines.extend(["", "### Graph Warnings", ""])
            lines.extend(f"- {item}" for item in graph["warnings"])

    lines.extend(["", "## State Schemas", "", "| Schema | Kind | Fields | Evidence |", "|---|---|---|---|"])
    for schema in inventory["state_schemas"]:
        fields = "; ".join(
            f"{item['name']}: {item['annotation']}" + (f" [reducer={item['reducer']}]" if item["reducer"] else "")
            for item in schema["fields"]
        )
        lines.append(f"| `{schema['name']}` | `{schema['kind']}` | {fields or '-'} | `{location_text(schema['location'])}` |")
    if not inventory["state_schemas"]:
        lines.append("| none | - | - | - |")

    lines.extend(["", "## Architecture Warnings", ""])
    if inventory["warnings"]:
        lines.extend(f"- {item}" for item in inventory["warnings"])
    else:
        lines.append("- No static warnings.")
    if inventory["parse_errors"]:
        lines.extend(["", "## Parse Errors", ""])
        lines.extend(f"- {item}" for item in inventory["parse_errors"])
    lines.extend(
        [
            "",
            "## Static Analysis Limits",
            "",
            "- Project modules were not imported, so runtime-generated nodes and edges may be absent.",
            "- Conditional destinations inferred dynamically require manual or compiled-graph verification.",
            "- Node classifications are source-signal heuristics and must be checked against the callable body.",
            "- This inventory is evidence for a review, not the final architecture judgment.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", type=Path)
    parser.add_argument("--output", type=Path, help="Write Markdown inventory to this path")
    parser.add_argument("--json", type=Path, help="Write structured JSON inventory to this path")
    parser.add_argument("--strict", action="store_true", help="Fail if no StateGraph builder is discovered")
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: project root is not a directory: {root}", file=sys.stderr)
        return 2
    inventory = scan_project(root)
    markdown = render_markdown(inventory)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(markdown, encoding="utf-8")
    else:
        print(markdown)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.strict and not inventory["graphs"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
