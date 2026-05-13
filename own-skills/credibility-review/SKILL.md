---
name: credibility-review
description: Review a draft 踩坑记 or 养成记 article (for tranfu-site or anywhere following the same rules) by spawning two independent fresh agents in parallel — A 轨 simulates a reader with dual-axis 耐心/信任 scoring, B 轨 runs anti-pattern catalog detection — then composes a tri-state verdict (可发 / 待审查 / 退稿). Trigger when user says 审稿/审一下/检查文章/帮我看下这篇/check this draft/review this article/抓一下问题/看看哪里不对, OR pastes a markdown article tagged 踩坑/养成 and asks for feedback, OR provides a path to such a file in tranfu-site/src/content/posts/. Output combines reader-trajectory + catalog hits — NOT a rewrite. Anchored to tranfu-site/goal-docs/05-design-踩坑记-final.md + 06-design-养成记-final.md.
version: 0.1.2
author: aquarius-wing
updated_at: 2026-05-11
origin: own
published_to: tranfu-labs/tranfu-skills
published_version: 0.1.2
published_at: 2026-05-11
---

# credibility-review

> 用两个独立 agent 同时审稿：A 轨**模拟读者**（双轴 耐心 / 信任 标量），B 轨**反模式 catalog**（语言层枚举）。**两个独立 fresh agent 并行**——A 不开规则书素读，B 跑 catalog；最后**三态合判**：两轨都 PASS = 可发；都 FAIL = 退稿；一 PASS 一 FAIL = 待审查。**只诊断，不重写**。规则源永远是 `tranfu-site/goal-docs/05-design-踩坑记-final.md` 与 `06-design-养成记-final.md`。

为什么双轨：B 轨能抓"语言层有违规"（PR 套话 / 教程标题 / 隐蔽 hero）；但 B 轨 0 命中不等于文章有内容——一个 fluent 的 PR 写手能写一篇全部避开反模式但全空的文章。A 轨抓的就是这种"语言干净但读起来空"——通过模拟读者的耐心和信任在读的过程中怎么消耗。两件事互补，缺一不可。

---

## §0 兼容性合同

```
本 skill 假设：
- BSD grep（macOS 默认）或 GNU grep ≥ 2.6
- 不依赖 PCRE / -P / \b / \d / \w
- 中文 UTF-8 默认 work，无需 LANG / LC_ALL
- 待审稿件用原始路径 <target>，不复制到 /tmp
- 中英双语：英文用 `grep -nEi`（B 轨）
```

修订 grep 时必须在 macOS 默认 zsh + /usr/bin/grep 下实测。

---

## §1 何时调用 / 不调用

**调用**：用户给一段 markdown 或一个 `.md` 路径，说"看下能不能发 / 帮我审一下 / 抓一下问题 / 检查文章"；用户在 `tranfu-site/src/content/posts/*.md` 上停下来求审；用户贴一篇 AI 行业文章问"这写得怎么样 / 像不像 PR 稿"。

**不调用**：用户要重写 / 润色 / 扩写 / 打分 / 评级；用户要"全文点评 / 建议从几个维度展开"。

---

## §2 工作流

```
Step 1  主 agent 识别体裁（踩坑记 / 养成记 / 其它）
Step 2  主 agent 用 Agent 工具并发起两个 fresh sonnet sub-agent：
        - A 轨 (sub-agent A)：读 §3 + 文章, 输出读者轨迹 + verdict
        - B 轨 (sub-agent B)：读 §4 + 文章, 输出 catalog 命中清单 + verdict
        两个 sub-agent **互不可见对方的 prompt 和 output**——必须独立判断。
Step 3  两个 sub-agent 都返回后, 主 agent 按 §5 三态合判
Step 4  主 agent 按 §6 schema 汇总报告
```

**硬规则**：A 轨 sub-agent 的 prompt **不得包含 B 轨内容**（不让它知道反模式 catalog），否则 A 会污染成 B 的子集，失去独立判断价值。两轨必须真独立。

任一步发现退稿级违规也**不要提前终止**——一篇文章常同时踩多个坑，一次性把全部问题报给作者比挤牙膏式反馈更有用。

---

## Step 1 — 识别体裁（主 agent 同步执行）

按以下顺序判断：

1. 看 frontmatter `tag`：`踩坑` → 踩坑记；`养成` → 养成记。
2. 无 frontmatter：看时间跨度——单点事件（小时 / 几天）= 踩坑记；≥ 2 个月演化 = 养成记。
3. 仍无法判断 → 直接问用户"这篇你打算发到哪个栏目"，**不要猜**。

