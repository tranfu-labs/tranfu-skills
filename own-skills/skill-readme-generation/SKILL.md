---
name: skill-readme-generation
name_zh: Skill README 生成
display_name: Skill README Generation
display_name_zh: Skill README 生成
description: >
  给一个已有 skill 目录 (含 SKILL.md) 生成一份符合 tranfu-skills README 规范的中文 `README.md`, 供公司自建官网的 skill 详情页解析与展示。产出 = frontmatter (唯一字段 `prompt_examples`) + 四段正文 (elevator pitch / 什么时候用它 / 它会产出什么 / 前置条件与边界), 总长 30-80 行。触发于: "给这个 skill 加个 README / 给 own-skills/xxx 补一份 README / 按 tranfu 规范生成 skill 的 README / 生成 skill README / skill readme generation / 把 SKILL.md 派生一份人可读说明 / 给 skill 加个说明文档 / 跟 skill-name-generation 一样给这个 skill 也做一份 README / 把 own-skills/ 下所有还没 README 的 skill 都补齐"。也覆盖存量批量补齐场景。Do NOT trigger when: 改现有 README 的某一段 (那是普通编辑) / 从零建 SKILL.md 或整个 skill (那是 `skill-create-workflow`) / 给 skill 起 display_name 或 slug (那是 `skill-name-generation` / `skill-domain-framing`) / 判断某段内容是否适合做成 skill (那是 `skill-content-fit`) / 给非 skill 的普通项目写 README 或项目文档 / CI 校验现有 README frontmatter 是否合规 (那是脚本的活)。产出物仅落盘到目标 skill 目录内的 `README.md`, 绝不改动它的 `SKILL.md` 或其他任何仓库文件。
version: 0.1.0
author: aquarius-wing
updated_at: 2026-07-12
origin: own
userInvocable: true
---

# Skill README 生成

## 目的

给一个已有 skill 的 `SKILL.md` 派生一份**面向人类读者**的中文 `README.md`。`SKILL.md` 的 description 是给 Claude / Codex 做触发判断用的机器可读长句, 密度高但读起来累; 而公司自建官网的 skill 详情页需要一份**读起来像产品说明**的短文——本 skill 就是把前者转成后者。

一次调用产出一份完整 README, 包含 frontmatter (只含 `prompt_examples`, 供官网独立组件解析) + 四段正文, 总长 30-80 行。**NEVER 只出 frontmatter 或只出正文**——两者都是官网详情页的组成部分。

## Ownership

MUST 只处理**已有 skill 目录 (含 SKILL.md) 的 README 生成**——生成一份新的、完整的 README。MUST NOT 承接: 修改现有 README 的某一段 (普通编辑就够)、从零建 SKILL.md 或整个 skill (那是 `skill-create-workflow`)、给 skill 起 display_name / slug (那是 `skill-name-generation` / `skill-domain-framing`)、判断某段内容是否值得做成 skill (那是 `skill-content-fit`)、给非 skill 的项目写 README、给 CI 校验现有 README frontmatter 合规性。

本 skill 只落盘一个文件——目标 skill 目录内的 `README.md`。NEVER 改动 `SKILL.md`, NEVER 改动 `agents/openai.yaml`, NEVER 改动仓库其他文件——写不写 README、写到哪里, 由用户主动请求本 skill 才发生。

## 与相邻 skill 的分工

- `skill-name-generation`: 给已有 skill 起 `display_name` / `display_name_zh`。本 skill 假设显示名已定 (在 SKILL.md frontmatter 里), 只做 README。若目标 skill 没有显示名, 本 skill 照常生成 README, 不阻塞——但在完成汇报里提醒用户可路由到 `skill-name-generation`。
- `skill-domain-framing`: 决定 skill 的 slug (kebab-case 容器名)。属于 skill 生成流程的更早阶段, 与本 skill 无直接调用。
- `skill-create-workflow`: 创建一个全新的 skill (含 SKILL.md 骨架)。本 skill 在其之后启动——skill 骨架已在, 才生成 README。
- `skill-content-fit`: 判断某段素材是否值得沉淀成 skill。是本 skill 的上游判断, 通过之后才走到"创建 skill → 起显示名 → 生成 README"这条链。
- `skill-improve-workflow`: 对已有 skill 做整体质量审查与修复。若目标 skill 的 SKILL.md 太简陋、连触发场景都提炼不出四段内容 → 本 skill 进入失败路径 F2, 建议用户先路由 `skill-improve-workflow` 把 SKILL.md 补齐, 再回来生成 README。

