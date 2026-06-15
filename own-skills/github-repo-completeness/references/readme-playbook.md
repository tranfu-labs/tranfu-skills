# README playbook

> project-packaging skill 在 README 状态为 **MISSING / WEAK** 时引用本文件作为写作 / 优化规范.
> 沉淀来源: tranfu-skills PR #89 的措辞清理 + 首句重写实操.

---

## 1. 结构 (按需启用)

按从上到下顺序. 每节标注**可省条件**, 标 ⛔ **永留**.

### 1.1 首屏

| 元素 | 作用 | 可省条件 |
|---|---|---|
| Logo / wordmark | 品牌识别 | 没正式品牌资产时**省**, 不要硬造 |
| H1 标题 | 仓库名 | ⛔ 永留 |
| Badges (version / CI / runtime / license) | 状态信号 | 私有仓 / license 实为 internal 时不假造 |
| 一句话定位 / 价值主张 | 决定读者去留 | ⛔ 永留 — 首句是流失/留存分水岭 |
| Quick nav (4-5 个锚点) | 长 README 跳转 | < 200 行可省 |

**Logo 渲染** (有正式资产时必守):

- 居中 `<p align="center">`, 宽度 `width="260"` 上限. 比这宽会压过 H1.
- 有 lockup (logo + wordmark) 资产**必用**, 不退化为单 symbol — 单 symbol 在 GitHub trending / npm 搜索结果里识别度差.
- 默认单图 (用品牌方彩色 lockup); 只有 mono 变体时才上 `<picture>` + `prefers-color-scheme` 切换.

```html
<p align="center">
  <img src="./assets/brand-lockup.svg" alt="BrandName" width="260">
</p>
```

### 1.2 为什么用它 (why-use)
3-5 条短价值, 回应"为什么不自己写". 一句话定位足够强时可省. 内部仓库一般保留.

### 1.3 已支持能力 checklist
`- [x]` 列表, 帮读者扫读判断"我要的功能在不在". 单功能项目可省, 多功能/工具链**必留**.

### 1.4 适合谁 / 角色入口
角色 → 推荐入口的 2 列表. 用户类型单一时可省.

### 1.5 安装前提
runtime 版本 / 权限 / 网络要求. ⛔ **永留** — trouble shooting 第一道防线.

**例外**: 若 quick start 命令已隐含 runtime (e.g. `npm install` / `cargo build` / `pip install`), 可在 quick start 行内直接标注版本 (e.g. `npm install   # Node ≥ 20`), 不必另起小节. 但**有权限 / 网络 / 系统库**等隐含命令外的前提时仍要单独列.

### 1.6 一次性 bootstrap / quick start
最小可用步骤 (一行 shell / 一段 prompt / 一段 SDK 代码). ⛔ **永留**.

### 1.7 运行环境矩阵
单平台项目可省.

### 1.8 它怎么工作 (架构图)
mermaid / SVG. 一句话能讲清的可省, 涉及"多 actor / 分发→使用→反馈"流程的保留.

### 1.9 怎么用 / 常用工作流
按角色或场景分小节. README 主体. ⛔ **永留**.

### 1.10 catalog (当前有哪些 X)
仅集合类仓库 (skill 库 / 模板库 / awesome-list / theme 库) 保留, 普通工具项目省.

### 1.11 目录和安装模型
仓库内目录布局 + 安装产物布局. 安装产物单一时可省.

### 1.12 发布和维护约定
frontmatter 字段表 / PR 流程 / 本地校验命令 / CODEOWNER. 不接受外部贡献时可省.

### 1.13 文档职责矩阵
`INSTALL.md` / `UNINSTALL.md` / `CHANGELOG.md` 等"什么时候看"表. README 是唯一入口时省.

### 1.14 安全边界
涉及外部代码 / 跨信任域时保留, 纯内部封闭项目可省.

### 1.15 License
⛔ **永留**. 没 license = 无授权. 内部使用也写 "internal use only".

**元原则 — 这节能不能省, 问 3 个问题**:
1. 这节回答了某类读者的某个**真实**问题吗?
2. 不在这节回答, 读者去哪儿找答案?
3. 答案如果是"下面就讲" — 那这节就是冗余.

---

## 2. 首句价值优先

第一句决定读者是否往下读. 先说"我有什么 / 给谁用", 再说"怎么分发".

**反例 (机制优先)**:
> X 库. 通过 npm CLI Y 分发, 通过 meta-skill 使用, 不再需要手动 git clone.

**正例 (价值优先)**:
> X 库 — 当前 15 个原创 + 9 个精选, 覆盖 A/B/C 等场景, 按日常使用反馈持续迭代.
>
> 通过 npm 包 Y 分发, ...

检查点:
- [ ] 第一句回答 "这跟我有什么关系"?
- [ ] 是否量化 (具体数字 vs "大量"模糊词)?
- [ ] 覆盖领域是否列出 (帮读者自检相关性)?
- [ ] 是否有 "持续维护" 信号 (vs 半死项目)?

---

## 3. 措辞 5 类检查

### 3.1 内部黑话 / 自造词
团队约定俗成但新读者看不懂. 删了不影响理解的就删.