**非踩坑/养成的文章**（资讯爆料 / PR 通稿 / research essay / advice tutorial / postmortem 等）：体裁 = "其它"。A 轨用通用读者预期 set（见 §3.4 末），B 轨跳过结构核对仍跑反模式 catalog。

**规则源**：踩坑记 = `tranfu-site/goal-docs/05-design-踩坑记-final.md`；养成记 = `06-design-养成记-final.md`。

---

## §3 — A 轨 spec（读者模拟，sub-agent A 读这一节）

### 3.1 A 轨 sub-agent 的 prompt 模板

```
你是 AI 行业一线工程师同行（5–10 年代码经验）。任务：模拟读者读完这篇 <体裁>，
输出双轴标量轨迹 + 终局 verdict。

**禁止**：不打开任何反模式词表 / 禁用词清单。你只用读者直觉判断，不做语言学
catalog 匹配。如果你脑子里冒出"这是禁用词"——忽略，继续读。

体裁：<踩坑记 | 养成记 | 其它>
文章路径：<path>

按 §3.2–§3.5 流程执行，最后输出 §3.6 schema。
```

### 3.2 双轴起点（按体裁条件）

| 体裁 | 耐心起点 | 信任起点 |
|---|---|---|
| 踩坑记 | 100 | 100 |
| 养成记 | 80 | 100 |
| 其它 | 90 | 100 |

养成记耐心起点更低——长篇 retain 难度大，对"撑场字数"更敏感。

### 3.3 预期是 set 不是 chain

读者维护一个**未满足预期集合**——按体裁初始化。读文章是线性的，但匹配是**集合**：在任何位置满足任何一条预期都计为 retire。走完全文后未满足的留在 set 里，转成耐心 penalty。

**踩坑记初始预期 set**：

1. 开头 100 字内进入具体场景（不是"随着 X 发展"型 lead）
2. ≥ 1 处具名出错的事物（错误信息原文 / prompt 原文 / 模型回答原文）
3. ≥ 2 步具名错误假设的试错链（"我以为 / 怀疑 / 第一反应"等小节）
4. 真相段 + "为什么前面没看到"
5. 模型具名到版本号
6. ≥ 1 个量化数字（带基数或时间锚）
7. 现在改成什么 + 还没解决的部分

**养成记初始预期 set**：

1. 开头进入一个具体决策瞬间或对话（不是"成立于 / 一直相信"型 lead）
2. 每个阶段的两/三条路 + 谁反对什么 / 反对原话
3. ≥ 1 次"我们砍了 X 因为 Y"的具体砍掉记录（含 commit / 时间 / 触发条件）
4. ≥ 1 段团队具名人原话引语
5. 当前真实数字快照（基数 + 时间）
6. 还没解决的问题 + 一个真问号

**其它体裁**用通用读者预期 set：进具体场景、有具名细节、有数字 + 基数、不撒谎、有结尾。

**这套 set 是 placeholder 起点**——agent 读到中段如果发现一条预期"不再合适"（比如这篇压根没有阶段结构），可以从 set 里摘掉。set 是 dynamic 的不是 hard-coded 的。

### 3.4 加减分规则（粗标尺，不细抠）

逐段读，每段结束后更新两轴。不是每段都要扣或加——很多段是 "0 变化"的中性。

**耐心扣减**：

| 触发 | 变动 |
|---|---|
| 开头 100 字未进具体场景 | −10 |
| 段落悬空（前段提出预期此段不解决也不明告下文给）| −10 |
| 阶段标题空标签（探索期 / 成长期 / 问题分析）| −15 |
| 阶段标题事件型（"上线那一周 / DAU 破千那天"——只剩纪念，不告诉读者分叉路口）| −15 |
| 同一意思反复说 / 字数撑场 | −5 |
| 跳读到后面也无内容补预期（即"不是放后面，是真没有"）| 一次性 −50 |
| 走完全文每条仍未满足的预期 | −15 / 条 |

**耐心加分**：

| 触发 | 变动 |
|---|---|
| 出现明确结构信号（"两条路 / 第一反应 / 真相段 / 我们砍了"）| +5 |
| 段落新信息密度高、推进了至少一个未满足预期 | 0（不扣） |

**信任扣减**：

