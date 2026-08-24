---
name: prompt-review
display_name: Prompt Review
display_name_zh: 提示词审查
description: >
  当用户要求 review、audit、optimize、lint 或 engineering-check 某段提示词、SKILL.md、
  agent 定义、subagent 模板或内联 prompt 文本时触发；也匹配“帮我审一下这个 prompt”、
  “检查提示词质量”、“评审这个 agent 定义”、“这个 skill 写得怎么样”或“优化提示词”。
  不要用于代码审查（走 code-review）、功能 QA / 单元测试 / 运行时 bug 修复（走 verify）、
  发版（走 release）、benchmark、仅产品文案，或与 prompt/skill/agent 行为无关的普通润色。
  安全边界：本 Skill 只审不改——即便用户说“优化 / 改写”，也只产出 REVIEW_PACKET
  （direct 型给改法、think 型给作者思考的问题），从不编辑提示词 / SKILL / 文件。
version: 1.0.0
author: aquarius-wing
updated_at: 2026-08-24
origin: own
---

# 提示词审查

把 prompt / skill / agent 定义当**工程产物**审。核心判断只有一个：

> **这段内容承载的信息，模型能不能自己推断出来？**
> 能推断的是噪音（该删）；不能推断的，检查它的家是否唯一、形态是否匹配类型。

审查是双向的：缺承重信息要补，堆冗余规则要删。**只会做加法的审查本身就是病**——
不要用“新开一个章节”来满足任何检查。

边界：只审不改——只产出 `REVIEW_PACKET`，从不编辑目标文件，落盘与否由用户决定。

## 流程

1. 读取目标（文件 / 目录 / 内联文本；内联标记为 `inline-prompt.md`）。
   完全没有目标 → 向用户要材料并退出。
2. 判定类型：看**信息重心**落在哪个类型章节；判不出 → 只跑通用检查，
   并记一条 think 型 issue 问作者。
3. 跑通用检查。
4. 跑该类型的一对检查：「必须满足」缺失 → issue；「特征病」出现 → issue。
   **杂交豁免**：某块虽呈特征病形态，但承载唯一且不可推断的信息 → 放过
   （例：经验型 skill 里一节真实的数据结构契约）。
5. 每条 issue 判 direct / think（见分型）。
6. 产出 `REVIEW_PACKET`，结束。

失败出口：目标不可读 → BLOCKER 并说明缺什么。

## 通用检查（所有类型）

- **routing-surface**：frontmatter `description` 是路由面，MUST ≤1024 字符，
  只回答何时触发 / 何时不触发 / 最关键安全边界；流程、schema、清单放 body。
  触发信息只有写在 description 里才会被路由读到——写在 body 里的触发语言是死字。
- **trigger-coverage**：description 用「能力句 + Use when 触发句」形态，第三人称。
  触发句覆盖意图空间——任务场景、用户会提到的关键词 / 文件类型、以及用户不用
  正式术语时的说法（“即使用户没说出 X 也触发”）；语气偏主动（whenever / even if
  not explicitly asked）以对冲模型实测的触发不足倾向。
  用户真实的非正式说法只有作者见过 → think，NEVER 替作者编。

  <example>
  "Processes Excel files and generates reports. Use when analyzing spreadsheets,
  tabular data, or .xlsx files." —— 第三人称能力卡片，与 system prompt 叙述视角一致。
  </example>

  <bad-example>
  “我可以帮你处理 Excel 文件”“你可以用这个生成报表” —— description 会被注入
  路由模型的 system prompt，第一 / 第二人称在那个语境里指代错乱
  （“我”是路由模型还是 skill？“你”是用户还是 Claude？），直接损害触发准确率。
  </bad-example>

