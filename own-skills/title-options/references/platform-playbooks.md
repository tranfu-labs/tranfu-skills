# Platform Playbooks / 平台打法手册

This reference defines the platform-specific presets used by `title-options`. Read the common rules first, then apply only the playbooks for the platforms requested by the user.

本参考文件定义 `title-options` 的平台预设。先执行通用规则，再只应用用户指定平台的打法。

## Contents / 目录

- Common rules and tactic contract / 通用规则与打法合同
- Xiaohongshu / 小红书
- WeChat Official Accounts / 微信公众号
- Zhihu / 知乎
- Weibo / 微博
- Toutiao and AI technology sub-profile / 头条号与 AI 科技子档
- Brand references / 品牌参考
- Official references / 官方参考
- Platform selection check / 平台选择检查

## Common Rules / 通用规则

### Length status / 长度性质

- Except for the Weibo topic-phrase rule, every length in this file is a writing recommendation made by this Skill, not a platform hard limit.
- 除微博话题词规则外，本文件中的所有长度都是本 Skill 的写作建议，不是平台硬限制。
- A title may exceed a recommended length when a necessary entity, qualifier, or truth-preserving detail would otherwise be lost. Clarity and factual fidelity take priority over brevity.
- 如果删短会损失必要实体、限定条件或事实边界，标题可以超过建议长度；清晰与事实忠实优先于简短。
- Weibo topic phrases must follow the official `4–32` character rule. This is the only platform length rule treated as mandatory here.
- 微博话题词必须遵守官方 `4–32` 字规则；这是本文件唯一按平台硬规则执行的长度要求。

### Truth gate / 事实门禁

Every candidate must pass all of the following checks before platform styling or ranking:

每个候选标题都必须先通过以下检查，之后才能进行平台润色或排序：

1. Every time, number, authority, quotation, causal link, conflict, comparison, and result must be stated in the supplied article. `ARTICLE_FACT` may confirm or reject a source claim; brand traits and platform rules are external control data. None supplies a new title fact.
2. The body must be able to deliver the title's central promise without relying on implication, imagination, or outside knowledge.
3. A title must preserve material qualifiers such as “may,” “in this test,” “among respondents,” or “for this use case.”
4. Medical, legal, financial, and safety content must not be strengthened into certainty, guarantees, diagnoses, or promises.
5. Style references never become factual sources. A brand sample may guide rhythm or structure, but cannot supply claims about the user's article.

1. 时间、数字、权威、引语、因果、冲突、比较和结果都必须来自用户提供的文章。`ARTICLE_FACT` 只能确认或否定原文事实；品牌特征和平台规则属于外部控制数据。三者都不得提供新的标题事实。
2. 正文必须能够兑现标题的核心承诺，不得依靠暗示、想象或外部常识补齐。
3. “可能”“本次测试中”“受访者中”“针对该场景”等重要限定语不得被标题抹去。
4. 医疗、法律、金融和安全内容不得被强化为确定结论、保证、诊断或承诺。
5. 风格参考不是事实来源。品牌样本可以影响节奏或结构，但不能为用户文章补充事实。

Reject a candidate immediately if it invents a fact, creates a promise the body cannot fulfill, or violates the requested platform format. A user request for “more explosive” wording cannot override this gate.

候选标题只要新增事实、制造正文无法兑现的承诺，或违反指定平台格式，就直接淘汰。即使用户要求“更炸裂”，也不能绕过这一门禁。

### Tactic contract / 打法合同

The named items under each platform's `Platform tactics` section are selection filters and style overlays, not strategy IDs. First bind every candidate to exactly one `canonical_strategy_id` from `title-system.md`; count diversity and display the localized label only from that canonical table. NEVER count or display a platform tactic as another strategy.

每个平台“平台打法”下的命名项只是筛选条件和风格叠加层，不是策略 ID。必须先为每个候选绑定 `title-system.md` 中唯一一个 `canonical_strategy_id`；多样性计数和对外标签只来自该 canonical 表。绝不把平台打法另算一种策略，也不展示为策略标签。

## Xiaohongshu / 小红书

### Preset / 预设

