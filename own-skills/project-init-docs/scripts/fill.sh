#!/usr/bin/env bash
# fill.sh —— 基线产物的「唯一事实源」与确定性填充器。
#
# 它同时承担两件事：
#   1. 定义全部目标文件及其类别（static / repo-fact）—— probe.sh 复用这份清单。
#   2. 对「缺失或为空」的目标确定性写入固定内容（static）或空骨架（repo-fact）。
#      已存在且非空的目标一律跳过，绝不覆盖（守住幂等/不覆盖红线）。
#
# 用法（在仓库根运行）：
#   fill.sh --list [domain...]     列出 目标<TAB>类别（不写盘）
#   fill.sh --auto [domain...]     对所有缺失/为空的目标自动填充
#   fill.sh <target>               只填单个目标（缺失/为空时）
#
# repo-fact 类即便为空也只铺「小节标题 + TODO: 需人工确认」骨架；
# 真实命令/模块/业务规则脚本造不出来，正文仍归 AI 填。
#
# 线框图（字符图）静态骨架默认随基线一起铺（与 adr/、changes/ 同级），不做 UI 判定。
# 页面文件按真实路由用 --pages <页...> 追加。是否保留 docs/wireframes/ 由仓库根
# AGENTS.md 的「线框图」规则决定——无界面的工具/库类项目后续按该规则删除。
# 静态线框图内容存放在 ../assets/wireframes/，由本脚本 cat 过去（不内嵌 heredoc）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../assets/wireframes"

# ---- 目标清单（唯一事实源）-------------------------------------------------

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
  "DEPLOY.md"
  "docs/architecture/module-map.md"
)

# 线框图静态资产（默认随基线一起铺，无门控）
WIREFRAME_STATIC_TARGETS=(
  "docs/wireframes/CLAUDE.md"
  "docs/wireframes/AGENTS.md"
  "docs/wireframes/legend.md"
  "docs/wireframes/_template/page.md"
)

# 线框图 repo-fact（默认铺骨架，正文由 AI 填；flow.md 是项目级页面流转图）
WIREFRAME_REPO_FACT_TARGETS=(
  "docs/wireframes/flow.md"
)

do_list() {
  local t d p arg mode=domains
  local -a domains=() pages=()
  for arg in "$@"; do
    case "$arg" in
      --pages) mode=pages ;;
      *) if [ "$mode" = pages ]; then pages+=("$arg"); else domains+=("$arg"); fi ;;
    esac
  done
  for t in "${STATIC_TARGETS[@]}"; do printf '%s\t%s\n' "$t" static; done
  for t in "${WIREFRAME_STATIC_TARGETS[@]}"; do printf '%s\t%s\n' "$t" static; done
  for t in "${REPO_FACT_TARGETS[@]}"; do printf '%s\t%s\n' "$t" repo-fact; done
  for t in "${WIREFRAME_REPO_FACT_TARGETS[@]}"; do printf '%s\t%s\n' "$t" repo-fact; done
  for d in ${domains[@]+"${domains[@]}"}; do printf '%s\t%s\n' "openspec/specs/$d/spec.md" repo-fact; done
  for p in ${pages[@]+"${pages[@]}"}; do printf '%s\t%s\n' "docs/wireframes/pages/$p.md" repo-fact; done
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

# ---- 单目标填充 -----------------------------------------------------------

fill_one() {
  local target="$1"
  case "$target" in

    "CLAUDE.md")
      write_if_needed "$target" <<'EOF'
See [AGENTS.md](AGENTS.md) for project overview and contribution guidelines.
EOF
      ;;

    "docs/adr/CLAUDE.md" | "openspec/changes/CLAUDE.md")
      write_if_needed "$target" <<'EOF'
See [AGENTS.md](AGENTS.md) for guidelines in this directory.
EOF
      ;;

    "docs/adr/AGENTS.md")
      write_if_needed "$target" <<'EOF'
# 架构决策记录（ADR）

## ADR 规范
- ADR 文件 MUST 命名 `NNNN-title.md`，序号从 0001 递增（0000 为本规范自身）。
- 一条决策一个文件。NEVER 追溯改写已 accepted 的记录；被取代时 MUST 新建一条、并把旧条状态标 superseded。

## 每条 ADR 含
- 背景（context）：当时面对的问题与约束。
- 决策（decision）：最终选择了什么。
- 状态（status）：proposed / accepted / superseded。
- 后果（consequences）：带来的好处与代价。

## 何时写 ADR
做出会影响隐含约束的重要技术/架构选择（依赖方向、数据边界、技术选型等）时 MUST 写一条 ADR。
EOF
      ;;

    "docs/adr/0000-record-architecture-decisions.md")
      write_if_needed "$target" <<'EOF'
