---
name: skill-name-generation
name_zh: Skill 名称生成
display_name: Skill Display Name Generation
display_name_zh: Skill 显示名生成
description: >
  给一个已有 skill 的 slug + description 生成人类可读的显示名, 一次配对输出 `display_name` (英文 Title Case 短语) 与 `display_name_zh` (中文 4-8 字), 用于 frontmatter / 展示层。触发于: "给这个 skill 起个显示名 / 起个中文名 / 起个人类可读名 / 生成 display_name / display name / skill 叫什么 / skill 起名 / skill 命名 / human-readable name / 帮我给 skill X 起个中英文名"。也覆盖批量回填存量 skill 显示名字段的场景。Do NOT trigger when: 起产品/功能/模块名 (走 product-title-generation) / 给代码变量·函数·类命名 (走 code naming) / 起 skill 的 slug 容器名 (走 skill-domain-framing) / 写 slogan·营销文案·SEO 标题·商标合规。也不改任何 SKILL.md 或 openai.yaml 文件——写不写字段由用户自行决定。
version: 0.2.0
author: aquarius-wing
updated_at: 2026-07-10
origin: own
---

# Skill 名称生成

## 目的

给一个已有 skill 起人类可读的显示名。仓库里所有 skill 只有 kebab-case slug (`product-title-generation`), 无 human-readable name; 未来 frontmatter / 展示层要用 `display_name` (英文) 与 `display_name_zh` (中文) 两个字段, 本 skill 就是产它们。

一次调用产出一组配对——两个字段指同一件事, NEVER 只出英文或只出中文。

## Ownership

MUST 只处理 **已有 skill 的显示名**。MUST NOT 处理产品 / 功能 / 模块起名 (→ `product-title-generation`)、代码变量或函数命名、slogan 或营销文案、SEO 标题、商标合规、也 MUST NOT 决定 skill 的 slug (kebab-case 容器名, 属 `skill-domain-framing`)。本 skill 只输出候选文本, NEVER 编辑 `SKILL.md` / `agents/openai.yaml` / `index.json` 等任何文件——写不写字段、写到哪里, 由用户自己决定。

## 与相邻 skill 的分工

- `skill-domain-framing`: 决定 skill 的 **slug** (kebab-case 容器名)。本 skill 在它之后才启动, 只做 slug 已定后的显示名。
- `product-title-generation`: 给产品/功能/模块起中文短标题。命名手感的通用原则与本 skill 相通 (简洁、保留专有名词、禁 hype), 但本 skill **规则自包含, 运行时不调用它**——输入域 (skill vs 产品) 和输出结构 (双语双字段 vs 单语单字段) 都不同。
- `skill-create-workflow`: 创建 skill 的主编排流程。本 skill 是可选辅助——`skill-create-workflow` 落盘后, 若需要显示名可调本 skill; 但本 skill 从不反过来触发创建。

## 字段职责与权重

判类型、抽核心词、生成候选时, `name` (slug) 与 `description` 承担不同信号权重。

**`description` 是主职权威源**:

- 首个能力动词决定 skill 类型 (生成 / 转化 / 分析 / 审查 / 编排 / 提供一套)。
- 核心对象、独有约束、触发场景、Do NOT trigger 都是内容锚点。

**`name` (slug) 三段拆解, 只作辅信号**:

- **前缀** (归属命名, 例: `tranfu-` / `skill-` / `openspec-` / `github-`): 只作触发对齐参考, NEVER 进显示名内容, 除非 description 本身提及该品牌。前缀承担的是"这条 skill 归谁管"而非"名字里有它"。
- **中段词** (核心标签): 关键词候选池, 可能有歧义 (风格词撞品牌名 / 隐喻名撞实词等); 一律用 description 语义印证再决定入名。
- **后缀形态词** (例: `-workflow` / `-set` / `-review` / `-kit`): 只是关键词提示, 不足以决定 skill 类型。