## 主流程

CREATE A TODO LIST FOR THE TASKS BELOW. Keep the list internal unless the user asks to see process.

1. **读输入**。用户 MUST 指定一个 skill 目录路径 (含 `SKILL.md`)。缺失或路径不指向 skill 目录 → 失败路径 F1。批量输入时对每个目录重复整套流程。
2. **越界判定**。若用户实际在要: (a) 改现有 README 某段 → 请他用普通编辑指令; (b) 建新 skill / 写 SKILL.md → 路由 `skill-create-workflow`; (c) 起显示名 → 路由 `skill-name-generation`; (d) 判断内容是否够格做 skill → 路由 `skill-content-fit`。停下, NEVER 硬生成 README。
3. **读目标 `SKILL.md`**。frontmatter (取 `name` / `display_name` / `display_name_zh` / `description` / `origin` / `userInvocable`) 与正文 (取"目的 / Ownership / 主流程 / 触发场景 / 失败路径 / Examples") 都要读。
4. **判 skill 类型**。看 description 里的首个能力动词 + 主流程结构:
   - **写码闭环型**: 首个动词是"编排 / 跑一遍 / 闭环 / 实施", 主流程含分支切换 / 落盘 / commit / PR (例: `openspec-driven-development`)。
   - **内容审查型**: 首个动词是"审 / 诊断 / 判"; 输入是一段文本 / 一个路径 (例: `credibility-review` / `prompt-review`)。
   - **视觉设计型**: 主职是出图 / 出稿 / 出配色 (例: `fireworks-tech-graph` / `ui-ux-pro-max`)。
   - **meta 型**: 作用于其他 skill / 其他 prompt (例: 本 skill、`skill-name-generation`、`skill-create-workflow`)。
   - **普通生成型**: 主职是"生成 X 内容", X 是文本 / 配图 / 命名 / 标题等 (例: `product-title-generation`)。
   - 判不出 → 失败路径 F4。
5. **按类型选进场点覆盖模式**, 定 `prompt_examples` 的 5-6 条:
   - 写码闭环型 → 正面写码 / bug 讨论 / 咨询讨论 / 显式实施 / 方案复核 / 停顿指定。
   - 内容审查型 → 粘草稿 / 指定路径 / 中英文体裁 / 特定风格担忧 / 批量审。
   - 视觉设计型 → 风格描述 / 参考图 / 品牌语汇 / 目标场景 / 尺寸约束。
   - meta 型 → 新想法首次沉淀 / 已有素材补 skill / 存量批量补齐 / 单条 vs 批量 / 显式指名。
   - 普通生成型 → 场景描述 / 关键词组 / 品类 / 参照对象 / 数量或格式指定。
6. **提炼四段正文**:
   - **elevator pitch** (≤ 60 字): 从 description 的主职动词 + 独有价值凝一句。
   - **什么时候用它**: 从 description 里的"触发于"话术改写成 3-5 段第一人称场景 ("我在做 X, 遇到 Y, 想让 skill 帮我 Z"), 末尾段显式画负向边界 ("不是给 A, 那是 X-skill; 不是给 B, 那是 Y-skill")。
   - **它会产出什么 / 你会看到什么**: 段落式说明主要产出 (落盘的文件 / 终端报告 / PR 等) + 显式点名副作用 (会不会动 git / 改文件 / 发外部通知 / 调 API) + 单独强调反常识点 (例: "默认先出方案、明确说开始写才动代码")。
   - **前置条件 / 边界**: 前置条件 (要什么工具 / 什么目录结构 / 什么权限) + 相邻 skill 分工一句话每条 + 不接的场景 + 微妙边界区分 (如果有)。