| 触发 | 变动 |
|---|---|
| 营销词 / 公关腔（直觉判断，**不查词表**——你读到觉得像 PR 文）| −10 |
| 藏名（某主流大模型 / 某领先厂商 / 我们使用的开源框架）| −15 |
| 裸百分比 / 倍数无基数 | −10 |
| 升华金句（"这次让我们更深刻地理解了…"）| −20 |
| 隐蔽 hero（"信任变得更深 / 容忍度提升 / 更难但更正确 / 北极星理念"——不挂载具体物的抽象升华）| −20 |
| 戏剧化烘托（后背发凉 / 倒吸一口凉气）| −10 |
| 教程腔标题（一/二/三、问题分析/解决方案/总结）| −50 |
| CTA / 文末签名 / "this is just the beginning" | −80 |

**信任加分**：

| 触发 | 变动 |
|---|---|
| 具名报错 / 真版本号 / commit hash | +10 |
| 真原话 + 说话人 | +10 |
| 自承"猜错了 / 没看到 / 想当然 / 我以为 / 漏看了" | +10 |
| 数字带基数 + 时间 | +5 |

**判别原则**：A 轨不查词表。"这是不是营销词"由读者直觉决定——你读到一句话脑子里冒出"这话像产品发布稿在卖东西"，扣 −10 信任，不需要找词表确认。这是 A 轨独立于 B 轨的全部价值。

### 3.5 跳读"逃生"机制

如果某段不满足任何当前未满足预期，**不直接扣 −10**。先继续读下一段，看后面会不会回填。具体做法：

1. 段 N 读完，未满足预期 set 不变，**不扣**，但标记"段 N 悬空"。
2. 段 N+1, N+2 继续读。如果某段满足了 set 里某条，回头追溯——是不是段 N 在为这条做铺垫？是 → 段 N 不算悬空，正常推进。
3. 走到全文结尾，如果"段 N 悬空"标记仍未被回填、且没满足任何 set 条目，**全文一次性扣 −50 耐心**（这是真的没有，不是结构调换）。

这模拟"读者读到一段没东西看，会先跳到下一段，但读完才意识到这段是真的没有"。

### 3.6 A 轨输出 schema

```
# A 轨：读者轨迹

体裁：<踩坑记 | 养成记 | 其它>
起点：耐心 <X>, 信任 <Y>

## 段级 trajectory

| 位置 (L行号 / 段标题) | 段后耐心 | 段后信任 | 关键变动 reason |
|---|---|---|---|
| L1–L8 (frontmatter + lead) | 95 | 110 | 开头进具体场景 ✓；K 原话 +10 信任 |
| L10–L25 (第 1 阶段) | ... | ... | ... |

## 走完全文未满足预期

- <预期 X>: <为什么没满足；扣 −15 耐心>
- <预期 Y>: <...>

## 终局

耐心：<final_patience> （起点 X，扣 N，加 M）
信任：<final_trust> （起点 100，扣 N，加 M）

verdict: <PASS | FAIL>
理由：<≤ 50 字——哪一轴归零 OR 两轴均 > 0 但其中一轴较低>

## 一句定性总评（≤ 80 字）

读完我<信不信作者真去过 / 想不想转给同事 / 哪句让我不舒服 / 整篇感觉像什么>。
```

**verdict 规则**：

- **A PASS** = 耐心 > 40 **AND** 信任 > 50（两轴都得在阈值之上）
- **A FAIL** = 耐心 ≤ 40 **OR** 信任 ≤ 50（任一轴跌到阈值以下）

为什么不是"任一轴 ≤ 0"：r4 实测真案例发现 PR 通稿 / 资讯水文要扣到 0 需要踩 8-10 个具体扣分点，野外文章往往扣到 15-30 区间就停了——读者直觉上已经"读不下去 / 不信"，但数字没归零。把阈值从 0 上提到 40/50，对应"读者已经明显不耐烦 / 显著失信"的临界点。理由写明哪一轴跌穿 + 关键扣分点。

校准依据见 `goal-docs/r4-real-cases-results.md` — meituan PR 通稿耐心 15、gpt6-leak 信任 15 都是阈值正下方典型样本。

---

## §4 — B 轨 spec（反模式 catalog，sub-agent B 读这一节）

### 4.1 B 轨 sub-agent 的 prompt 模板

```
你是 tranfu-site 反模式 catalog 检查器。任务：对这篇 <体裁> 跑六族 lens walk
+ 结构核对 + grep 守护，输出违规清单 + verdict。

**只做语言层 catalog 检测**——不做整体气质判断（那是 A 轨的事，与你无关）。

体裁：<踩坑记 | 养成记 | 其它>
文章路径：<path>

按 §4.2–§4.6 执行。
```