**冲突裁决**: 当 slug 形态词与 description 主职冲突时, **以 description 为准**。例: slug 后缀是 `-set` 提示资产型, 但 description 首个动词是"生成" → 按能力 / 生成型走, 不按 slug 走。

## 执行

CREATE A TODO LIST FOR THE TASKS BELOW. Keep the list internal unless the user asks to see process.

1. 读输入。用户 MUST 提供 skill 的 slug + description; 也可指一个 `SKILL.md` 路径, 由本 skill 从 frontmatter 读取。若两者都缺, 进入失败路径 F1。
2. 判越界。若输入实际是**产品/功能/模块**、**代码标识符**、**slogan/SEO 标题**、**商标合规**、或用户在要**新的 slug**, 停下路由到对应 skill (见 §Ownership), NEVER 硬起显示名。
3. 判 **skill 类型** (决定英文与中文各自的句式)。**先看 description 的第一个能力动词** (生成 / 分析 / 审查 / 编排 / 提供), 再看 slug 只作印证 (见 §字段职责与权重); **当 slug 形态词后缀与 description 主职冲突时, 以 description 为准**。无法归入任一类时按能力/生成型兜底并在理由里注明。
4. 配对生成候选。同一类型下同时生成英文与中文, 两字段指同一件事; MUST 产出至少 6 组配对进入筛选池 (推荐 + 备选 3 组 + 淘汰缓冲)。
5. 套 §命名规约 筛选。淘汰不合规约的候选。若剩余不足 1 推荐 + 3 备选, 回步骤 4 补生成; 补生成 2 轮仍不足 → 进入失败路径 F2。
6. 选推荐。按优先级排序: 语义与原 description 贴合度 > 触发对齐 (未来用户提及该 skill 时会用的词是否落在候选里) > 句式与 skill 类型一致 > 中英文长度与语气对齐。
7. 按 §输出格式 输出。推荐组 MUST NOT 与备选任一组重复。

## Skill 类型与句式

判定列一律"description 主职为准, slug 只作印证" (见 §字段职责与权重)。

| 类型 | 判定 | 英文句式 | 中文句式 | 例 (slug → display_name / display_name_zh) |
|---|---|---|---|---|
| 动作 / 编排型 | description 主职是"依次跑 A→B→C"或"编排 X 流程"; slug 里 create / review / improve / deploy 等动词作印证 | 动词短语 (Title Case) | 动词短语 (4-8 字) | `skill-create-workflow` → Skill Creation Workflow / Skill 创建工作流 |
| 能力 / 生成型 | description 首个能力动词是"生成 / 转化 / 分析 / 提取 X", 且非明显工作流; slug 不参与判定 | 名词短语 (Title Case) | 名词短语 (4-8 字) | `product-title-generation` → Product Title Generation / 产品标题生成 |
| 资产 / 系统型 | description 主职是"提供一套可查阅 / 可复用的 X 资源" (skill 是查阅入口而非生成器); slug 的 `-set` / `-kit` / `-library` 后缀只作印证, 与主职矛盾时不生效 | `X System` / `X Library` / `X Set` | `X 系统` / `X 库` / `X 集` | `visual-dna-system` → Visual DNA System / 视觉 DNA 系统 |
| 规范 / 守则型 | description 主职是"保证 X 结果"或"防止 Y 失败"; slug 里 safe / valid / clean / compliant 作印证 | 结果名词短语 | 结果名词短语 (4-8 字) | `lark-safe-write` → Lark Safe Write / 飞书安全写入 |

无法归入任一类时选**能力 / 生成型**兜底并在理由里注明"按能力兜底"。

## 命名规约

**英文 (`display_name`)**:

- MUST 是 Title Case 的正常英文短语, NEVER 只把 slug 的连字符换空格 (`Skill Name Generation` 除非语义恰好落在这, 否则算 slug 空格化, 淘汰)。
- MUST 从 description 语义来, NEVER 拿 slug 逐字翻译。
- MUST 保留品牌 / 专有名词的原大小写: `OpenSpec`, `GitHub`, `Lark`, `AI`, `Agent`, `MCP`, `SEO`, `PR`。品牌名 NEVER 翻译成中文再回译。
- 长度目安 2-5 词; 单词过多算解释短语, 淘汰。

