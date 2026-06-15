#!/usr/bin/env bash
# probe.sh —— 只读探针：扫描全部基线目标，输出路由表，不写盘。
#
# 目标清单来自 fill.sh --list（唯一事实源），probe 只追加状态判定。
#
# 用法（在仓库根运行）：
#   probe.sh [domain...]
#
# 输出每行三列（TAB 分隔），供按表分流：
#   STATUS   PATH                          CATEGORY
#   MISSING|EMPTY|PRESENT                    static|repo-fact
#
# 分流规则（见 SKILL.md 工作流）：
#   static    + MISSING/EMPTY → fill.sh <path> 直接写死
#   static    + PRESENT       → 幂等流程：读 → 补缺失小节/报差异 → 覆盖前确认
#   repo-fact + MISSING/EMPTY → fill.sh <path> 铺骨架 → AI 填真实事实
#   repo-fact + PRESENT       → AI 读现有 → 只补缺失小节/报差异
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$SCRIPT_DIR/fill.sh" --list "$@" | while IFS=$'\t' read -r path category; do
  if [ ! -e "$path" ]; then
    status=MISSING
  elif [ -z "$(tr -d '[:space:]' < "$path" 2>/dev/null)" ]; then
    status=EMPTY
  else
    status=PRESENT
  fi
  printf '%s\t%s\t%s\n' "$status" "$path" "$category"
done
