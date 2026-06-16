#!/usr/bin/env bash
# fill.sh —— 基线产物的「目标清单」与确定性填充器。
#
# 它承担两件事：
#   1. 定义全部目标文件及其类别（static / repo-fact）—— probe.sh 复用这份清单。
#   2. 对「缺失或为空」的目标，从 ../templates/ 里对应的模板文件拷贝内容写入。
#      已存在且非空的目标一律跳过，绝不覆盖（守住幂等/不覆盖红线）。
#
# 内容的「唯一事实源」是 templates/ 目录：模板树与产物输出路径一一对应，
# 因此 目标路径 → 模板路径 就是 templates/<target>，本脚本只负责拷贝，不内嵌正文。
# 唯一例外是 openspec/specs/<domain>/spec.md：路径含动态域名，用占位模板
# templates/openspec/specs/_domain_/spec.md（含 __DOMAIN__）按域名替换后写入。
#
# 用法（在仓库根运行）：
#   fill.sh --list [domain...]     列出 目标<TAB>类别（不写盘）
#   fill.sh --auto [domain...]     对所有缺失/为空的目标自动填充
#   fill.sh <target>               只填单个目标（缺失/为空时）
#
# repo-fact 类即便为空也只铺「小节标题 + TODO: 需人工确认」骨架；
# 真实命令/模块/业务规则脚本造不出来，正文仍归 AI 填。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../templates" && pwd)"

# ---- 目标清单（清单的唯一事实源）------------------------------------------

STATIC_TARGETS=(
  "CLAUDE.md"
  "docs/adr/CLAUDE.md"
  "docs/adr/AGENTS.md"
  "docs/adr/0000-record-architecture-decisions.md"
  "openspec/changes/CLAUDE.md"
  "openspec/changes/AGENTS.md"
  "openspec/changes/_template/proposal.md"
  "openspec/changes/_template/design.md"
  "openspec/changes/_template/tasks.md"
  "openspec/changes/_template/spec-delta/.gitkeep"
)

REPO_FACT_TARGETS=(
  "AGENTS.md"
  "docs/architecture/module-map.md"
)

do_list() {
  local t d
  for t in "${STATIC_TARGETS[@]}"; do printf '%s\t%s\n' "$t" static; done
  for t in "${REPO_FACT_TARGETS[@]}"; do printf '%s\t%s\n' "$t" repo-fact; done
  for d in "$@"; do printf '%s\t%s\n' "openspec/specs/$d/spec.md" repo-fact; done
}

# ---- 状态判定（与 probe.sh 保持一致）--------------------------------------

status_of() {
  local t="$1"
  if [ ! -e "$t" ]; then
    echo MISSING
  elif [ -z "$(tr -d '[:space:]' < "$t" 2>/dev/null)" ]; then
    echo EMPTY
  else
    echo PRESENT
  fi
}

# 从 stdin 读内容；仅当目标缺失/为空才写入。
write_if_needed() {
  local target="$1" status
  status="$(status_of "$target")"
  if [ "$status" = PRESENT ]; then
    printf 'SKIP   %s (present)\n' "$target"
    cat >/dev/null   # 吞掉 stdin
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  cat > "$target"
  printf 'WROTE  %s (%s)\n' "$target" "$status"
}

# ---- 单目标填充：从 templates/ 拷贝对应模板 -------------------------------

fill_one() {
  local target="$1"
  case "$target" in

    openspec/specs/*/spec.md)
      # 动态路径：域名替换后写入。
      local domain src
      domain="$(basename "$(dirname "$target")")"
      src="$TEMPLATE_DIR/openspec/specs/_domain_/spec.md"
      if [ ! -f "$src" ]; then
        printf 'missing template: %s\n' "$src" >&2
        return 1
      fi
      sed "s/__DOMAIN__/$domain/g" "$src" | write_if_needed "$target"
      ;;

    *)
      # 模板树镜像输出树，直接 templates/<target> 拷贝。
      local src="$TEMPLATE_DIR/$target"
      if [ ! -f "$src" ]; then
        printf 'unknown target (no template at %s): %s\n' "$src" "$target" >&2
        return 1
      fi
      write_if_needed "$target" < "$src"
      ;;
  esac
}

# ---- 入口 -----------------------------------------------------------------

cmd="${1:---list}"
case "$cmd" in
  --list)
    shift || true
    do_list "$@"
    ;;
  --auto)
    shift || true
    do_list "$@" | cut -f1 | while IFS= read -r t; do fill_one "$t"; done
    ;;
  *)
    fill_one "$cmd"
    ;;
esac