| Field / 字段 | Rule / 规则 |
|---|---|
| Default objective / 默认目标 | Search discovery + stopping power / 搜索发现 + 停留 |
| Recommended length / 建议长度 | `≤20` Chinese characters when practical; Skill recommendation, not a platform hard limit / 在不损失事实的前提下建议 `≤20` 字；这是 Skill 建议，不是平台硬限制 |
| Voice / 语气 | Conversational, concrete, and easy to scan / 口语化、具体、便于扫读 |
| Emoji / 表情 | Use `0–2` emoji according to the requested tone; never add emoji mechanically / 按用户语气使用 `0–2` 个 emoji，不机械添加 |
| Core order / 核心顺序 | Put the search keyword, audience, or concrete value near the front / 将搜索关键词、人群或具体价值前置 |

### Format / 格式

- Return one title line per candidate. Do not force hashtags into the title unless the user explicitly asks for them.
- Keep the central search phrase natural and readable; do not stack synonyms or repeat keywords.
- Use punctuation and emoji as emphasis, not as substitutes for meaning.
- For recommendations, MUST select a `≤20`-character survivor whenever the necessary entity, qualifier, and meaning fit. Exceed 20 only when every truthful shorter form loses one of them.

- 每个候选只输出一行标题。除非用户明确要求，否则不要强行在标题中加入话题标签。
- 核心搜索词要自然可读，不堆叠同义词，不重复塞词。
- 标点和 emoji 只能用于强调，不能代替有效信息。
- 推荐位中，只要必要实体、限定和含义可在 `≤20` 字内保留，就必须优先选择该通过者。只有所有真实的短版都会丢失其中一项时，才可超过 20 字。

### Platform tactics / 平台打法

1. **Search-direct / 搜索直给**: lead with the entity or problem the reader is likely to search for. / 以前置实体或用户可能搜索的问题作为开头。
2. **Value-first / 价值前置**: surface a concrete takeaway that the body demonstrably provides. / 前置正文确实能够交付的具体收获。
3. **Pain-to-answer / 痛点到答案**: name a recognizable friction, then signal the article's answer without guaranteeing an outcome. / 点出真实痛点，再提示正文答案，但不保证结果。
4. **Audience or scenario / 人群或场景**: identify who the content is for or when it is useful. / 明确适用人群或使用场景。
5. **Supported surprise / 有据反差**: use a counterintuitive finding only when the article states it. / 仅在原文明示反常识发现时使用反差。
6. **Checklist or count / 清单或数量**: use a number only when the body contains the matching count and items. / 只有正文存在对应数量和条目时才使用数字清单。

### Anti-clickbait gate / 反标题党门禁

Reject titles that:

- claim personal testing, lived experience, “saved me,” or “I regret not knowing” when the source does not contain that experience;
- use unsupported absolutes such as “must,” “best,” “only,” “guaranteed,” or “works for everyone”;
- turn a possibility or one case into a universal result;
- conceal the real subject behind empty phrases such as “you need to know this”;
- add a fake discount, deadline, trend, controversy, or popularity signal.

出现以下情况时直接淘汰：

- 原文没有相关经历，却声称“亲测”“救了我”“后悔没早知道”；
- 使用原文不支持的“必须”“最好”“唯一”“保证”“人人有效”等绝对化表达；
- 把可能性或个案强化为普遍结果；
- 用“这件事一定要知道”等空洞表达隐藏真实主体；
- 虚构折扣、期限、热点、争议或流行度信号。

## WeChat Official Accounts / 微信公众号

### Preset / 预设

| Field / 字段 | Rule / 规则 |
|---|---|
| Default objective / 默认目标 | Click-through + trust / 点击 + 信任 |
| Recommended length / 建议长度 | `≤26` Chinese characters when practical; Skill recommendation, not a platform hard limit / 在不损失事实的前提下建议 `≤26` 字；这是 Skill 建议，不是平台硬限制 |
| Voice / 语气 | Clear, credible, and emotionally aware / 清晰、可信、具有读者共鸣 |
| Emoji / 表情 | No emoji by default / 默认不使用 emoji |
| Core mix / 核心组合 | Resonance, supported counterintuition, bounded suspense, judgment, and truthful lists / 共鸣、有据反常识、有边界悬念、判断与真实清单组合使用 |

### Format / 格式