# 0000. 采用 ADR 记录架构决策

## 状态
accepted

## 背景
项目需要让后续协作者（含 AI）理解关键架构选择的来龙去脉，避免隐含约束在不知情下被破坏。

## 决策
采用架构决策记录（ADR）。每条决策一个 `docs/adr/NNNN-title.md` 文件，含状态/背景/决策/后果。本文件既是首条决策，也是后续 ADR 的格式样例。

## 后果
- 重要架构选择有可追溯的书面依据。
- 新增决策需付出写一条 ADR 的成本，换来约束可见、可审。
EOF
      ;;

    "openspec/changes/AGENTS.md")
      write_if_needed "$target" <<'EOF'
# 变更工作区（先设计再实现）

## 变更工作流
一次需求或业务变更，MUST 先建一个 `openspec/changes/<change-id>/` 目录、先设计再实现；NEVER 在没有 proposal/design 的情况下直接改实现代码。

## 目录内容
- `proposal.md`：为什么改、改什么、影响面。
- `design.md`：怎么实现、方案与权衡（不含字符图）。
- `tasks.md`：可勾选的任务清单。
- `spec-delta/`：对 `openspec/specs/` 的增删改；先写 delta，实现完成后再合并回 specs。
- `wireframes.md`（可选，本项目扩展）：仅当本次 change 涉及前端路由 / 页面 / 版式变化时新建。画字符图用，基线 MUST 引用 `docs/wireframes/pages/<page>.md`，NEVER 引用其他 change 的 wireframes.md。一个 change 涉及多页用 `## pages/<page>.md` 小节区分；超过 3 页才考虑改目录。后端 / 纯逻辑 change 不要建空文件。

## 推进顺序
MUST 按 proposal → design（+ 必要时 wireframes.md）→ tasks → 实现 → 归档 的顺序推进；spec-delta 与 wireframes.md 都 MUST 在实现完成后、归档时才合并回事实源，NEVER 提前合并。

新建变更 MUST 复制 `_template/` 作为起点。`_template/` 不含 `wireframes.md`——按需新建。

## 归档（change 完成后必做）
MUST 同时完成下面三步，缺一不算归档：