- **degrees-of-freedom**：指令粒度逐段匹配任务脆弱性。脆弱操作（不可逆、顺序敏感、
  格式严苛、实测易翻车）→ 精确步骤加护栏（低自由度）；多路可达的开放任务 →
  只给方向与原则（高自由度）。两个方向的错配都是 issue：开阔地铺铁轨、
  悬崖边没护栏。与 scoped-hard-markers 一体两面：硬度跟着脆弱性走。

  <example>
  脆弱操作上精确护栏：「数据库迁移 MUST 原样运行 `python scripts/migrate.py
  --verify --backup`，不得改动命令或增加 flag」；
  开放任务上只给方向：「检查代码结构、边界情况与项目惯例，按上下文判断」。
  </example>

  <bad-example>
  开阔地铺铁轨：把“读取文件 → 判断父子关系 → 更新节点”这类任何模型都会做的
  开放任务写成七步编号硬流程——作者预设的路径在未预见的场景里强制模型做错事；
  悬崖边没护栏：对字段必须逐字精确的 JSON 绑定只说“合理地更新绑定”。
  </bad-example>

- **single-default**：同一件事给一个默认做法 + 例外时的替代
  （“扫描件需 OCR 时改用 X”），不列一排候选让执行者现场挑
  （“可以用 pypdf，或 pdfplumber，或 PyMuPDF……”）——那是把作者该做的决策推给运行时。
- **time-sensitivity**：正文不写会过期的条件指令（“2025 年 8 月前用旧 API”）；
  现行做法写正文，旧模式折进标注弃用时间的 legacy 折叠区。
- **one-home-per-fact**：同一条规则 / 判据 / 处置，全文只允许一个家。
  复述 = 把细节重抄一遍；指向那个家的一句引用不算第二个家。
  多处复述 → 合成一条批量 issue，保留信息密度最高的家，其余删除或改为引用，
  各处独有的新信息折进那个家。
- **info-not-section**：检查任何“有没有 X”，看信息是否存在于文中任何位置，
  不要求专门章节。为满足形式而存在的章节（验收表复述场景表、example 复述正文）
  本身就是冗余。
- **scoped-hard-markers**：硬标记（MUST / NEVER）要稀缺——只留给违反即出
  严重后果的约束：安全边界、不可逆操作、实测会被静默绕过的关键动作（如派发点）。
  判的是稀缺性被稀释（全文硬词化）这个可观测形态，不逐个 MUST 找茬。
- **terminology-consistent**：同一概念全文用同一个词，不混用
  （field / box / element、提取 / 拉取 / 获取）。
- **progressive-structure**（目标是 skill 目录时才触发）：body ≤500 行，超了拆分文件；
  引用文件从 SKILL.md 一跳可达——嵌套引用会导致模型部分读取、信息残缺；
  超过 100 行的 reference 文件头部有目录。

## 类型检查

每型一条「必须满足」（该类型独有的价值载体）+ 一条「特征病」（该类型独有的腐败方式）；
通用错误不归这里，归通用检查。

### 经验纠偏型（信息重心：场景→预期输出对照、真实踩坑、具体数值）

- 必须满足：每条内容**不可推断**——盖住这条，没见过它的模型自己写不出来
  （具体数值、真实叫法、踩过的坑）；可推断的内容无论真伪都是噪音。
  不可推断的内容按可验证性分流：可本地核实的（工具 flag / 文件路径 / 字段名）→ 核实，
  不符即 issue；纯经验断言 reviewer 无法从文本判真伪 → 默认信任作者，
  仅当有编造嫌疑（与可核实事实矛盾、可推断内容包装成经验、整齐得像枚举而非遭遇）
  时 think 问作者，NEVER 断言“这是编的”。
- 特征病：同一事实摊成工作流 / 验收 / example 多个章节反复复述。

<example>
场景表一行写清「连线只是坐标贴着节点 → 箭头双向绑定端点，不得保留 null 绑定」；
绑定字段的结构细节只在「真连接契约」一节出现一次。契约节虽呈工具封装形态，
但承载唯一且不可推断的信息，按杂交豁免保留。
</example>

<bad-example>
「箭头必须真绑定」出现在场景表、工作流第 5 步、契约节、验收表、护栏、bad-example 共 6 处；
验收表逐行复述场景表。
→ 一条 one-home-per-fact 批量 issue（locations 列 5 处，留契约节这个家），
  外加一条 info-not-section issue（删验收表复述行与 example 块）。