7. **派生 `prompt_examples`**。5-6 条自然口语, 每条一个 `prompt` (15-50 字, 可以直接粘给 Claude / Codex 的那句话) + 一个 `scene` (≤ 12 字, 一行短标签)。**MUST 覆盖至少 4 种不同进场点** (按第 5 步的模式), NEVER 只是同一进场点的近义词轮换。
8. **组装 README.md**, 逐条套 §硬约束校验: 标点全角 / 无假英文单词 / 无"怎么调用"段 / 无 hero 图 (除非目标目录已有 `workflow.svg`) / 正文 30-80 行 / frontmatter 20-30 行。校验不通过就回步骤 6 重写对应段落。
9. **术语脱敏, 人话过一遍**——用第 12 条硬约束逐段扫: skill 圈行话 (`slug` / `轴` / `进场点` / `触发对齐` / `解释感` / `hero` / `trajectory` / `catalog` / `frontmatter` 等) 替换成普通中文; 中英夹杂只保留通用专有名词 / 命令 / 文件名 / 路径 / 状态标识符; 直译英文的中式表达 ("XX 感" / "拿 X 当 Y") 改成地道中文。判断法: 逐句读出来, 圈外朋友听不懂 → 重写。发现违规 → 回步骤 6 重写对应段落。
10. **落盘**。目标路径 = `<skill 目录>/README.md`。若目标已有 `README.md` 且用户没明说要重生成 → 失败路径 F3。
11. **向用户汇报** (按 §输出格式)。

## README 骨架规范

这是**产出物的规范**——本 skill 每次调用生成的 README 必须严格符合下面这份规范。

### Frontmatter shape (唯一字段: `prompt_examples`)

```yaml
---
prompt_examples:
  - prompt: <一句可以直接粘给 Claude / Codex 的中文自然语言, 15-50 字>
    scene: <一行短标签, ≤ 12 字, 可选但强烈建议填>
  - prompt: ...
    scene: ...
---
```

- `prompt` MUST 是字符串, 必填。是"用户对 Claude / Codex 说的那句话", NEVER 是关键词堆叠。
- `scene` 是字符串, 可选但强烈建议填。给官网做场景切换 tab / 分组标签。
- MUST 5-6 条, 覆盖至少 4 种不同进场点 (按 §主流程 第 5 步的类型模式)。

### 正文四段 (严格顺序, 总长 30-80 行)

**结构化优先**——长段散文难扫。除 elevator pitch 与场景开头 1-3 句代入叙事外, 一律用**粗体行首标签 / bullet 列表 / mini 表格 (≤ 4 行) / 行内对照** (「问 A → 触发; 问 B → 不触发」) 呈现。

```markdown
# <slug 或 display_name_zh>

<一句 elevator pitch, ≤ 60 字, 回答「它到底解决什么问题 / 产出什么」>

## 什么时候用它

3-5 段第一人称场景, 每段格式 = **粗体行首标签** (≤ 6 字, 例: **正面写码 / 咨询开场 / 显式实施 / 快车道 / 停顿指定**) 独立一行 + 空行 + 1-3 句叙事段落——key 与 value 换行分开, 让眼睛能扫锚点。段末用独立 **不接** 段 (同样 key 换行 + 空行 + value) 收拢负向边界。

## 它会产出什么 / 你会看到什么

反常识点先用**独立粗体一句**强调 (例: "**默认先出方案, 明确说「开始写代码」才动代码**")。副作用清单 MUST 用 bullet, 每条 `**动作名**: 具体说明`。清单末尾用 `- **绝不会做**: <点名>` 收口。

## 前置条件 / 边界

节奏: 每小节独立一段——**粗体行首标签** + 空行 + 内容 (散文 / bullet / 表格), 不用最外层 bullet 结构。

**前置**: 工具 / 目录 / 权限, 一句散文或短 bullet。

**相邻 skill 分工**: 3+ 行且 skill 名端短 → mini 表格 `| 动作 | 交给 |`; 少于 3 行 → 嵌套 bullet, 格式 `<动作> → **<skill 名>**`。

**不接的场景**: bullet 列表。

**微妙边界**: bullet 列表 (行内对照或短 bullet, 视密度)。
```