- Return one self-contained title line per candidate.
- Put the subject or reader concern early enough that the title remains understandable outside the article context.
- Keep punctuation restrained. Use a question mark only when the article actually answers that question.
- Do not use emoji unless the user explicitly requests a matching brand tone.

- 每个候选输出一行可独立理解的标题。
- 主体或读者关切应足够靠前，保证脱离正文上下文仍然能看懂。
- 克制使用标点；只有正文确实回答该问题时才使用问号。
- 除非用户明确要求匹配相应品牌语气，否则不使用 emoji。

### Platform tactics / 平台打法

1. **Resonance / 共鸣**: identify a specific reader situation, tension, or concern stated in the article. / 提炼原文中的具体处境、张力或关切。
2. **Counterintuitive finding / 反常识发现**: lead with a supported result that challenges a common expectation. / 前置原文支持、且违背常见预期的发现。
3. **Bounded suspense / 有边界悬念**: withhold the explanation, not the subject or factual boundary. / 可以暂缓揭示解释，但不能隐藏主体或事实边界。
4. **Editorial judgment / 编辑判断**: foreground a defensible conclusion or implication from the body. / 前置正文能够论证的结论或影响判断。
5. **List or framework / 清单或框架**: promise a list, sequence, or framework only when the body contains it. / 只有正文确有清单、步骤或框架时才作出相应承诺。
6. **Entity + consequence / 实体 + 影响**: connect a named actor or event with the supported consequence for readers. / 将明确主体或事件与原文支持的读者影响连接起来。

### Anti-clickbait gate / 反标题党门禁

Reject titles that:

- use “the truth,” “everyone is talking about,” “the whole internet exploded,” or similar claims without direct support;
- manufacture anxiety, identity shame, conflict, betrayal, or a hidden insider source;
- promise a list, answer, or revelation absent from the body;
- remove a condition that materially narrows the article's conclusion;
- use a quoted sentence that is not an exact, attributable quotation in the source.

出现以下情况时直接淘汰：

- 无事实支持却使用“真相”“所有人都在谈”“全网炸了”等说法；
- 虚构焦虑、身份羞辱、冲突、背叛或内幕消息源；
- 承诺正文中不存在的清单、答案或揭秘；
- 删除会实质改变结论范围的重要条件；
- 使用原文中不存在或无法归属的引语。

## Zhihu / 知乎

### Preset / 预设

| Field / 字段 | Rule / 规则 |
|---|---|
| Default objective / 默认目标 | Search relevance + question relevance / 搜索相关 + 问题相关 |
| Recommended length / 建议长度 | Prefer the shortest complete wording that names the entity and problem; Skill recommendation, not a platform hard limit / 建议使用能够完整写明实体与问题的最短表达；这是 Skill 建议，不是平台硬限制 |
| Voice / 语气 | Precise, information-dense, and restrained / 准确、信息密度高、克制 |
| Punctuation / 标点 | Avoid excessive emotion, exclamation marks, and punctuation stacking / 避免过度情绪、感叹号和连续标点 |
| Core order / 核心顺序 | Make the entity, question, and analysis scope explicit / 明确实体、问题与分析范围 |

### Format / 格式

- Return one title line per candidate.
- A question-form title must identify a real question answered by the article. A declarative title must state the article's supported conclusion or scope.
- Preserve named entities, versions, populations, and conditions when they distinguish this article from a generic discussion.
- Prefer specific nouns and verbs over emotional modifiers.

- 每个候选输出一行标题。
- 疑问式标题必须对应正文真正回答的问题；陈述式标题必须呈现正文支持的结论或范围。
- 如果实体、版本、人群或条件决定文章与泛泛讨论的差异，就必须保留。
- 优先使用具体名词和动词，少用情绪修饰词。

### Platform tactics / 平台打法

