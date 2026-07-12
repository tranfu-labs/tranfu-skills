---
prompt_examples:
  - prompt: 帮我给这个 skill 起个中英文 display_name，description 我贴给你。
    scene: 新起单条
  - prompt: own-skills/ 下这批 skill 都还没 display_name，帮我按同一套规约批量补齐。
    scene: 存量批量
  - prompt: 给 skill-content-fit 起个 display_name 和 display_name_zh。
    scene: 显式指名
  - prompt: 这个 skill 现有的 display_name 太抽象，帮我重起一组更贴的。
    scene: 重起
  - prompt: slug 是 lark-safe-write，主职是「写飞书前的一整套安全检查」，起个中英文名。
    scene: 贴 slug 起名
  - prompt: 读 own-skills/xxx/SKILL.md 的 frontmatter，帮我起个中英文显示名。
    scene: 读 SKILL.md
---

# skill-name-generation

给一个已有 skill 的 slug + description 起中英文成对显示名, 一次产 1 推荐 + 3 备选。

## 什么时候用它

**新起单条**:

skill 刚起完 slug 和 description, 我要在 frontmatter 里填 `display_name` / `display_name_zh` 两个字段, 想让 skill 一次配对生成。

**存量批量**:

仓库里一批老 skill 只有 slug 没显示名, 我要按同一套规约批量回填, 中英文成对不错位。

**重起显示名**:

某个 skill 现有显示名太解释感 / 触发对齐不好, 我想看看有没有更贴的候选, 换掉旧的。

**只指路径**:

我不想复制粘贴 slug + description, 直接把 `SKILL.md` 路径丢过去, 让 skill 自己从 frontmatter 摘。

**不接**:

起产品 / 功能 / 模块名 → **product-title-generation**; 起 skill 的 slug (kebab-case 容器名) → **skill-domain-framing**; 判断某段内容值不值得沉淀成 skill → **skill-content-fit**; 代码变量 / 函数 / 类命名、slogan / 营销文案 / SEO 标题 / 商标合规 → 直接不触发。

## 它会产出什么

**只出候选文本, 绝不动任何文件——写不写、写到哪, 由你自己决定**——最反常识的一点。

- **一次成对**: 1 推荐 + 3 备选, 每组 = `display_name` (英文 Title Case) + `display_name_zh` (中文 4-8 字) + 一句理由 (必须指明核心词从 description 哪个短语抽出)
- **绝不会做**: 改动目标 skill 的 `SKILL.md` / `agents/openai.yaml` / `index.json` 或任何仓库文件

## 前置条件 / 边界

**前置**:

需要 skill 的 slug + description 两条信息; 也可以只给 `SKILL.md` 路径, 由 skill 从 frontmatter 摘 `name` 与 `description` 两字段即止, 不读正文。两者都缺就问一次, 再缺就停。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 起 skill 的 slug (kebab-case 容器名) | **skill-domain-framing** |
| 起产品 / 功能 / 模块的中文短标题 | **product-title-generation** |
| 编排 skill 创建的整套流程 | **skill-create-workflow** |

**不接的场景**:

- 代码变量 / 函数 / 类命名
- slogan / 营销文案 / SEO 标题 / 商标合规
- 从零建 skill 骨架 (那是 `skill-create-workflow`)

**微妙边界**:

- 目标 skill 已有 `display_name` → 询问一次「重起还是保留」, 用户不确认就保留现状
- slug 形态词后缀 (`-workflow` / `-set` / `-review`) 只作辅信号, 主职判定始终以 description 的首个能力动词为准
