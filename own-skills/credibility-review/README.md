---
prompt_examples:
  - prompt: 帮我看下这篇稿子, 看能不能发。
    scene: 粘草稿
  - prompt: 审下 tranfu-site/src/content/posts/踩坑-mcp-调不通.md, 抓一下问题。
    scene: 指定路径
  - prompt: 这篇像不像 PR 通稿, 有没有升华金句和隐蔽 hero, 帮我抓一下。
    scene: 风格担忧
  - prompt: review this english research post — is it citation-heavy PR fluff?
    scene: 英文体裁
  - prompt: 我 tag 挂的养成记但只跨了一个月, 你先判体裁再说能不能发。
    scene: 体裁边界
  - prompt: tranfu-site/src/content/posts/ 下所有草稿, 逐篇双轨审并汇总。
    scene: 批量审
---

# 文章可信度审稿

审一篇草稿读起来像不像营销号——双轨独立诊断, 三态合判 (可发 / 待审查 / 退稿), 仅诊断绝不重写。

![双轨审稿工作流](./workflow.svg)

## 什么时候用它

**粘草稿**:

我写完一篇踩坑记 / 养成记, 发前担心读起来像 PR 通稿 / 公众号水文, 想让 skill 抓一下问题。

**指定路径**:

我把稿子放在 `tranfu-site/src/content/posts/` 下, 说「审下这个路径」, 让 skill 自己去读文件。

**风格担忧**:

我明确说「像不像营销号 / 有没有升华金句 / 隐蔽 hero」, 想让 skill 顺着我的怀疑往下抓。

**英文体裁**:

我审的是英文行业 essay / postmortem / research post, 想让 skill 走英文 grep 分支跑 catalog。

**体裁边界**:

我 tag 挂了养成记但跨度只有一个月, 想让 skill 先判体裁再决定跑哪套结构核对。

**批量审**:

我一次给一批 posts 目录, 想让 skill 逐篇跑双轨、逐篇合判, 一次性把全部问题报回来。

**不接**:

要重写 / 润色 / 扩写 → 那是编辑的活, 本 skill 只诊断; 「全文点评 / 建议从几个维度展开」→ 不接 (点评常滑向鼓励式改稿); 给已发布文章打星级 / 分数 / 排序 → 不接 (双轴标量是诊断不是评级)。

## 它会产出什么 / 你会看到什么

**只诊断, 绝不改稿——skill 是诊断器不是治疗器**, 最反常识的一点。

- **起两个 fresh sub-agent**: A 轨读 §3 用读者直觉扫, B 轨读 §4 用反模式 catalog 扫, 两轨互不可见对方 prompt, 独立判断——不是同一个 agent 跑两遍
- **A 轨输出**: 双轴 耐心 / 信任 段级 trajectory + 未满足预期清单 + 终局 verdict + 一句定性总评
- **B 轨输出**: 退稿级 / 必改级 / 建议级 catalog 命中清单, 每条带行号 + 原句 + `source: <doc§sec>` 字段
- **三态合判**: 两 PASS → 可发; 两 FAIL → 退稿; 一 PASS 一 FAIL → 待审查 (附「两轨为何分歧」的人审说明)
- **报告落终端**: 打印到聊天窗口, 0 emoji, 0 分数, 0 软化语——不写「建议进一步打磨」这类
- **绝不会做**: 改原文一个字符; 打星级 / 排序; 推送到任何地方; 判到严重违规就提前终止 (一次报全)

## 前置条件 / 边界

**前置**:

目标 markdown 路径可读, 用原始路径不复制到 `/tmp`; 审踩坑记 / 养成记需能访问规则源 `tranfu-site/goal-docs/05-design-踩坑记-final.md` 与 `06-design-养成记-final.md`; grep 用 BSD (macOS 默认) 或 GNU ≥ 2.6, 不依赖 PCRE / `-P` / `\b` / `\d` / `\w`。

**不接的场景**:

- 要重写 / 润色 / 扩写文章
- 要「全文点评 / 建议从几个维度展开」
- 给已发布文章打星级 / 分数 / 内容运营排序

**微妙边界**:

- 问「看下能不能发 / 抓一下问题」→ 触发; 问「给我个 SEO 分」→ 不触发 (那是内容运营)
- 问「像不像 PR 通稿 / 营销号」→ 触发双轨直觉+catalog; 问「整体点评一下」→ 不触发 (点评常滑向鼓励式改稿)
- tag 挂养成记但跨度 < 2 月 → skill 会在 B 轨结构核对里直接判退稿, 不硬凑
- 非踩坑 / 养成体裁 (资讯 / postmortem / essay) → B 轨跳过结构核对但仍跑反模式 catalog, A 轨用通用读者预期