**中文 (`display_name_zh`)**:

- MUST 4-8 字 (含必要英文专有名词, 每个专有名词按 1 字计)。少于 4 字通常太抽象, 多于 8 字变解释句。
- MUST 保留必要英文专有名词 (`AI`, `Agent`, `MCP`, `GitHub`, `OpenSpec` 等)。
- **术语替换表** (MUST 应用): `Lark` → `飞书`; `WeChat` → `微信`; `Feishu` → `飞书`。其他品牌保持英文。
- NEVER 出现 hype 词: `神器`, `王者`, `爆款`, `超级`, `未来`, `极致`, `史诗级`, `一键`, `秒`。
- NEVER 出现动作型口号词: `助手` (除非 description 就是助手类)、`帮手`、`利器`。

**通用 (对两个字段都成立)**:

- MUST 像真实产品/工具名, NEVER 是解释短语 ("A tool that generates names" / "生成 skill 名字的工具" 都算解释短语, 淘汰)。
- NEVER **语义漂移**: 显示名的核心动词或核心名词 MUST 与原 description 的核心能力一致; 抛掉核心词换成更"好听"的近义词算漂移, 淘汰。
- **slug 前缀 (归属命名) NEVER 进显示名内容**, 除非 description 本身提及该品牌名。前缀承担归属信号, 不作产品名成分。
- 推荐组 MUST 与 3 组备选**均不同**——两组显示名任一字段相同即视为重复。

**触发对齐反查** (选推荐前的最后一遍):

- 想象未来用户想找回这个 skill 时会怎么开口, 写 2-3 句自然话术。
- 检查候选的关键词, 是否落在这些话术里。落不上的候选调低排序, 但不淘汰——留作备选。

## 输出格式

```markdown
推荐:
- display_name:    XXX
- display_name_zh: XXX
- 理由: 一句话说明为什么这组贴合该 skill 的定位、核心能力或使用场景。

备选:
1.
   - display_name:    XXX
   - display_name_zh: XXX
   - 理由: 一句话。
2.
   - display_name:    XXX
   - display_name_zh: XXX
   - 理由: 一句话。
3.
   - display_name:    XXX
   - display_name_zh: XXX
   - 理由: 一句话。
```

**批量输入** (用户一次给多个 skill): 对每个 skill 重复上面的完整块, 用二级标题 `## <slug>` 分隔。

Output only this block unless the user explicitly asks for analysis, more options, fewer options, or a different format.

## 失败路径

- **F1 输入不足**: 只有 slug 没 description 且用户没给 `SKILL.md` 路径 → 询问一次: "缺 description, 请贴 description 或给 SKILL.md 路径。" 用户仍不补 → 停止, 说明缺失, 不硬起。
- **F2 候选耗尽**: 两轮补生成后仍不足 1 推荐 + 3 备选 → 停止, 输出已生成的候选与被淘汰的原因, 请用户放宽某条规约 (通常是长度或术语替换)。
- **F3 越界**: 输入是产品名 / 变量名 / slogan / SEO 标题 / slug → 停止, 说明本 skill 只处理 skill 显示名, 建议路由到 `product-title-generation` / code naming / `skill-domain-framing` 等。
- **F4 已有显示名**: 用户 SKILL.md 里已有 `display_name` / `display_name_zh`, 且用户没明说要重起 → 询问一次: "现有显示名是 A / B, 要重起还是保留?" 用户不确认 → 保留现状, 停止。

## Examples

<example>
Input:

```text
slug: skill-create-workflow
description: 编排 skill 创建流程, 依次跑内容准入 → 任务域框定 → skill-creator → prompt-review, 最后 tranfu-publish 发布。
```

Judgement: 动作 / 编排型 (slug 含 create/workflow, description 就是"跑一遍…流程")。