## 硬约束

本 skill 生成 README 时必须逐条遵守下面 8 条硬约束——校验不过就返工重写, NEVER 出违规产物。

1. **全中文散文**。禁止在正文里出现 `census` / `loud` / `quiet` 这类明显不是英文专有名词的英文单词。
2. **散文里的强调副词一律中文**。`NEVER` → 绝不; `ALWAYS` → 一定 / 始终; `MUST` → 必须。
3. **可保留的英文只有以下几类**: 文件名 (`AGENTS.md`)、命令名 (`git push -u`)、字段名与变量名 (`origin/main`)、状态标识符 (`plan-written`)、专有名词 (`openspec` / `PR` / `commit` / `GitHub` / `MCP` 等)。
4. **标点全角**: `, 。 : —— 「 」 ? !`。半角只在 YAML 语法字符 (`:` `-`) 和 code block 内保留。
5. **NEVER 写"怎么调用"段**, NEVER 放 ```text 示例提示词代码块——示例提示词只在 frontmatter 的 `prompt_examples` 里存在一份, 正文不重复。
6. **长度**: 正文 30-80 行, frontmatter 视 `prompt_examples` 条数通常 20-30 行, 总长 50-110 行左右。
7. **NEVER 加 hero SVG 图**, 除非目标 skill 目录里已经有 `workflow.svg` 之类的图 (`credibility-review/workflow.svg` 就是特例, 那才允许 `![...](./workflow.svg)`)。
8. **NEVER 抄 SKILL.md 的 description 长句**——那句话是给机器读的, README 用人话改写。若发现产出段落像 description 直译, 回步骤 6 重写。
9. **结构化优先, 密度可扫**——除 elevator pitch 与场景开头 1-3 句代入叙事外, 长段散文一律用 bullet 列表 / 粗体行首标签 / mini 表格 (≤ 4 行) / 行内对照 替代。目视扫读密度: 每 30 行至少 3 处 bullet 段或粗体行首标签集合。产出全是密集散文 → 违规, 回步骤 6 重写。
10. **表格 vs bullet 分水岭**——value ≤ 15 字 + 3+ 行 + 结构对齐 → 优先 mini 表格 (独立成段, 不嵌在 bullet 里); value 更长 (含反引号命令 / 分号分隔多动作 / 破折号补充说明) → 用 bullet。避免"表格看起来更专业"就硬塞——单元格挤爆比 bullet 还难扫。
11. **简版例外, 别灌水**——简单 skill 副作用少于 3 条时允许"1 句反常识粗体 + 1-2 条 bullet + 1 条绝不会做"三行简版; 相邻 skill 分工不存在时该段落可以整段塌掉, 别造假分工凑数。产出物长度可以短到 30 行下限, 但每 30 行仍要满足密度 (第 9 条)——密度看的是"有几个锚点", 简版靠"少而准"达标。
12. **人话优先, 术语脱敏**——README 的读者是**不熟悉 skill 内部行话的普通用户** (公司官网的浏览者), 不是 skill 作者本人。落盘前 MUST 过一遍"术语脱敏":
    - **skill 圈行话 → 普通中文**: `slug` → 英文名 / 目录名; `轴` → 维度 / 方向; `进场点` → 触发场景; `触发对齐` → 未来找它时能不能想到用它; `英文 Title Case` → 英文首字母大写 (或直接叫"英文名"); `解释感 / XX 感` → 用地道中文改写 (例: "显示名太解释感" → "显示名读起来像解释, 不像名字"); `hero / hero 图 / hero 句` → 封面图 / 标题句; `trajectory / catalog` → 轨迹 / 清单; `frontmatter` → 通常可直接说"开头元数据"或省略。
    - **中英夹杂**: 只在**通用技术专有名词** (`SEO` / `AI` / `PR` / `commit` / `README` / `SKILL.md` / `MCP` / `Codex`)、**命令 / 文件名 / 路径 / 变量名** (`git push` / `openspec/` / `origin/main`)、**状态标识符** (`plan-written`) 时保留英文。其他 skill 生态圈的英文行话 → 中文。
    - **中式英文语序**: 「拿 X 当 Y」/「XX 感强 / 弱」/「触发对齐」等直译英文的表达 → 改成地道中文。判断法: 一句话读出来, 如果非 skill 圈的朋友听不懂, 就重写。
    发现任一违规 → 回步骤 6 重写对应段落。

## 输出格式

**落盘路径**: `<目标 skill 目录>/README.md`——绝对路径由用户输入决定, 本 skill 不擅自换目录。

**完成后的汇报格式** (打印到终端):

```markdown
落盘: <绝对路径>
总行数: <N>
主要章节: elevator pitch / 什么时候用它 / 它会产出什么 / 前置条件与边界
prompt_examples: <M> 条, 覆盖场景: <逗号分隔的 scene 列表>
拿不准之处: <一句话说明, 或"无">
```

汇报后 NEVER 再打印 README 全文——用户可自行打开落盘文件查看。

## 失败路径

- **F1 目标目录没有 SKILL.md**: 输入路径不指向一个含 `SKILL.md` 的目录, 或路径不存在 → 停下, 请用户提供正确路径, NEVER 猜。
- **F2 SKILL.md 太简陋**: 目标 SKILL.md 缺 description 或触发场景 / 主流程 / 副作用信息不足以提炼四段正文 → 停下, 建议用户先用 `skill-improve-workflow` 把 SKILL.md 补齐, 再回来生成 README; 不硬凑一份内容单薄的 README。
- **F3 目标已有 README 且用户没明说重生成**: 目标目录已存在 `README.md`, 而用户请求里没写"重生成 / 覆盖 / 重写" → 询问一次: "目标已有 README, 要覆盖重生成还是保留?" 用户不确认 → 保留现状, 停止。
- **F4 skill 类型判不出**: description 首个能力动词模糊 (既像审查又像生成又像编排), 主流程结构也判不清 → 询问用户: "这个 skill 主职偏 [写码闭环 / 内容审查 / 视觉设计 / meta / 普通生成] 哪一类?" 得到答复再定进场点覆盖模式; 用户不答 → 按"普通生成型"兜底, 并在汇报的"拿不准之处"里注明。

## Examples

<example>
Input: `own-skills/openspec-driven-development/` (已有完整 SKILL.md, 无 README.md)

Judgement:

- skill 类型 = **写码闭环型**。SKILL.md description 主职 = "把开发任务跑成识别路由 → 采访诊断 → 出方案 → 切分支 → 落 openspec/changes → 反思 → 写码 → 反思符合度 → 归档 → 更新 AGENTS.md → commit → PR 闭环"。
- 关键副作用: 动 git (fetch / 切 feature 分支 / commit / push); 落盘 `openspec/changes/<id>/`; 归档时移目录 + 合 spec-delta + 回流 wireframes; 有 remote 则开 PR。
- 反常识点: **默认先出方案、明确说「开始写代码」才动代码**。
- 进场点覆盖模式 (写码闭环型): 正面写码 / bug 讨论 / 咨询讨论 / 显式实施 / 方案复核 / 停顿指定。

Output (`own-skills/openspec-driven-development/README.md`, 关键片段):

    ---
    prompt_examples:
      - prompt: 帮我加一个「一键导出全系列」的功能，卡片导出那边。
        scene: 正面写码
      - prompt: 现在删一个操作员，删除预览里为什么会列出一大串关联的操作员？先讨论清楚再决定动手。
        scene: bug 讨论
      - prompt: 你会如何把「用户偏好」从 localStorage 迁到后端？先讨论一下，别急着写码。
        scene: 咨询讨论
      - prompt: 实施 openspec/changes/add-export-all，方案已经确认过了。
        scene: 显式实施
      - prompt: 方案实施完了，帮我检查代码是否符合 openspec/changes/add-export-all，有没有遗漏。
        scene: 方案复核
      - prompt: 给 settings 加一个「导出偏好」按钮，按 openspec 走一遍，停在 plan-written 让我看一眼。
        scene: 停顿指定
    ---

    # openspec-driven-development

    把日常开发跑成「方案 → feature 分支 → spec → 码 → 归档 → PR」的闭环, 让方案、代码、事实源始终对得上。

    ## 什么时候用它

    **正面写码**:

    我在 openspec 约定的仓库里加个功能 / 修个 bug, 想 skill 先出方案我点头再动手。

    **咨询开场**:

    我在问「你会怎么改这段」「为什么这里不对」, 想让 skill 顺势收敛成方案。

    **显式实施**:

    我已经写好 `openspec/changes/<X>`, 说「实施这个 change」直接跳到写码。

    **快车道**:

    一两行的微改动, 我不想被完整闭环压得喘不过气——跳过 change 落盘, commit 和 PR 照走。

    **停顿指定**:

    「按 openspec 走一遍, 停在 `plan-written` 让我看一眼」——推进计划里指定停点。

    **不接**:

    冷启动搭 `openspec/` → **project-init-docs**; 打 tag / 写 changelog → **release**; 「项目整体是否符合规范」的泛合规审计 → 不触发。

    ## 它会产出什么 / 你会看到什么

    **默认先出方案, 明确说「开始写代码」才动代码**——最反常识的一点。

    - **推进计划**: 亮出 `interviewing → ... → pr-opened` 状态链, 让你指定停点
    - **切分支**: `git fetch` 后从 `origin/main` 切 feature 分支, 绝不动 `main` / `master`
    - **落盘 change**: `openspec/changes/<change-id>/` 下写 proposal / design / tasks / spec-delta; 改页面加 `wireframes.md`
    - **归档**: change 移到 `archive/<日期>-<id>/`; spec-delta 合进 `openspec/specs/`; 字符图回流 `docs/wireframes/`; 更新 `AGENTS.md`
    - **收尾**: commit + 有 remote 就 `gh pr create` (body 粘 `proposal.md`, 有 issue 编号首行加 `Closes #<编号>`)
    - **绝不会做**: 自己合并 PR

    ## 前置条件 / 边界

    **前置**:

    仓库根有 `openspec/`; 能跑 `git` (有 remote 时需要 `gh`)。

    **相邻 skill 分工**:

    | 动作 | 交给 |
    |---|---|
    | 打 tag / 写 changelog / 定版本号 | **release** |
    | 冷启动搭 `AGENTS.md` + `openspec/` | **project-init-docs** |

    **不接的场景**:

    纯查询 / 跑一条不改代码的命令 / 与具体改动无关的泛合规审计。

    **微妙边界**:

    - 问「代码是否符合方案」→ 触发符合度复核; 问「项目整体是否符合规范」→ 不触发 (脱离改动的泛审计)
    - 「实施 openspec/changes/<X>」显式句式 → 直接进写码, 前提是方案完整; 残缺退回采访