### 4.2 六族反模式镜面扫读（按段过文）

按段通读全文一次，对每段问六族 lens 各一次。命中即记入违规候选。**不依赖关键词触发**——lens 问题就是反模式行为本身的判别条件。

**六族**：

| 族 | Lens question | 关联 grep（§4.5）|
|---|---|---|
| **2.1 抽象代替具体** | 把这一段里所有的形容词、价值判断词、感悟词圈出来。删掉它们后剩下的事实够支撑这一段存在吗？不够 → 必改。子型：理解了价值（06§6 病句 1）/ 团队成长（病句 2）/ 更难但更正确（病句 3）/ 信任·默契（病句 4）/ 理念·北极星（病句 5）/ 升华金句 / 形容词代替数字 | grep `理解.*价值\|真正的价值\|容忍度.*提升\|团队.*成长\|更难.*更正确\|信任.*更深\|默契\|北极星\|理念.*始终` |
| **2.2 PR腔代替工程腔** | 这段话搬到产品发布稿能无缝衔接吗？能 → PR 腔。子型：营销虚词 / 升华虚词 / 含糊连接 / 公关腔 / hero 句式 / 第三人称自指 / 戏剧化烘托 / 假谦虚 / 致谢 | 见 `禁用词.md §1,2,3,4,6,7,9,11,14,15` |
| **2.3 教程模板代替试错链** | 把 H2/H3 标题里的具体名词换成 X：标题还告诉读者作者当时在哪个分叉路口吗？分叉路口 = 合法；事件型 = 必改；空标签 / 教程腔 / PR 三段式 = 退稿 | grep §4.5.3 |
| **2.4 藏名/含糊代替具名** | 主语 / 时间 / 模型 / 工具 — 有没有可换成"某某 / 一段时间"而不影响表面意思的成分？有 → 没具名。白名单：客户行业脱敏到大类（某零售客户 OK）；自责语气"应该 / 想必"；"最近"用于代码字段历史背景 | grep §4.5.1, §4.5.2 |
| **2.5 Happy ending** | 把结尾 2 段 + 全文最后 1 句删掉，改成"还没解决，先这么扛着"——整篇还成立吗？不成立 → 退稿（结尾撑场）。子型：客户满意 / 鸡汤升华 / 文末 CTA / 抽象使命句 | grep §4.5.4, §4.5.5 |
| **2.6 缺证据：声称代替展示** | 每条声称对应至少一项：fenced code block / blockquote 引语 / 数字带基数和时间 至少 2/3。挂不上 → 必改。子型：无原文 / 截图代替原文 / 无量化数字 / 裸百分比无基数 / 无时间锚 | grep §4.5.6 + §4.6 百分比后处理 |

**严重度规则**：

- 教程腔 H2 标题 / 空标签 H2 / 文末 CTA / 跨度 < 2 月养成记 / 客户故事当主线 = **退稿**
- 多数 PR 腔子型 / 隐蔽 hero / 藏名 / 缺证据 = **必改**
- 同 H2 section ≥ 3 处裸百分比无基数 = **退稿**（密度规则）
- 单次升华虚词且句义独立 = **建议**

### 4.3 结构核对（仅踩坑/养成）

**踩坑记必须有**（缺一项即退稿）：

1. 错误信息 / prompt / 模型回答原文，三者至少 2 样原样贴出
2. ≥ 3 个相对时间锚点（周X/早晚/第N天/YYYY-MM-DD）
3. 模型具名到版本号
4. ≥ 2 个"试错链"H3 小节（含"以为 / 怀疑 / 猜 / 第 N 反应"）
5. ≥ 1 个量化数字
6. 真相段含"为什么前面没看到"

**养成记必须有**（缺一项即退稿）：

1. frontmatter `timespan` 字段且跨度 ≥ 2 个月（算法：parse "YYYY-MM ~ YYYY-MM"，月数 < 2 → 退稿）
2. ≥ 3 个 H2 阶段章节，每个含 YYYY-MM
3. 每个阶段标题是决策 / 选择（替换测试）
4. ≥ 1 次"砍了/放弃了/删掉了"+ 原因
5. ≥ 3 处带基数的真实数字
6. ≥ 1 段他人原话 + 说话人
7. ≥ 2 张原始物料截图（实际 `![...](...)` 标签，不只是文中提到）
8. 结尾三块齐全（当前状态 + 还没解决 + 真问号）
9. 文末 `本文最后事实更新：YYYY-MM-DD`