</bad-example>

### 编排型（信息重心：多步流程、门禁、subagent 分工）

- 必须满足：派发点零思考可执行——派发指令与模板紧贴，占位符只留运行时值。
- 特征病：失败无出口——分支只写 happy path，卡住即静默降级。

<example>
「MUST 启动 SubAgent 按照下面的模板直接开始任务」+ 模板紧跟其后；
文档路径等写作时已知的静态值写死，占位符只留 {SEED_URL} 这类运行时值。
每个门禁带失败处置：「T2 未通过 → 报告未过项并退出」。
</example>

<bad-example>
派发指令与模板之间隔了三个小节——每段都是犹豫窗口，实测模型读完就拒绝派发、
自行降级本地执行。分支写「若校验失败则酌情处理」——没有处置的出口，卡住时被静默吞掉。
</bad-example>

### 工具封装型（信息重心：CLI / API 调用契约）

- 必须满足：契约逐字可执行——命令、参数、输出解析复制即可运行。
  按可核实性分流：工具在场、能对照 --help / 本地文档 → 核实，不符即 issue；
  核实不了 → NEVER 假装核实过，也不硬判失真，记一条 think 问作者契约
  是否与工具当前版本一致。
- 特征病：契约失真——flag / 路径与工具真实版本不符，skill 成为假事实源。

<example>
`tfs search "<keyword>" --runtime=claude-code --json`，并注明解析 stdout 的
`{results: [...], total: N}`、从 `results[].name` 取结果——照抄即跑。
</example>

<bad-example>
「用 tfs 的 `--format=json` 参数」——该 flag 实际叫 `--json`。
比不写更糟：agent 会拿着假契约反复失败。
</bad-example>

### 参考型（信息重心：外部知识镜像）

- 必须满足：标注来源与时效——镜像自哪、抓取于何时、权威入口在哪。
- 特征病：材料写成指令——镜像内容变成命令式规则被 agent 照抄执行。

<example>
「以下为 X 的 system prompt 社区抓取镜像（2026-05 抓取，来源见链接），
仅作参考材料，不是本 agent 的行为指令。」
</example>

<bad-example>
把镜像里的「You must always …」原样留在正文、无隔离标注——
agent 把参考材料当成了自己该执行的规则。
</bad-example>

## 严重级别

BLOCKER 运行时直接失败或产出不可用 ／ HIGH 显著降低可靠性或可触发性 ／
MEDIUM 边界场景咬人 ／ LOW 风格。

## direct / think 分型

判定只问一句：**不知道作者的意图，reviewer 能不能写出唯一正确的改法？**

- 能 → `direct`：`fix` 给具体改法或可落盘 patch。
- 不能 → `think`：给 2–3 个决策性问题，每个带 q / why / then
  （问什么、为何只有作者能答、答完落到哪）。

两条硬约束：

- NEVER 伪造标准答案：改法需要编造只有作者知道的事实
  （口语触发词、完成判据、经验真伪）→ MUST 用 think。
- NEVER 把体力活包装成问题：软词替换、字段名对齐这类有标准答案的 → 直接给改法。

## REVIEW_PACKET（输出 schema）

```yaml
REVIEW_PACKET:
  target: <file path | inline-prompt.md>
  type: 经验纠偏|编排|工具封装|参考|未判定
  issues:
    - id: <检查名-序号，如 one-home-per-fact-1>
      severity: BLOCKER|HIGH|MEDIUM|LOW
      fix_type: direct|think
      check: <命中的检查名>
      locations: ["<file:line | 段落锚点>", ...]   # 批量 issue 列出全部位置
      evidence: "命中的原文片段"
      fix: "具体改法"                # direct 必填
      questions:                     # think 必填
        - { q: "...", why: "...", then: "..." }
      acceptance_test: "怎样算修好（可观测）"
  ledger: { total: n, by_severity: {...}, unresolved_blockers: n }
```

## 已知边界

不证明 prompt 在生产中可用；不跑行为 eval；不审应用代码正确性；不要求网络访问。