汇报:

    落盘: /Users/wing/Develop/goal-claude/claude-skills/own-skills/openspec-driven-development/README.md
    总行数: 48
    主要章节: elevator pitch / 什么时候用它 / 它会产出什么 / 前置条件与边界
    prompt_examples: 6 条, 覆盖场景: 正面写码, bug 讨论, 咨询讨论, 显式实施, 方案复核, 停顿指定
    拿不准之处: 无
</example>

<example>
Input (批量):

    own-skills/skill-name-generation/
    own-skills/credibility-review/
    (两者都已有完整 SKILL.md, 均无 README.md)

Judgement:

- `skill-name-generation` → **meta 型** (作用于其他 skill 的 slug + description 上, 产出显示名)。进场点覆盖: 新起 skill 时补显示名 / 存量批量回填 / 只要中文 / 只要英文 / 已有显示名想重起 / 冷启动配套。
- `credibility-review` → **内容审查型** (审一篇文章草稿像不像营销号)。进场点覆盖: 贴 markdown 草稿 / 指定 tranfu-site 路径 / 中英文体裁 / 特定风格担忧 (营销号 / PR 通稿) / 批量审。

Output: 对两个目录各落盘一份 README.md, 汇报里分块列出两次 (落盘路径 / 总行数 / prompt_examples 条数 / 拿不准之处)。批量场景 NEVER 把两个 skill 的正文合到同一个文件里——每个 skill 一份独立 README。
</example>