| 类别 | 案例 | 替换思路 |
|---|---|---|
| 隐喻 | 装机戳 / 薄指针 / 薄镜像 | 由本工具安装的 / 外部引用 (安装时拉取) |
| 企业味 | 审计痕迹 / 探针期 | 本地记录 / 试运行 |
| 半隐喻动作 | 回填 / 探测 / 兜底 | 写入 / 识别 / 绕过权限问题 |
| 内部代号 | r2 试运行 / v0.4 alpha | 删代号, 保留状态词 |

### 3.2 中英混拼
有中文对应就用中文; 真术语 (npm/PR/frontmatter) 保留英文.

| 案例 | 替换 |
|---|---|
| runtime / scope / install 时 | 运行环境 / 安装级别 / 安装时 |
| User 级目录 / 当前 project | 用户级目录 / 当前项目 |
| rolling release / soft-fail | 滚动发布 / 不阻断 |
| **保留**: frontmatter, tfs, CLI, PR, npm, badge | 命令名 / 无对应中文 |

判断保留: 翻成中文后**是否切断对代码/配置字段的对应**? 如 `origin: external` 这个 frontmatter 值, 正文指代时必须保留 `external`.

### 3.3 术语堆叠
一句话塞 3+ 个产品术语 + 抽象动词.

反例: "通过自然语言驱动 meta-skill 完成搜索 / 安装 / 发布"
改后: "装完后在 Claude / Codex 对话里用自然语言完成搜索、安装, 以及通过 PR 发布"

### 3.4 Publisher 视角的不可控信号
涉及 "发布 / 部署 / 推送" 动作时, 容易让读者担心 "AI 黑盒一把梭". 要明示:

- 是否走 PR (vs 直接 push)
- 是否需要确认 (vs 自动执行)
- 是否可中止 (vs 一旦开始无法回退)

例: "用自然语言完成发布" → "用自然语言完成 ... , 以及**通过 PR 发布**"

### 3.5 公开营销词
不用: 强大 / 革命性 / 改变游戏规则 / next-gen / 业界领先 / 一站式.

---

## 4. 反例 — 不要做的

- 加 emoji / 装饰
- 加 contributor 头像墙 / Discord banner / star CTA (内部仓库不需要)
- 强行造 logo (没正式资产就用文本标题)
- 把后面章节细节提到首屏 (catalog 表 / 安装步骤 / publish 流程)
- 加 MIT / Apache license badge 而 license 实为 internal
- 公开营销词

---

## 5. WEAK 路径 — 优化已有 README 的 micro-slice 流程

**准备**:
1. 找用户画像文档. 路径示例: `<repo>-goal-docs/00-用户画像-*.md`. 没有就先列 2-4 个典型用户.
2. 收集 2-3 个**定位接近**的对标 README (不一定竞品), WebFetch 即可不 clone.
3. 通读现状, 用第 1-4 节列可疑项, 做成 diff 表:

| 位置 | 现状 | 建议 | 理由 (哪条原则 / 哪个对标) |
|---|---|---|---|

提交前**至少自反思 1 轮** — 通常会再抓出 20-30% 漏掉的.

**每片 micro-slice**:
1. 应用 1-3 处 Edit (不重写整文件)
2. 启 **fresh** validation agent — 喂用户画像路径 + 当前 README 路径, 让它 roleplay 评判
3. 看 agent 反馈分级 (**必改 / 建议改 / 可不改**)
4. 必改即改, 建议改有取舍, 可不改跳过
5. 如有改动, 重启 fresh agent (避免 confirmation bias)
6. 全过则 stop

**止损**: 最多 3 轮. agent 开始挑细枝末节就说明边际收益递减.

**validation agent prompt 必须限制**:
- 给具体可执行 diff (原 → 新), 不允许"全部重写"
- 报告字数上限 (e.g. 500 字)
- roleplay 持指定用户画像, 不脱离

---

## 6. MISSING 路径 — 从零生成

SubAgent 喂入本 playbook + 项目信息 (技术栈 / 仓库类型 / 目标读者), 输出 MUST:

- 按第 1 节"可省条件"裁剪后的结构 (不要无脑铺全 15 节)
- 第 2 节首句 4 个检查点都过
- 第 3-4 节的反例都避开
- 至少一个真实 badge (CI 状态或版本号, 不假造)
- License 引用 (与项目实际 LICENSE 一致)

生成后**仍走第 5 节 micro-slice 流程**做一轮 validation, 不直接交付.

---

## 7. 常见陷阱

### 7.1 CI path filter + required check 错配
若 branch ruleset 把某个 check 设为必需, 但该 check 的 workflow 有 `paths:` 过滤, 非命中路径的 PR 会永远 `BLOCKED`. 修法: 删 path filter 让它总跑 (前提: validate 脚本支持 changed-only mode, 无变更时 exit 0).

### 7.2 squash merge 后的"幽灵冲突"
feature branch 被 squash merge 到 main 后, 追加新 commit push 会和 main 假冲突. 修法: `git merge -X ours origin/main`.

### 7.3 agent 给"全部重写"建议
validation agent 容易给不可执行的整段重写建议. prompt 必须明确禁止 + 限字数 (见第 5 节).