1. **移动 change 目录**：`openspec/changes/<change-id>/` → `openspec/changes/archive/<YYYY-MM-DD>-<change-id>/`（日期为归档日）。
2. **合并 spec-delta → specs**：把 `spec-delta/` 下对应业务域的增删改合并进 `openspec/specs/<domain>/spec.md`，让事实规格反映改完之后的现状。
3. **回流 wireframes.md → docs/wireframes/**（仅当本 change 有 `wireframes.md` 时）：把字符图回填到 `docs/wireframes/pages/<page>.md`；流转变化同步进 `docs/wireframes/flow.md`。这一步与第 2 步同等地位——specs 是行为事实源、`docs/wireframes/` 是版式事实源，都靠归档动作保持现状。

NEVER 把归档动作写进每个 change 的 `tasks.md`——它是项目级流程，由本文件统一定义。
EOF
      ;;

    "openspec/changes/_template/proposal.md")
      write_if_needed "$target" <<'EOF'
# 提案：<change-id>

## 背景
<为什么需要这次变更，当前的问题或缺口>

## 提案
<打算改什么>

## 影响
<受影响的模块、业务域、对外行为>
EOF
      ;;

    "openspec/changes/_template/design.md")
      write_if_needed "$target" <<'EOF'
# 设计：<change-id>

## 方案
<怎么实现>

## 权衡
<选这个方案放弃了什么，其他选项为何不选>

## 风险
<已知风险与回滚思路>
EOF
      ;;

    "openspec/changes/_template/tasks.md")
      write_if_needed "$target" <<'EOF'
# 任务：<change-id>

- [ ] <第一个可执行任务>
EOF
      ;;

    "openspec/changes/_template/spec-delta/.gitkeep")
      write_if_needed "$target" <<'EOF'
# 此处放对 openspec/specs/ 的增删改（spec delta）；实现完成后合并回 specs。
EOF
      ;;

    "AGENTS.md")
      # repo-fact 骨架：修改前/后检查是固定步骤，直接写死；其余标 TODO。
      write_if_needed "$target" <<'EOF'
# <项目名> · AI 项目操作手册

## 项目概览
TODO: 需人工确认

## 项目结构
TODO: 需人工确认

## 常用命令
TODO: 需人工确认

## 编码规范
TODO: 需人工确认

## 修改前检查
- 读 `docs/architecture/module-map.md` 确认依赖边界。
- 读相关 `openspec/specs/<domain>/spec.md`。
- MUST 确认改动 NEVER 引入 module-map 中被禁的依赖方向；若必须破坏，先写一条 ADR 记录再改。

## 修改后检查
- 跑测试 / lint / 构建，三者全绿（退出码 0）方可提交；任一失败 → 先修复，NEVER 带红提交。
- 更新受影响的 spec 与 ADR。
- 必要时在 `openspec/changes/` 记录变更。

## 禁止事项
TODO: 需人工确认

## 线框图
本项目默认生成 `docs/wireframes/`（字符图线框，用于对齐页面信息架构与版式）。它是**版式事实源**，与 `openspec/specs/`（行为事实源）并列，靠 `openspec/changes/` 流转更新——改页面的 change 在 `changes/<id>/wireframes.md` 画字符图，归档时回流到这里。归档约定见 `openspec/changes/AGENTS.md` 的「归档」一节。
是否保留按下面规则判断：
- 若本项目确定为**无界面**的工具 / 库 / CLI / SDK 类（如纯 npm 工具包），删除整个 `docs/wireframes/` 目录，并删除本节。
- 若有界面，按 `docs/wireframes/AGENTS.md` 的约定，为每个真实路由在 `docs/wireframes/pages/` 下补一页。
EOF
      ;;

    "DEPLOY.md")
      # repo-fact 骨架：7 节部署契约；探测到的真实事实由 AI 填正文，探测不到留 TODO。
      write_if_needed "$target" <<'EOF'
# 部署说明

> 面向高级程序员 / 后续 AI：一眼看清「部署到哪、怎么建、怎么发、怎么退、怎么验」。
> 每节内容 MUST 来自真实仓库文件（Dockerfile / compose / CI workflow / 平台配置 / .env.example …）；
> 探测不到的字段一律留 `TODO: 需人工确认`，NEVER 编造。
> 环境变量小节只列名字与用途，NEVER 写入真实值或密钥。

## 部署目标
TODO: 需人工确认

## 环境要求
TODO: 需人工确认

## 环境变量
TODO: 需人工确认

## 构建与部署命令
TODO: 需人工确认

## 部署流程
TODO: 需人工确认

## 回滚
TODO: 需人工确认

## 健康检查
TODO: 需人工确认
EOF
      ;;

    "docs/architecture/module-map.md")
      write_if_needed "$target" <<'EOF'
# 模块地图

> 每个真实模块一节，标题用模块名。脚本只铺骨架，模块内容由分析真实源码后填写。
> 探测到多个模块时，按下面这一节复制扩展。

### <模块名>
- 职责边界：TODO: 需人工确认
- 入口：TODO: 需人工确认
- 上游：TODO: 需人工确认
- 下游：TODO: 需人工确认
- 禁止依赖：TODO: 需人工确认
EOF
      ;;

    "docs/wireframes/CLAUDE.md")
      write_if_needed "$target" < "$ASSETS_DIR/CLAUDE.md"
      ;;

    "docs/wireframes/AGENTS.md")
      write_if_needed "$target" < "$ASSETS_DIR/AGENTS.md"
      ;;

    "docs/wireframes/legend.md")
      write_if_needed "$target" < "$ASSETS_DIR/legend.md"
      ;;

    "docs/wireframes/_template/page.md")
      write_if_needed "$target" < "$ASSETS_DIR/_template/page.md"
      ;;

    "docs/wireframes/flow.md")
      # repo-fact 骨架：流转图说明 + 一个流程示例 + TODO 步骤表，正文由 AI 按真实流程填。
      write_if_needed "$target" < "$ASSETS_DIR/flow.md"
      ;;

    docs/wireframes/pages/*.md)
      # repo-fact 骨架：复制页面模板，仅替换页面名占位符，正文/注释由 AI 填。
      local page body
      page="$(basename "$target" .md)"
      body="$(cat "$ASSETS_DIR/_template/page.md")"
      printf '%s\n' "${body//<页面名>/$page}" | write_if_needed "$target"
      ;;

    openspec/specs/*/spec.md)
      local domain body
      domain="$(basename "$(dirname "$target")")"
      body="$(cat <<'EOF'
# __DOMAIN__ 规格

## 域定位
TODO: 需人工确认

## 业务规则
- TODO: 需人工确认（每条须可验证，如 `MUST 拒绝金额为负的订单并返回 422`）

## 场景
TODO: 需人工确认

## 可验证行为
TODO: 需人工确认
EOF
)"
      printf '%s\n' "${body//__DOMAIN__/$domain}" | write_if_needed "$target"
      ;;

    *)
      printf 'unknown target: %s\n' "$target" >&2
      return 1
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