<bad-example>
WRONG:

Input: `own-skills/openspec-driven-development/`

产出的 README 里包含一段:

```markdown
## 怎么调用

跟 Claude 说:

- "帮我加个功能, 按 openspec 走一遍"
- "实施 openspec/changes/add-export-all"
- "为什么这里不对? 先讨论一下"
```

Reason: 违反 §硬约束 第 5 条——正文 NEVER 写"怎么调用"段, NEVER 用 ```text 或 markdown 代码块塞示例提示词。示例提示词只在 frontmatter 的 `prompt_examples` 里存在一份, 正文里再放一次是重复且污染排版。合规改法: 删掉整段"怎么调用", 让示例只出现在 frontmatter。
</bad-example>

<bad-example>
WRONG:

Input: `own-skills/credibility-review/`

产出的 README 里 elevator pitch 写成:

```markdown
# credibility-review

审一篇文章草稿, ALWAYS 做 dual-track 独立诊断——reader trajectory + anti-pattern catalog, NEVER 越权改稿。
```

Reason: 违反 §硬约束 第 1 条 (混入 `dual-track` / `reader trajectory` / `anti-pattern catalog` 这类假英文, 非专有名词) + 第 2 条 (`ALWAYS` / `NEVER` 是英文强调副词, 散文里必须中文)。合规改法: `审一篇文章草稿读起来像不像营销号——双轨独立诊断 (读者直觉轨迹 + 反模式 catalog 枚举), 三态合判: 可发 / 待审查 / 退稿。仅诊断, 绝不重写。`
</bad-example>

<bad-example>
WRONG:

Input: `own-skills/openspec-driven-development/`

产出的 `prompt_examples` 只有 3 条, 且全是"帮我加个功能"、"帮我做个功能"、"帮我做个新特性":

```yaml
prompt_examples:
  - prompt: 帮我加个功能。
    scene: 加功能
  - prompt: 帮我做个功能。
    scene: 加功能
  - prompt: 帮我做个新特性。
    scene: 加功能
```

Reason: 违反 §README 骨架规范 (MUST 5-6 条, 覆盖至少 4 种不同进场点)。三条同属"正面写码"进场点的近义词轮换, 缺 bug 讨论 / 咨询讨论 / 显式实施 / 方案复核 / 停顿指定这些真实存在的进场点——官网 tab 切换无从分组, 用户读了也感受不到 skill 的独有价值。合规改法: 参考 §Examples 里 `openspec-driven-development` 的六条覆盖。
</bad-example>

## Runtime Tool Notes

本 skill 依赖三类工具, 均是 Claude Code / Codex CLI 原生:

- **Read**: 用于读目标 `SKILL.md` 的 frontmatter 与正文。
- **Bash**: 仅用于 `mkdir -p` 兜底 (目标 skill 目录理论上一定存在, 但输入路径异常时用来兜底); NEVER 用来调 git / 网络 / 装依赖。
- **Write**: 落盘 `README.md` 到目标 skill 目录内。若目标已有 README 且用户明说要重生成, 覆盖; 否则走失败路径 F3 询问。

**运行时无外部依赖**——不联网, 不调 API, 不启动 subagent, 不写除 `<目标目录>/README.md` 之外的任何文件。用户可在 Codex 或 Claude Code 任一运行时调用。
