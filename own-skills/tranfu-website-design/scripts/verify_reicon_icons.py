#!/usr/bin/env python3
"""Search and verify Reicon component names before generating imports."""

from __future__ import annotations

import argparse
import difflib
import json
from pathlib import Path
import re
import sys
from urllib.error import URLError
from urllib.request import urlopen


OFFICIAL_ICON_INDEX = "https://reicon.dev/llms-icons.txt"

CONCEPT_MAP: dict[str, list[str]] = {
    "home": ["Home", "Grid", "Layout"],
    "首页": ["Home", "Grid", "Layout"],
    "search": ["Search", "GlobalSearch2", "FilterSearch2"],
    "搜索": ["Search", "GlobalSearch2", "FilterSearch2"],
    "filter": ["Filter", "Filters", "DocumentFilter2"],
    "筛选": ["Filter", "Filters", "DocumentFilter2"],
    "settings": ["Settings", "Setting2", "CpuSetting2"],
    "设置": ["Settings", "Setting2", "CpuSetting2"],
    "external link": ["ArrowUpRight2", "Link", "LinkSquare"],
    "外链": ["ArrowUpRight2", "Link", "LinkSquare"],
    "next": ["ArrowRight", "CircleArrowRight", "ArrowRightCircle"],
    "下一步": ["ArrowRight", "CircleArrowRight", "ArrowRightCircle"],
    "download": ["Download", "CloudDownload", "DocumentDownload2"],
    "下载": ["Download", "CloudDownload", "DocumentDownload2"],
    "upload": ["CloudUpload", "Upload", "DocumentUpload2"],
    "上传": ["CloudUpload", "Upload", "DocumentUpload2"],
    "copy": ["Copy", "CopySuccess2", "DocumentCopy2"],
    "复制": ["Copy", "CopySuccess2", "DocumentCopy2"],
    "success": ["CheckCircle", "Check", "ShieldCheck"],
    "成功": ["CheckCircle", "Check", "ShieldCheck"],
    "warning": ["AlertTriangle", "AlertCircle", "ShieldAlert"],
    "警告": ["AlertTriangle", "AlertCircle", "ShieldAlert"],
    "security": ["ShieldCheck", "Shield", "ShieldLock"],
    "安全": ["ShieldCheck", "Shield", "ShieldLock"],
    "permissions": ["Lock", "Key", "ShieldUser"],
    "权限": ["Lock", "Key", "ShieldUser"],
    "code": ["Code", "BrowserCode", "CodeSquare"],
    "代码": ["Code", "BrowserCode", "CodeSquare"],
    "terminal": ["BrowserTerminal", "TerminalSquare", "Command"],
    "终端": ["BrowserTerminal", "TerminalSquare", "Command"],
    "data": ["Database", "Chart", "ChartLine"],
    "数据": ["Database", "Chart", "ChartLine"],
    "analytics": ["ChartLine", "ChartBar", "ChartSquare"],
    "分析": ["ChartLine", "ChartBar", "ChartSquare"],
    "workflow": ["Route", "Nodes", "RouteTrack"],
    "流程": ["Route", "Nodes", "RouteTrack"],
    "agent": ["CpuSetting2", "Nodes", "Sparkles"],
    "智能体": ["CpuSetting2", "Nodes", "Sparkles"],
    "deployment": ["CloudUpload", "CloudCheck", "CloudStorage"],
    "部署": ["CloudUpload", "CloudCheck", "CloudStorage"],
    "install": ["Package", "Download", "Box"],
    "安装": ["Package", "Download", "Box"],
    "plugin": ["Puzzle", "PuzzlePiece", "Box"],
    "插件": ["Puzzle", "PuzzlePiece", "Box"],
    "team": ["Users", "People2", "MessageDots"],
    "团队": ["Users", "People2", "MessageDots"],
    "docs": ["BookOpen", "FileText", "DocumentCode2"],
    "文档": ["BookOpen", "FileText", "DocumentCode2"],
    "calendar": ["CalendarCheck", "Calendar", "Clock"],
    "日历": ["CalendarCheck", "Calendar", "Clock"],
    "launch": ["Rocket", "Play", "Bolt"],
    "启动": ["Rocket", "Play", "Bolt"],
    "target": ["Target", "EyeScan", "Scan2"],
    "目标": ["Target", "EyeScan", "Scan2"],
    "system": ["Layers", "Grid", "Nodes"],
    "系统": ["Layers", "Grid", "Nodes"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search or verify Reicon names against the target package or official index."
    )
    parser.add_argument("query", nargs="*", help="English or Chinese icon concept.")
    parser.add_argument(
        "--exact",
        action="append",
        default=[],
        help="Require an exact PascalCase component name; repeat as needed.",
    )
    parser.add_argument(
        "--project",
        type=Path,
        default=Path.cwd(),
        help="Target project or component path used to locate node_modules.",
    )
    parser.add_argument(
        "--package-dir",
        type=Path,
        help="Explicit reicon-react package root or node_modules directory.",
    )
    parser.add_argument("--limit", type=int, default=12)
    parser.add_argument("--json", action="store_true")
    parser.add_argument(
        "--require-installed",
        action="store_true",
        help="Fail instead of using the official online index when reicon-react is absent.",
    )
    return parser.parse_args()


def normalize(value: str) -> str:
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", value.lower())


def find_package(start: Path, explicit: Path | None) -> Path | None:
    if explicit:
        candidate = explicit.resolve()
        if candidate.name != "reicon-react":
            candidate = candidate / "reicon-react"
        return candidate if (candidate / "icons").is_dir() else None

    start = start.resolve()
    if start.is_file():
        start = start.parent
    for directory in [start, *start.parents]:
        candidate = directory / "node_modules" / "reicon-react"
        if (candidate / "icons").is_dir():
            return candidate
    return None


def load_installed_names(package_dir: Path) -> set[str]:
    names = {path.stem for path in (package_dir / "icons").glob("*.js")}
    if not names:
        names = {path.stem for path in (package_dir / "icons").glob("*.d.ts")}
    if not names:
        raise RuntimeError(f"No Reicon icons found in {package_dir / 'icons'}")
    return names


def load_official_names() -> set[str]:
    try:
        with urlopen(OFFICIAL_ICON_INDEX, timeout=15) as response:
            content = response.read().decode("utf-8")
    except (OSError, URLError) as exc:
        raise RuntimeError(f"Unable to read {OFFICIAL_ICON_INDEX}: {exc}") from exc

    names = {
        match.group(1)
        for line in content.splitlines()
        if (match := re.match(r"^-\s+[^-].*?\s+->\s+([A-Za-z][A-Za-z0-9]*)\s*$", line))
    }
    if not names:
        raise RuntimeError("Official Reicon icon index returned no component names.")
    return names


def package_version(package_dir: Path | None) -> str | None:
    if not package_dir:
        return None
    manifest = package_dir / "package.json"
    try:
        return str(json.loads(manifest.read_text())["version"])
    except (OSError, KeyError, TypeError, ValueError):
        return None


def record(name: str) -> dict[str, object]:
    return {
        "name": name,
        "direct_import": f"import {name} from 'reicon-react/icons/{name}';",
        "named_import": f"import {{ {name} }} from 'reicon-react';",
        "jsx": f'<{name} size={{20}} weight="Outline" />',
        "accessibility": (
            "Decorative: add aria-hidden=\"true\"; icon-only control: label the control."
        ),
    }


def mapped_results(query: str, available: set[str]) -> list[dict[str, object]]:
    normalized_query = normalize(query)
    results: list[dict[str, object]] = []
    seen: set[str] = set()
    for concept, candidates in CONCEPT_MAP.items():
        if normalize(concept) not in normalized_query and normalized_query not in normalize(concept):
            continue
        for name in candidates:
            if name in available and name not in seen:
                seen.add(name)
                results.append({**record(name), "score": 120.0, "matched_concept": concept})
    return results


def fuzzy_results(query: str, available: set[str], limit: int) -> list[dict[str, object]]:
    query_key = normalize(query)
    ranked: list[tuple[float, str]] = []
    for name in available:
        name_key = normalize(name)
        score = difflib.SequenceMatcher(None, query_key, name_key).ratio() * 40
        if query_key and query_key in name_key:
            score += 60
        if score > 10:
            ranked.append((score, name))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [{**record(name), "score": round(score, 2)} for score, name in ranked[:limit]]


def main() -> int:
    args = parse_args()
    package_dir = find_package(args.project, args.package_dir)

    try:
        if package_dir:
            available = load_installed_names(package_dir)
            source = "installed_package"
        elif args.require_installed:
            raise RuntimeError(
                "reicon-react is not installed in the target project; install it before implementation."
            )
        else:
            available = load_official_names()
            source = "official_llms_icons"
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 3

    exact = [record(name) for name in args.exact if name in available]
    missing = [name for name in args.exact if name not in available]

    results: list[dict[str, object]] = []
    if args.query:
        query = " ".join(args.query)
        results = mapped_results(query, available)
        seen = {str(item["name"]) for item in results}
        results.extend(
            item
            for item in fuzzy_results(query, available, max(args.limit, 1))
            if str(item["name"]) not in seen
        )
        results = results[: max(args.limit, 1)]

    output = {
        "source": source,
        "official_index": OFFICIAL_ICON_INDEX,
        "package_dir": str(package_dir) if package_dir else None,
        "package_version": package_version(package_dir),
        "exact": exact,
        "missing": missing,
        "results": results,
    }

    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print(f"Source: {source}")
        if exact:
            print("Verified:")
            for item in exact:
                print(f"- {item['name']}: {item['direct_import']}")
        if missing:
            print("Missing:")
            for name in missing:
                print(f"- {name}")
        if results:
            print("Search results:")
            for item in results:
                print(f"- {item['name']} ({item['score']}): {item['direct_import']}")
    return 2 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