**timespan 算法**：parse start/end → months = ey*12+em - sy*12-sm；< 2 退稿。例：`2024-08 ~ 2024-09` = 1 < 2 = 退稿。

### 4.4 必须没有 — 已被六族 lens 覆盖

营销虚词 / 公关腔 / hero / CTA / 戏剧化烘托 / 含糊时间 / 藏名 → §4.2 §2.2 / §2.4 / §2.5；升华金句 / Happy ending → §2.1 / §2.5；教程腔小标题 / 标题 emoji → §2.3。

### 4.5 grep 守护（覆盖网，命中后用 §4.2 lens 二次判定）

**4.5.0 语种**：`grep -cE "[一-龥]" <target>` vs `grep -cE "[A-Za-z]" <target>`，比例决定中/英分支。

**4.5.1 含糊时间**：`grep -nE "前段时间|最近|不久前|近期|某天|某次|曾经|从前" <target>`

**4.5.2 模糊指代（藏名）**：`grep -nE "某(主流|领先|大|LLM|Agent|闭源|开源)" <target> | grep -v "某(零售|金融|教育|医疗|制造|互联网|游戏|物流|能源)客户"`

**4.5.3 教程腔/空标签/PR 三段式 H2**：

中文：`grep -nE "^##* .*(问题分析|解决方案|总结与反思|经验总结|思考与启示|我们的初心|探索期|成长期|突破期|总而言之|核心创新|技术方案|实际成效|关键发现|核心优势|应用场景)" <target>`

英文：`grep -nEi "^##* .*(problem statement|the solution|takeaways?|conclusions?|lessons learned|our journey|exploration phase|growth phase|breakthrough phase)$" <target>`

**4.5.4 中文 CTA（退稿）**：`grep -nE "欢迎联系|了解更多|立即体验|敬请期待|详见下篇|扫码关注|私信我|联系我们|contact@" <target>`

**4.5.5 英文 CTA + 营销聚合**：

```bash
grep -nEi "contact us|learn more|get started|sign up|try it now|get in touch|reach out|subscribe (now|here|to)|click here|visit our|follow us|buy .* at|order now|available at|on my( art)? store" <target>
grep -nEi "revolutionary|groundbreaking|game-?changer|cutting-edge|state-of-the-art|next-generation|paradigm shift|unleash|supercharge|democratize|seamlessly|effortlessly|unprecedented|world-class|industry-leading|best-in-class|transformative|unparalleled|ushering in|this is just the beginning|what'?s next|stay tuned|paving the way|our (mission|vision|north star)|doubled down" <target>
```

**4.5.6 标题 emoji**：`grep -nE "^##* .*[⚠💡🔥✨🚀🎉🔍📌]" <target>`

**4.5.7 不确定性句式**：`grep -nE "应该|想必|理论上" <target>` —— LLM 看作者承不承认不确定（自责 = 鼓励，掩饰 = 必改）

**4.5.8 中文聚合**：见 `禁用词.md` 文末聚合 grep；命中后 §4.2 二次判定。

### 4.6 百分比/倍数后处理

```
for each hit_line matched by `[0-9]+(\.[0-9]+)?%|[0-9]+ ?倍`:
    section = lines[max(0, hit_line-5) : hit_line+6]
    if not regex_match(section, "从 \d+|\d+ ?(行|个|条|次|秒|分钟|小时|天|周|月|人|家|\$|￥|元)"):
        record violation(line=hit_line, type="百分比无基数", level=必改)

# H2-section density:
group violations by H2 section (between two ^## headers; ^# 与 ^### 不切段，仅 ^## 切段)
for each section s with ≥ 3 bare-percentage violations:
    upgrade all to 退稿
```

### 4.7 B 轨输出 schema

```
# B 轨：catalog 命中

体裁：<踩坑记 | 养成记 | 其它>

## 退稿级
- L<行号> | <族 + 子型> | source: <doc§sec #n>
  > <原句 ≤ 60 字>

## 必改级
- L<行号> | <族 + 子型> | source: <doc§sec #n>
  > <原句 ≤ 60 字>
  改写：<≤ 30 字一句话替换>

## 建议级
- L<行号> | <现象> | source: <doc§sec #n>

## 必须有清单核对（仅踩坑/养成）
| # | 检查项 | 状态 | 缺项详情 |
|---|---|---|---|
| 1 | ... | ✓ / ✗ | ... |

## 终局
退稿级 N 处 / 必改级 M 处 / 建议级 K 处

verdict: <PASS | FAIL>
- B PASS = 0 退稿级命中（必改 / 建议条数不影响 PASS，只作为附加信息）
- B FAIL = ≥ 1 退稿级命中
```

