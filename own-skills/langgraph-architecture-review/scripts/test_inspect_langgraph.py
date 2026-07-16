from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_langgraph import render_markdown, scan_project


SAMPLE = '''
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt

class State(TypedDict):
    query: str
    result: str

async def research(state: State):
    return {"result": await run_research_model(model=MODEL, query=state["query"])}

def approve(state: State):
    accepted = interrupt("Approve?")
    return {"result": str(accepted)}

def route(state: State):
    return "approve" if state["result"] else END

async def run():
    graph = StateGraph(State)
    graph.add_node("research", research)
    graph.add_node("approve", approve)
    graph.add_edge(START, "research")
    graph.add_conditional_edges("research", route, {"approve": "approve", "done": END})
    graph.add_edge("approve", END)
    return await graph.compile().ainvoke({"query": "x", "result": ""})
'''


class InspectLangGraphTest(unittest.TestCase):
    def test_discovers_graph_routes_state_and_signals(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "graph.py").write_text(SAMPLE, encoding="utf-8")
            inventory = scan_project(root)

        self.assertEqual(len(inventory["graphs"]), 1)
        graph = inventory["graphs"][0]
        self.assertIn("inline", graph["compiled_as"])
        self.assertEqual({item["name"] for item in graph["nodes"]}, {"research", "approve"})
        self.assertIn(("research", "END"), {(item["source"], item["target"]) for item in graph["edges"]})
        kinds = {item["name"]: item["kind"] for item in graph["nodes"]}
        self.assertEqual(kinds["research"], "llm")
        self.assertEqual(kinds["approve"], "human_checkpoint")
        self.assertEqual([item["name"] for item in inventory["state_schemas"]], ["State"])
        self.assertTrue(any("checkpointer" in item for item in graph["warnings"]))
        report = render_markdown(inventory)
        self.assertIn("```mermaid", report)
        self.assertIn("graph.py", report)

    def test_reports_no_graph_without_inventing_structure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "plain.py").write_text("def hello():\n    return 'world'\n", encoding="utf-8")
            inventory = scan_project(root)

        self.assertEqual(inventory["graphs"], [])
        self.assertIn("No StateGraph builders were discovered", inventory["warnings"])


if __name__ == "__main__":
    unittest.main()