Output:

```markdown
推荐:
- display_name:    Skill Creation Workflow
- display_name_zh: Skill 创建工作流
- 理由: 直译 slug 反而正好落在用户会用的词上 (创建 / workflow), 动作+对象+编排型词尾三段齐全。

备选:
1.
   - display_name:    Skill Authoring Workflow
   - display_name_zh: Skill 编写工作流
   - 理由: "authoring" 更贴近 prompt 工程语境, 中文 "编写" 更强调产物本身。
2.
   - display_name:    Skill Build Orchestrator
   - display_name_zh: Skill 构建编排器
   - 理由: 从"编排"角度切入, 突出四门串行的编排属性。
3.
   - display_name:    Skill Scaffolding Flow
   - display_name_zh: Skill 脚手架流程
   - 理由: "scaffolding / 脚手架" 强调结构性搭建, 适合偏工程侧用户。
```
</example>

<example>
Input:

```text
slug: lark-safe-write
description: 往飞书 (Lark) 文档写内容前的一整套安全检查——防误覆盖、防越权、写前 diff 确认。
```

Judgement: 规范 / 守则型 (description 主职是"保证写入安全"这个结果)。

Output:

```markdown
推荐:
- display_name:    Lark Safe Write
- display_name_zh: 飞书安全写入
- 理由: 保留 Lark 品牌 (英文侧) 与国内产品名 (中文侧 → 飞书), 结果名词 "Safe Write / 安全写入" 精准对齐守则型定位。

备选:
1.
   - display_name:    Lark Write Guardrails
   - display_name_zh: 飞书写入护栏
   - 理由: "guardrails / 护栏" 强调守则型的防错本质, 但比 "safe write" 少了动作对象感。
2.
   - display_name:    Lark Doc Write Check
   - display_name_zh: 飞书文档写入校验
   - 理由: 更强调"校验"这一具体动作, 适合把 skill 定位为工序而非通用守则时。
3.
   - display_name:    Lark Write Preflight
   - display_name_zh: 飞书写入预检
   - 理由: 从航空 "preflight / 预检" 借喻, 突出"写前一整套检查"。
```
</example>

<example>
Input:

```text
slug: product-title-generation
description: Generate concise Chinese product, feature, module, entry, activity-theme, or brand-short titles.
```

Judgement: 能力 / 生成型 (主职是"生成 X titles")。

Output:

```markdown
推荐:
- display_name:    Product Title Generation
- display_name_zh: 产品标题生成
- 理由: 名词短语与能力型句式一致; 中英文都直接落在用户会用的关键词 (产品标题 / product title)。

备选:
1.
   - display_name:    Chinese Product Titles
   - display_name_zh: 中文产品短标题
   - 理由: 突出输出语种是中文这一实际特点, 定位更窄但触发词更贴切。
2.
   - display_name:    Product Naming Studio
   - display_name_zh: 产品命名工坊
   - 理由: 从"工坊"角度强调多候选筛选的过程, 用于 UI 展示时更有产品感。
3.
   - display_name:    Product Title Composer
   - display_name_zh: 产品标题构造器
   - 理由: "Composer / 构造器" 强调按元素组合的方式产标题, 与内部按对象/能力/场景分轴的结构呼应。
```
</example>

<example>
Input (批量):

```text
1. slug: openspec-driven-development
   description: 在 OpenSpec 约定的项目里跑"需求→规格→实现→归档"闭环。

2. slug: visual-dna-system
   description: 一套跨产品复用的视觉 DNA (色板 / 字体 / 图形语言 / 版式)。
```

Output:

```markdown
## openspec-driven-development

推荐:
- display_name:    OpenSpec-Driven Development
- display_name_zh: OpenSpec 驱动开发
- 理由: 品牌 OpenSpec 原样保留; 中英文都完整承接 slug 的"driven development" 结构, 是动作/能力混合型的直译落点。

备选:
1.
   - display_name:    Spec-First Workflow
   - display_name_zh: 规格先行流程
   - 理由: 抽掉品牌名, 突出方法学。
2.
   - display_name:    OpenSpec Delivery Loop
   - display_name_zh: OpenSpec 交付闭环
   - 理由: "delivery loop / 交付闭环" 更贴近"需求→归档"的闭环感。
3.
   - display_name:    OpenSpec Change Flow
   - display_name_zh: OpenSpec 变更流
   - 理由: 从 openspec/changes 目录的视角命名, 定位更技术化。

## visual-dna-system

推荐:
- display_name:    Visual DNA System
- display_name_zh: 视觉 DNA 系统
- 理由: 资产/系统型直接采用 System / 系统 收尾; "DNA" 作为品牌化术语在中英文都保留。

备选:
1.
   - display_name:    Visual DNA Library
   - display_name_zh: 视觉 DNA 库
   - 理由: 从"库"角度突出可查询、可复用属性。
2.
   - display_name:    Brand Visual Kit
   - display_name_zh: 品牌视觉套件
   - 理由: 抛开 DNA 隐喻, 用工程口径的 "kit / 套件"; 触发对齐弱一档但更通用。
3.
   - display_name:    Design DNA Atlas
   - display_name_zh: 设计 DNA 图谱
   - 理由: "Atlas / 图谱" 强调可导航的结构性资产集。
```
</example>

<bad-example>
WRONG:

Input:

```text
slug: skill-name-generation
description: 给 skill 起 display_name 与 display_name_zh。
```

Output:

```markdown
推荐:
- display_name:    Skill Name Generation
- display_name_zh: Skill 名称生成
- 理由: 简洁明了。
```

Reason: 英文只把 slug 的连字符换空格 (`Skill Name Generation`), 违反 "MUST 从 description 语义来, NEVER 拿 slug 逐字翻译"。中文"简洁明了"也不算理由。合规改法应从 description 的核心动词与对象重构, 例如 `Skill Display Name Composer` / `Skill 显示名生成器`, 并写出为什么这样起。
</bad-example>

<bad-example>
WRONG:

Input:

```text
slug: post-illustration-images
description: 给公众号 / 小红书文章批量生成配图。
```

Output:

```markdown
推荐:
- display_name:    Post Illustration Magic
- display_name_zh: 文章配图神器
- 理由: 强调"魔法般好用"。
```

Reason: 英文 `Magic` 与中文 `神器` 都是 hype 词, 明确违反 §命名规约 "NEVER 出现 hype 词"。合规改法把 hype 词换成描述能力的名词, 如 `Post Illustration Kit / 文章配图工坊` 或 `Article Cover Generator / 文章配图生成`。
</bad-example>

<bad-example>
WRONG:

Input:

```text
slug: product-title-generation
description: Generate concise Chinese product titles.
```

Output:

```markdown
推荐:
- display_name:    Naming Studio
- display_name_zh: 起名助手
- 理由: 通用性强, 适用面广。
```

Reason: 语义漂移——原 description 的核心词是 "product title / 产品标题", 显示名把 "product title" 抽掉换成通用的 "naming / 起名", 未来用户请求 "帮我给产品起个标题" 时不会想到 `Naming Studio`, 触发对齐落空。合规改法必须让核心词 "产品标题 / product title" 出现在名字里。
</bad-example>

## Runtime Tool Notes

本 skill 只输出文本, 无工具依赖。

- 用户可在 Codex 或 Claude Code 任一运行时调用。
- 若用户只给了 `SKILL.md` 路径, 本 skill 用当前运行时的文件读取工具 (Read / cat) 从 frontmatter 摘 `name` 与 `description` 两字段即止, NEVER 读全文——正文与本次命名判断无关。
- NEVER 编辑 `SKILL.md` / `agents/openai.yaml` / `index.json` 或其他任何文件, 即使用户在同一轮补一句"顺手写进去也行"——写入需要用户显式路由到 `skill-create-workflow` 的 update / repair 或手动改。