1. **Direct question / 直接问题**: state the entity, problem, and relevant condition. / 直接写明实体、问题与相关条件。
2. **Conclusion-first / 结论前置**: lead with a qualified conclusion, followed by its scope. / 前置带限定的结论，并补充适用范围。
3. **Mechanism or reason / 机制或原因**: ask or explain “why” only when the article contains causal evidence or a clearly framed interpretation. / 只有原文提供因果证据或明确解释框架时，才使用“为什么”或机制表达。
4. **Comparison / 比较**: compare entities only when both sides and the comparison dimension appear in the source. / 只有原文同时包含比较双方和比较维度时才使用对比。
5. **Method or framework / 方法或框架**: name the approach and intended problem when the body provides actionable steps. / 正文提供可执行步骤时，明确方法及其解决的问题。
6. **Implication / 影响判断**: explain what a supported event or finding changes for a defined audience. / 说明原文支持的事件或发现对明确人群意味着什么。

### Anti-clickbait gate / 反标题党门禁

Reject titles that:

- ask a broader question than the article can answer;
- imply causality when the source provides only correlation, sequence, or opinion;
- use emotional verdicts such as “terrifying,” “destroyed,” or “no hope” without source support;
- omit the entity or comparison dimension to create vague suspense;
- decorate the title with repeated exclamation marks, question marks, or empty provocation.

出现以下情况时直接淘汰：

- 问题范围超过正文能够回答的范围；
- 原文只有相关性、先后关系或观点，却在标题中写成因果；
- 无来源支持却使用“可怕”“摧毁”“没救了”等情绪判词；
- 为制造模糊悬念而删除实体或比较维度；
- 堆叠感叹号、问号或无信息量的挑衅表达。

## Weibo / 微博

### Preset / 预设

| Field / 字段 | Rule / 规则 |
|---|---|
| Default objective / 默认目标 | Discussion + distribution / 讨论 + 传播 |
| Recommended hook length / 建议钩子长度 | Keep the first line compact enough to scan in a feed; Skill recommendation, not a platform hard limit / 首行钩子建议保持信息流中易扫读的紧凑长度；这是 Skill 建议，不是平台硬限制 |
| Required structure / 必需结构 | Every candidate contains a first-line hook and exactly one directly relevant `#topic phrase#` / 每个候选都必须包含首行钩子和恰好一个直接相关的 `#话题词#` |
| Official topic rule / 官方话题规则 | Each topic phrase must contain `4–32` characters; mandatory platform rule / 每个话题词必须为 `4–32` 字；这是必须遵守的平台规则 |
| Core tone / 核心语气 | Timely when supported, conversational, and discussion-ready / 有事实时体现时效，口语自然，便于讨论 |

### Format / 格式

Render every candidate as exactly two parts:

每个候选严格由两部分组成：

```text
First-line hook / 首行钩子
#Topic phrase# / #话题词#
```

- The first line must carry the article's actual subject, claim, question, or discussion angle; it cannot be an empty teaser.
- Add exactly one directly relevant topic phrase. It must satisfy the official `4–32` character rule.
- Do not use a current or trending topic unless the input states it or the user explicitly requests and completes current verification.

- 首行必须承载文章的真实主体、判断、问题或讨论角度，不能只是空洞预告。
- 添加恰好一个直接相关的话题词，且必须满足官方 `4–32` 字规则。
- 除非输入明确说明，或用户明确要求并完成实时核验，否则不得声称当前热搜或热点。

### Platform tactics / 平台打法

1. **News hook / 信息钩子**: foreground a supported event, release, finding, or change. / 前置原文支持的事件、发布、发现或变化。
2. **Discussion question / 讨论问题**: ask a focused question whose premises are established by the source. / 提出前提已由原文确立的聚焦问题。
3. **Viewpoint / 观点判断**: offer a defensible stance that invites response without creating camps or hostility. / 给出可论证、可讨论的立场，不虚构阵营或敌意。
4. **Contrast / 对比反差**: surface a real discrepancy, trade-off, or before-and-after change from the article. / 提炼原文中的真实差异、权衡或前后变化。
5. **Audience implication / 人群影响**: connect the event to a specific affected audience when the source supports that connection. / 原文支持时，将事件与明确受影响人群连接起来。
6. **Quoted signal / 引语信号**: use a short attributed quotation only when it appears verbatim in the source. / 只有原文存在可归属的原话时才使用短引语。

### Anti-clickbait gate / 反标题党门禁

Reject titles that:

- fabricate “breaking,” “trending,” “hot search,” public outrage, consensus, or virality;
- pair the hook with an unrelated popular topic phrase;
- create a fake quote, conflict, winner, loser, or public reaction;
- use a topic phrase outside the official `4–32` character range;
- output a hook without a topic phrase, or a topic phrase without a substantive first-line hook.

出现以下情况时直接淘汰：

- 虚构“突发”“热议”“热搜”、公众愤怒、共识或传播热度；
- 为蹭热度给钩子搭配无关热门话题词；
- 虚构引语、冲突、赢家、输家或公众反应；
- 话题词不符合官方 `4–32` 字范围；
- 只有钩子没有话题词，或只有话题词没有实质首行钩子。

## Toutiao / 头条号

### Preset / 预设

| Field / 字段 | Rule / 规则 |
|---|---|
| Default objective / 默认目标 | Feed click-through + clarity / 信息流点击 + 清晰 |
| Recommended length / 建议长度 | Prefer one compact line that preserves subject, action, and impact; Skill recommendation, not a platform hard limit / 建议用紧凑的一行保留主体、动作和影响；这是 Skill 建议，不是平台硬限制 |
| Voice / 语气 | Direct, concrete, and information-forward / 直接、具体、信息前置 |
| Core structure / 核心结构 | Subject + action or change + supported impact / 主体 + 动作或变化 + 原文支持的影响 |
| AI/technology routing / AI 科技路由 | Use the dedicated sub-profile below for AI and technology content / AI 与科技内容启用下方专用子档 |

### Format / 格式

- Return one self-contained title line per candidate.
- Name the actor, product, institution, technology, or affected group whenever the source provides it.
- Use an active verb for the event or change, then state the supported consequence or relevance.
- Keep the result understandable without relying on a thumbnail, subtitle, or article preview.

- 每个候选输出一行可独立理解的标题。
- 原文提供公司、产品、机构、技术或受影响人群时，应明确写出主体。
- 用主动动词表达事件或变化，再写原文支持的结果或相关性。
- 不依赖封面、副标题或摘要，单看标题也能理解核心信息。

### Platform tactics / 平台打法

1. **Event + impact / 事件 + 影响**: name what happened and what supported consequence follows. / 写明发生了什么，以及原文支持的影响。
2. **Change + audience / 变化 + 人群**: connect a documented change with the group it affects. / 将已记录的变化与受影响人群连接起来。
3. **Finding + implication / 发现 + 含义**: lead with a real finding and its bounded significance. / 前置真实发现及其有边界的意义。
4. **Problem + response / 问题 + 应对**: state the problem and the approach actually provided by the article. / 写明问题及正文确实提供的应对方法。
5. **Comparison / 比较**: use a comparison only when entities, dimension, and outcome all appear in the source. / 只有原文同时包含主体、维度和结果时才使用比较。
6. **Truthful count / 真实数字**: foreground a number only when the article states it and the title preserves its unit and scope. / 只有原文明示数字，且标题保留单位与范围时才将数字前置。

### AI and technology sub-profile / AI 科技子档

Use this sub-profile when the article centers on AI models, chips, research, developer tools, technology companies, product releases, or technical benchmarks.

当文章以 AI 模型、芯片、研究、开发工具、科技公司、产品发布或技术基准为核心时，启用本子档。

Preferred structure:

推荐结构：

```text
Entity + real number + supported impact
实体 + 真实数字 + 原文支持的影响
```

- **Entity / 实体**: preserve the company, model, paper, product, version, or institution named in the source. / 保留原文中的公司、模型、论文、产品、版本或机构。
- **Real number / 真实数字**: use only a number stated in the source, with its unit, benchmark, sample, date, or comparison scope when material. / 只使用原文明示的数字；单位、基准、样本、日期或比较范围影响含义时必须保留。
- **Impact / 影响**: state only the consequence, capability, limitation, or audience relevance the body supports. / 只写正文支持的后果、能力、限制或人群相关性。
- If the source has no meaningful number, fall back to `entity + action/change + supported impact`. Never invent a number merely to satisfy the preferred structure.
- 如果原文没有有意义的数字，退回“实体 + 动作或变化 + 原文支持的影响”；绝不能为了套结构而虚构数字。
- A benchmark result is not automatically a real-world outcome. Keep benchmark names, test conditions, and result scope when they matter.
- 基准测试结果不自动等同于现实效果；基准名称、测试条件和结果范围影响结论时必须保留。

