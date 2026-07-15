---
description: "扫已有 GitHub repo, 出 P0-P3 缺失清单, 按优先级逐项引导补齐——你点头再动手, 绝不一次性代你全生成。"
prompt_examples:
  - prompt: 帮我看看这个项目还缺什么, 准备开源。
    scene: 准备开源发布
  - prompt: 扫一下项目完备性, 先给我个 P0-P3 清单看看。
    scene: 全面检查仓库
  - prompt: 这个 repo 缺 CI 和 issue 模板, 帮我补一下。
    scene: 补充 CI 模板
---

# GitHub 项目完备性

扫已有 GitHub repo, 出 P0-P3 缺失清单, 按优先级逐项引导补齐——你点头再动手, 绝不一次性代你全生成。

## 什么时候用它

**准备开源发布**:

项目要上 GitHub / 准备开源, 想让 skill 先扫一遍, 缺什么给我个清单, 我挑重要的补。

**补漏具体项**:

我知道缺 README / LICENSE / CI / issue 模板, 想让 skill 按栈推荐做法一步步引导我。

**全面检查仓库**:

项目跑了半年, 想定期看看结构还完不完整, 哪些项漂移到 WEAK 了。

**批量检查仓库**:

时间紧, 直接说「全部按默认」, 让 skill 一次跑完, 最后一起审。

**不接**:

从零起草 PRD → **write-spec**; 新项目冷启动整套文档 → **project-init-docs**; 打 tag / 发版 → **release**; 部署上线 → **coolify-deploy**; scaffold 空项目骨架 → 走脚手架类 skill。

## 它会产出什么

**默认逐项确认, 绝不一次性生成——除非你明说「全部按默认」**——最反常识的一点。

- **P0-P3 清单表**: 四列 = 优先级 / 项目 / 状态 (OK / WEAK / MISSING / N/A) / 说明
- **逐项引导**: 每项先问偏好 (哪种协议 / CI 到什么程度 / 要哪几种 issue 模板), 再动笔生成
- **落盘文件**: 视选择可能新增 `README.md` / `LICENSE` / `.gitignore` / `CONTRIBUTING.md` / `CHANGELOG.md` / `.github/workflows/ci.yml` / `.github/ISSUE_TEMPLATE/*.yml` / `.github/pull_request_template.md`
- **收尾复扫**: 重跑扫描确认本轮选中项已从 MISSING / WEAK 转成 OK, 汇总产物给你最终签字
- **绝不会做**: 替你选 License 类型 / 打 tag 发版 / push 到 remote / 未经同意就把所有缺失文件都写掉

## 前置条件与边界

**前置**:

cwd 必须是 git repo 根 (`git rev-parse --show-toplevel` 命中且 == pwd); 不在 repo 内会停下等你确认。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 从零起草 PRD / 需求文档 | **write-spec** |
| 新项目冷启动整套文档 | **project-init-docs** |
| 打 tag / 写 changelog / 发版 | **release** |
| 部署上线 | **coolify-deploy** |
| 发布 skill 到公司库 | **tranfu-publish** |

**不接的场景**:

- 写代码 / 修 bug / code review
- scaffold 全新空项目骨架 (走脚手架类 skill)
- 修改 GitHub 远端 metadata (description / topics)

**微妙边界**:

- 单语言栈最稳; monorepo 或多语言混合时 skill 会让你点名主栈, 绝不自动猜
- License 一律「问你, 绝不替选」; 想省事就明说「就用 MIT」, 别指望默认
