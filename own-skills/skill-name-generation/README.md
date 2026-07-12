---
prompt_examples:
  - prompt: 帮我给这个 skill 起个中英文 display_name，description 我贴给你。
    scene: 新起单条
  - prompt: own-skills/ 下这批 skill 都还没 display_name，帮我按同一套规约批量补齐。
    scene: 存量批量
  - prompt: 给 skill-content-fit 起个 display_name 和 display_name_zh。
    scene: 显式指名
  - prompt: 这个 skill 现有的显示名读起来像解释，帮我重起一组更贴的。
    scene: 重起
  - prompt: 英文目录名是 lark-safe-write，主职是「写飞书前的一整套安全检查」，起个中英文显示名。
    scene: 贴信息起名
  - prompt: 读 own-skills/xxx/SKILL.md，帮我起个中英文显示名。
    scene: 读 SKILL.md
---

# skill-name-generation

给一个已有 skill 起中英文成对显示名, 一次产 1 推荐 + 3 备选, 只出候选文本, 不动任何文件。

## 什么时候用它

**新起单条**:

skill 刚起完英文目录名和 description, 我要在开头元数据里填 `display_name` / `display_name_zh` 两个字段, 想让 skill 一次配对给出候选。

**存量批量**:

仓库里一批老 skill 只有目录名没显示名, 我要按同一套规约批量回填, 中英文成对不错位。

**重起显示名**:

某个 skill 现有的显示名读起来像解释, 不像名字; 或者未来我想找回它时, 脑子里第一反应的词根本没落在名字里, 想看看有没有更贴的候选。

**只指路径**:

我不想复制粘贴目录名和 description, 直接把 `SKILL.md` 路径丢过去, 让 skill 自己从开头元数据摘。

**不接**:

起产品 / 功能 / 模块名 → **product-title-generation**; 起 skill 的英文目录名 (小写加连字符) → **skill-domain-framing**; 判断某段内容值不值得沉淀成 skill → **skill-content-fit**; 代码变量 / 函数 / 类命名、广告口号 / 营销文案 / SEO 标题 / 商标合规 → 直接不触发。

## 它会产出什么

**只出候选文本, 绝不动任何文件——写不写、写到哪, 由你自己决定**——最反常识的一点。

- **一次成对**: 1 推荐 + 3 备选, 每组 = `display_name` (英文, 首字母大写的短语) + `display_name_zh` (中文 4-8 字) + 一句理由 (必须指明核心词从 description 哪个短语抽出)
- **绝不会做**: 改动目标 skill 的 `SKILL.md` / `agents/openai.yaml` / `index.json` 或任何仓库文件

## 前置条件 / 边界

**前置**:

需要 skill 的英文目录名 + description 两条信息; 也可以只给 `SKILL.md` 路径, 由 skill 自己从开头元数据摘 `name` 和 `description` 两个字段, 不读正文。两者都缺就问一次, 再缺就停。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 起 skill 的英文目录名 (小写加连字符) | **skill-domain-framing** |
| 起产品 / 功能 / 模块的中文短标题 | **product-title-generation** |
| 编排 skill 创建的整套流程 | **skill-create-workflow** |

**不接的场景**:

- 代码变量 / 函数 / 类命名
- 广告口号 / 营销文案 / SEO 标题 / 商标合规
- 从零建 skill 骨架 (那是 **skill-create-workflow**)

**微妙边界**:

- 目标 skill 已有 `display_name` → 询问一次「重起还是保留」, 用户不确认就保留现状
- 英文目录名的后缀 (`-workflow` / `-set` / `-review`) 只作辅信号, 主职判定始终以 description 的首个能力动词为准