### Anti-clickbait gate / 反标题党门禁

Reject titles that:

- omit the subject to manufacture suspense;
- turn a feature, test, plan, or forecast into a completed real-world result;
- use an unsupported number, unit, ranking, growth rate, market impact, or user reaction;
- declare that a model “beats,” “replaces,” “kills,” or “ends” another product unless the source supports the same comparison and scope;
- translate a benchmark win into universal superiority or business success.

出现以下情况时直接淘汰：

- 为制造悬念而隐藏主体；
- 把功能、测试、计划或预测写成已经发生的现实结果；
- 使用原文不支持的数字、单位、排名、增长率、市场影响或用户反应；
- 原文没有同等比较及范围，却宣称某模型“击败”“取代”“杀死”或“终结”另一产品；
- 将单项基准胜出夸大为全面领先或商业成功。

## Brand References / 品牌参考

### General rule / 通用规则

Brand reference is optional and applies only when the user explicitly requests it. Treat a brand as a collection of high-level editorial traits, never as a voice to clone.

品牌参考是可选项，只在用户明确提出时启用。品牌只能被视为一组高层编辑特征，不能被当作可复制的声音。

- Do not claim “exact imitation,” “precise replication,” or that the result was written by the referenced brand.
- Do not copy a distinctive title, phrase, formula sequence, punctuation signature, or example sentence.
- Extract reusable traits such as information order, density, rhythm, degree of tension, entity placement, and preferred evidence type.
- Apply the extracted traits only after the truth gate and platform rules. Brand style cannot override either.
- Keep the requested platform's format. A WeChat brand reference does not remove Weibo's two-part format or topic rule when the output platform is Weibo.

- 不得声称“精准复刻”“一比一模仿”，也不得暗示结果由该品牌撰写。
- 不复制具有辨识度的原标题、短语、公式顺序、标点习惯或示例句。
- 只提炼可迁移的高层特征，例如信息顺序、密度、节奏、张力程度、实体位置和证据偏好。
- 只有通过事实门禁和平台规则后，才应用品牌特征；品牌风格不能覆盖二者。
- 始终保留目标平台格式。例如目标是微博时，即便参考公众号品牌，也不能取消微博两段式格式或话题规则。

### Built-in high-level references / 内置高层参考

The following presets are conceptual, high-level references only. They do not authorize copying published wording.

以下预设仅用于概念层面的高层参考，不授权复制任何已发布原句。

| Brand / 品牌 | High-level traits / 高层特征 | Guardrail / 边界 |
|---|---|---|
| 量子位 / QbitAI | Put the named entity or release early; favor concrete change, real metrics, and reader-facing impact; keep technology news brisk and legible. / 主体或发布动作前置；偏好具体变化、真实指标与读者影响；科技新闻节奏明快、信息清楚。 | Do not invent urgency, a benchmark winner, market response, or adoption scale. / 不虚构紧迫性、基准赢家、市场反应或采用规模。 |
| 机器之心 / Synced | Make the research object, institution, method, or technical question explicit; use restrained, information-dense wording and qualified judgments. / 明确研究对象、机构、方法或技术问题；措辞克制、信息密度高，判断保留限定。 | Do not elevate a paper claim, lab result, or benchmark into settled consensus or real-world deployment. / 不把论文主张、实验室结果或基准测试拔高为定论或现实部署。 |
| 新智元 / AI Era | Use high information intensity, clear entity placement, and supported contrast or tension; foreground hard facts when available. / 保持高信息强度，明确实体位置，使用有依据的反差或张力；有硬事实时优先前置。 | Do not fabricate dramatic conflict, “first,” “largest,” disruption, replacement, or winner/loser language. / 不虚构戏剧冲突、“首次”“最大”、颠覆、取代或输赢表述。 |

Never describe any output as an exact reproduction of 量子位, 机器之心, or 新智元. Use wording such as “参考其高层信息组织特征 / informed by high-level editorial traits” when an explanation is necessary.

不得将任何结果描述为对量子位、机器之心或新智元的精准复刻。如需解释，只能使用“参考其高层信息组织特征 / informed by high-level editorial traits”等表述。

