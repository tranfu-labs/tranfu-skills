#!/usr/bin/env python3
"""Validate the minimum structure of a LangGraph architecture inventory."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


REQUIRED_MARKERS = (
    "# LangGraph Architecture Inventory",
    "## Discovery Summary",
    "## Graph Registry",
    "## Architecture Warnings",
    "```mermaid",
)


def validate(path: Path) -> list[str]:
    if not path.is_file():
        return [f"report not found: {path}"]
    text = path.read_text(encoding="utf-8")
    errors = [f"missing required marker: {marker}" for marker in REQUIRED_MARKERS if marker not in text]
    if "[TODO" in text or "<TODO" in text:
        errors.append("report contains unresolved TODO placeholders")
    if text.count("```") % 2:
        errors.append("report contains an unclosed code fence")
    if "No StateGraph builders were discovered" in text:
        errors.append("no StateGraph builders were discovered")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    errors = validate(args.report)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"OK: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
