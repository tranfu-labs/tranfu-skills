# tranfu 命名约束

涉及 GitHub 仓库的场景共用这一份硬约定。约定本身简单，关键是它让后续整套自动化能稳定运行：

- 一眼看 URL 就能判定"是不是 tranfu 团队的仓库"。
- 仓库名就是 Coolify 里的 app 名 和 project 名（1:1 映射），不需要额外的映射表。
- 名字格式收敛，避免大小写、下划线、空格之类的边界 case 拖垮 jq 解析与 CLI 参数传递。

## 解析 GitHub URL

支持以下几种常见写法，都解析成 `${org}` 和 `${repo}`：

- `https://github.com/<org>/<repo>`
- `https://github.com/<org>/<repo>.git`
- `git@github.com:<org>/<repo>.git`
- `git@github.com:<org>/<repo>`

解析做完后忽略 `.git` 后缀。例：

| 输入 | org | repo |
|---|---|---|
| `https://github.com/tranfu-labs/foo-app` | `tranfu-labs` | `foo-app` |
| `https://github.com/tranfu-labs/foo-app.git` | `tranfu-labs` | `foo-app` |
| `git@github.com:tranfu-labs/foo-app.git` | `tranfu-labs` | `foo-app` |

如果输入既不是上面四种之一，也不能用简单正则提取出 org / repo，终止。返回文案：

> 看不懂这个 GitHub 链接：`<输入原文>`。本流程支持
> `https://github.com/<org>/<repo>(.git)?` 和 `git@github.com:<org>/<repo>(.git)?` 两类写法。

## 校验 1：组织必须是 tranfu-labs

```text
org == "tranfu-labs"
```

不匹配则终止。返回文案：

> 这个仓库属于 `<org>`，本流程只接 `tranfu-labs` 组织的仓库。
> 如果是其它组织的仓库要上 Coolify，请走通用 coolify CLI 流程或者扩展本 skill。

约定本身的意义：tranfu 团队的 Coolify 实例对应 GitHub App 只授权了 tranfu-labs 组织下的仓库。
跨组织的仓库即使勉强 onboard 上去，GitHub App 也看不到、推送事件也不会触发自动部署。

## 校验 2：仓库名必须是烤肉串 + `-app` 后缀

```text
repo 匹配正则：^[a-z][a-z0-9-]*-app$
```

意思：

- 全小写。
- 只允许小写字母、数字、短横线。
- 第一位必须是字母（不能数字或短横线开头）。
- 末尾必须是 `-app`。

不匹配则终止。返回文案：

> 仓库名 `<repo>` 不合规。tranfu 仓库名约定：全小写、烤肉串（kebab-case）、必须以 `-app` 结尾，
> 例如 `foo-app`、`order-mgmt-app`、`a1-app`。请先在 GitHub 改名，再跑这个流程。

约定本身的意义：

- Coolify 里 app 名、project 名、domain 都直接复用仓库名。仓库名不规范，下游全连带不规范。
- `-app` 后缀让一眼能区分"代码仓库"和"基础设施仓库 / 文档仓库 / 资源仓库"，避免把不该 onboard 的仓库
  误识别成应用。

## project 命名规则

```text
project name == repo name（1:1，find-or-create）
```

意思：

- onboard 一个新仓库 `foo-app` 时，对应 project 名也叫 `foo-app`。
- project 不存在则自动用 `coolify project create --name <repo>` 建；存在则复用，不重建。
- 一个 project 下只挂这一个 app（仓库 1:1）。未来如果要把多个相关 app 编组，再扩展。

约定本身的意义：把"仓库 → project → app"的映射从"需要查表"变成"看名字就知道"。自动化脚本不需要额外
配置文件，新成员上手也不需要记忆映射表。

## 解析与校验流程合并

```bash
# 把上面三步串起来（伪代码）：
parse_url "$INPUT" -> ORG, REPO
[ "$ORG" = "tranfu-labs" ] || abort "不是 tranfu-labs"
echo "$REPO" | grep -Eq '^[a-z][a-z0-9-]*-app$' || abort "命名不合规"
PROJECT_NAME="$REPO"   # 直接 1:1
```

任一步失败直接终止，不要试图修正大小写、自动补 `-app` 后缀或猜测用户意图。