---

## §5 — 三态合判（主 agent 执行）

```
A verdict / B verdict   →   整篇合判
PASS    /   PASS        →   可发
PASS    /   FAIL        →   待审查
FAIL    /   PASS        →   待审查
FAIL    /   FAIL        →   退稿
```

**合判说明**：

- **可发**：两轨都过。可能仍有 B 必改建议——作者按建议改后即可发布。
- **待审查**：两轨意见不一致。值得人审：
  - A FAIL + B PASS = 语言层干净但读起来像空文（fluent-but-empty）。catalog 抓不到，读者会失耐心 / 失信任。
  - A PASS + B FAIL = 读起来还行但有硬约束违规（如文末 CTA 但其余写得真）。语言层不达标但内容有东西。
- **退稿**：两轨都 FAIL。语言垃圾 + 读起来空——经典 PR 通稿型。

---

## §6 — 报告 schema（主 agent 汇总）

```markdown
# 审稿报告：<filename>
体裁：<踩坑记 | 养成记 | 其它（<类型>）>
合判：<可发 | 待审查 | 退稿>

A 轨 (读者模拟)：<PASS | FAIL>，终局 耐心 <X> / 信任 <Y>，未满足预期 <N> 条
B 轨 (反模式 catalog)：<PASS | FAIL>，退稿级 <N> 处 / 必改级 <M> 处 / 建议级 <K> 处

---

## A 轨详情

<sub-agent A 完整输出，照原样贴入>

---

## B 轨详情

<sub-agent B 完整输出，照原样贴入>

---

## 待审查说明（仅当合判 = 待审查 时）

A 和 B 意见不一致：<具体说明哪一轨 PASS 哪一轨 FAIL，以及为什么这种分歧值得人审>。
```

**0 emoji，0 分数（双轴标量是诊断不是评级），0 软化语**。改写示范 ≤ 30 字一行。

---

## §7 — 给主 agent 的硬约束

1. **必须用 Agent 工具起两个独立 fresh sub-agent**——不要自己同时假装 A 和 B 跑两遍。两轨独立的全部价值在于"读规则书的 agent 和不读规则书的 agent 是两个不同 context"。
2. **A 轨 sub-agent prompt 不得包含 §4 / 反模式 catalog 内容**——会污染 A 的独立直觉。A 只读 §3。
3. **B 轨 sub-agent prompt 不得包含 §3 内容**——B 只跑 catalog。
4. **不要自己改文章**。skill 是诊断器，不是治疗器。
5. **不要美化报告语气**。直接说"退稿 / 待审查 / 可发"，不说"建议进一步打磨"。
6. **不要在报告里加 emoji**。
7. **三态合判按 §5 表格执行**——不要自己发明第四态。
8. **每条 B 轨违规必须有 source 字段**。
9. **build 自检**：本 SKILL.md 自跑禁用词聚合 grep 应仅命中讨论性举例（表格 / 引号 / 反引号包裹 / 代码块内）；若命中裸句子使用，重写。

---

## §8 — 自检快捷指令

```
跑自检：
1. 让 Claude 对 examples/ 下每个文件按本 SKILL.md 跑双轨。
2. 比对 examples/EXPECTED.md 中预期合判（可发 / 待审查 / 退稿）。
3. 报告：合判一致率 / A 轨 verdict 一致率 / B 轨 verdict 一致率 / 单一 verdict 误报。
```

关键样本：

- `bad-养成记-2-hidden-hero.md`：catalog 0 退稿但 A 轨应在 5 处隐蔽 hero 时 信任 ≤ 0 → 合判**待审查**（v1/r3 误判为"必改 9 处"）。
- `bad-养成记-3-fluent-empty.md`（r4 新增）：catalog 0 命中但 A 轨耐心因预期悬空归零 → **待审查**。这是 A 轨独有抓的——B 轨 0 命中。
- `bad-踩坑记-1-marketing-fluff.md`：A 轨教程腔标题 −50 信任 直接归零，B 轨 CTA + 教程标题 退稿 → 合判 **退稿**。
- `good-踩坑记-baseline.md`：两轨都 PASS → **可发**。

漏抓即 skill 漏抓，需要回 SKILL.md 调 §3 / §4；误抓需要紧 lens question 或调 grep。