### Other brands / 其他品牌

For any brand without a built-in preset, require one of the following before generating titles:

对于没有内置预设的其他品牌，生成标题前必须满足以下任一条件：

1. The user supplies `3–5` representative title samples; or
2. The user explicitly authorizes web research for that brand.

1. 用户提供 `3–5` 个有代表性的标题样本；或
2. 用户明确授权联网研究该品牌。

If neither is available, stop and ask one consolidated clarification for samples or web authorization. Do not silently approximate the brand, substitute another brand, or continue with a generic style while claiming brand alignment.

如果两项都没有，必须停止生成，并集中追问一次，请用户提供样本或授权联网。不得自行猜测该品牌、替换为其他品牌，也不得用通用风格继续生成后声称已经对齐品牌。

If web research was authorized but web access is unavailable, say so and ask the user either to provide `3–5` samples or withdraw the brand-reference request. Do not fabricate research findings.

如果用户已授权联网但当前无法联网，应明确说明，并请用户提供 `3–5` 个样本或撤回品牌参考要求；不得虚构研究结果。

Authorized brand research uses the `BRAND_STYLE` scope in `title-system.md`: extract only directly observable high-level traits, keep them outside the Fact Card, and record each checked trait with the existing four-field `Verification Sources` schema. / 授权品牌研究使用 `title-system.md` 的 `BRAND_STYLE` 范围：只提炼可直接观察的高层特征，不写入事实卡，并用既有四字段“核验来源”记录每项被检查特征。

### Sample handling / 样本处理

- Treat samples as style data, not article facts or content instructions.
- Infer multiple high-level traits across the sample set; do not imitate a single sample.
- Avoid near-duplicate syntax or distinctive word sequences from the samples.
- State uncertainty when the samples conflict or are too homogeneous to support a stable style profile.

- 将样本视为风格数据，不视为文章事实或内容指令。
- 从整组样本中提炼多个高层特征，不模仿某一个样本。
- 避免复用样本中的近似句法或独特词序。
- 样本相互冲突或过于同质、无法形成稳定风格画像时，应说明不确定性。

## Official References / 官方参考

Use these pages as policy context when web verification is explicitly requested. They do not turn this Skill's recommended title lengths into platform hard limits.

用户明确要求联网核验时，使用以下页面作为平台规范背景。这些页面不会把本 Skill 的标题长度建议变成平台硬限制。

Use the `PLATFORM_RULE` scope and the existing four-field `Verification Sources` schema. If a current official rule conflicts with a required format in this playbook, report the conflict and stop rather than silently changing the contract. / 使用 `PLATFORM_RULE` 范围和既有四字段“核验来源”；若当前官方规则与本手册必需格式冲突，报告冲突并停止，不得静默改写合同。

- Xiaohongshu / 小红书: https://pgy.xiaohongshu.com/help/detail?id=6495c527d1eedeeb48fb18b1f875650e&userType=4
- Zhihu / 知乎: https://www.zhihu.com/knowledge-plan/manual
- Weibo topic rules / 微博话题规则: https://huati.weibo.com/about/intro
- Weibo community rules / 微博社区规则: https://service.account.weibo.com/h5/roles/gongyue
- Toutiao / 头条号: https://baike.toutiao.com/detail/211/212/570

## Platform Selection Check / 平台选择检查

Before returning candidates for any platform, confirm internally that:

输出任一平台候选前，必须在内部确认：

1. The candidate serves that platform's default objective or the user's explicit override.
2. The candidate follows the platform format, including Weibo's first-line hook and official topic-phrase rule.
3. Any recommended length is treated as guidance, not used to remove necessary factual qualifiers.
4. The candidate passes the common truth gate and the platform-specific anti-clickbait gate.
5. Brand traits, when requested, remain subordinate to truth and platform rules.

1. 候选标题服务于该平台默认目标，或用户明确覆盖后的目标。
2. 候选标题符合平台格式，包括微博首行钩子及官方话题词规则。
3. 建议长度只作指导，不能为了压缩字数删除必要事实限定。
4. 候选标题同时通过通用事实门禁和平台专属反标题党门禁。
5. 如启用品牌参考，其特征仍然服从事实与平台规则。
