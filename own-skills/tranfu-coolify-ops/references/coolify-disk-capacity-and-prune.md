# Coolify 部署机磁盘容量与安全 Docker 清理参考

## 何时使用本参考

当 tranfu Coolify 部署机接近满盘、用户问要买多大磁盘、或要求回收 Docker 空间时，由 tranfu-coolify-ops 主流程引用本文件。

## 工作单元契约

- 输入：目标 Coolify 主机的 SSH 可达 shell；用户的扩容意图或清理意图。
- 输出（命名产物）：`DiskOpsReport`，含当前磁盘状态、瓶颈归因、扩容建议或清理结果。
- 完成判据（可观测）：`df -hT /` 已执行并记录已用率；若做了清理，前后两次 `docker system df` 的差值已记录；最终用户可读结论已按下方「报告版式」格式产出。
- Ownership：suggest patch —— 给出待执行命令与建议结论；MUST NEVER 在用户未显式确认前执行破坏性命令（任何 `prune` 或 `rm`）。

## 流程：磁盘容量评估与安全清理

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 校验前置：MUST 确认已能在目标主机执行 shell。若无 SSH / 无 sudo / 主机不可达 → 报 BLOCKER「目标主机不可达」并退出。   # 卫语句·用前必校
2. 跑「只读盘点」子流程，产出 `current_state`。
3. 按用户意图路由：意图=仅评估扩容 → 跳到第 5 步；意图=回收空间 → 进入第 4 步；意图未知 → 向用户澄清后再路由；否则 → 报 BLOCKER「未知意图」并退出。   # 派发·穷尽带兜底
4. 跑「安全清理」子流程，产出 `prune_delta`；若任一清理命令非零退出 → 记录失败命令到 `prune_delta.errors`，停止后续清理步骤，继续进入第 5 步（不中断报告）。   # 失败有出口
5. 跑「容量估算」子流程，产出 `capacity_target`。
6. 按「报告版式」组装并产出 `DiskOpsReport`，结束。   # 显式终止

失败出口：
- 目标主机不可读 → BLOCKER「目标主机不可达」并说明缺什么。
- 运行时缺 `docker` CLI → 降级为「仅磁盘只读盘点 + 容量估算」，跳过清理；在 `DiskOpsReport.notes` 标注「docker 不可用」。
- 清理命令失败 → 不中断流程，按第 4 步把错误带入报告。

## 子流程「只读盘点」

MUST 仅执行只读命令；MUST NEVER 在本子流程内执行任何 `prune` 或破坏性命令。

```bash
date -Is
df -hT /
docker system df
docker system df -v
journalctl --disk-usage 2>/dev/null || true
```

对 Coolify 主机，Docker 镜像和构建缓存通常是主要增长来源。`docker system df -v` 用来识别哪些镜像被容器引用、哪些缓存可回收。

产出 `current_state`：根盘已用率、Docker 各类目占用、journal 占用。

## 子流程「安全清理」

承重规则：

- MUST NEVER 以 `docker system prune -af --volumes` 起手。Coolify 主机的 volume 可能含数据库、上传文件或其他业务数据。
- MUST NEVER 默认清理 volume。仅当用户显式要求时，才进入「volume 清理」分支；进入前 MUST 先列出 dangling volume 并由用户逐一确认归属。

推荐顺序（按行执行，每步若非零退出立即停止后续步骤并把失败带回主流程）：

```bash
docker system df -v
docker builder prune -af
docker image prune -af
docker system df
df -hT /
```

各步含义：

- `docker builder prune -af` 清构建缓存。通常是第一刀，最安全；尤其当构建在 GitHub 完成、本地旧缓存无用时。
- `docker image prune -af` 清未被任何容器引用的镜像。运行中的容器不受影响；本地回滚镜像可能需要重新拉取。
- volume 清理走「volume 清理」分支，默认不进入。

volume 清理分支（仅在用户显式确认后执行）：

```bash
docker volume ls -f dangling=true
docker system df -v
# 用户逐一确认归属后才执行
docker volume prune -f
```

产出 `prune_delta`：清理前后 `docker system df` 与 `df -hT /` 的差值；若有错误，列入 `prune_delta.errors`。

## 子流程「容量估算」

适用：镜像在 GitHub 构建、Coolify 主机仅拉取并运行。此时 MUST NEVER 按「每次部署都本地构建」的口径估盘 —— 主机增长主要来自拉取的运行时镜像、容器可写层、日志和 volume。

公式：

```text
six_month_projects = projects_per_week * 26
six_month_used = current_post_prune_used_gb + six_month_projects * avg_runtime_image_gb_per_project + safety_margin
required_disk_for_80_percent = six_month_used / 0.8
required_disk_for_70_percent = six_month_used / 0.7
```

按每周 3 个新项目 × 26 周 ≈ 78 个项目估算的规划带：

| 单项目运行时镜像均值 | 半年新增 | 建议磁盘 |
|---:|---:|---:|
| 0.3GB | 23GB | 80-100GB 一般够 |
| 0.7GB | 55GB | 推荐 120-150GB |
| 1.0GB | 78GB | 推荐 150GB |
| 1.5GB | 117GB | 推荐 200GB |
| 2.5GB 多服务重型 | 195GB | 300GB 档 |

对普通 Web/API 项目（GitHub 构建），默认建议 150GB 起步；若用户想给多服务、历史 tag、日志和未来不确定性更多余量，直接建议 200GB。

产出 `capacity_target`：当前已用、半年预估增长、推荐磁盘档位。

## 报告版式（DiskOpsReport）

MUST 用中文给最终结论；MUST 用如下三段式：当前状态、占用归因、扩容/清理建议。

示例：

```text
当前 40GB 磁盘已用 36GB，使用率 96%，主要占用来自 Docker 镜像和缓存。后续按每周 3 个 GitHub 构建的新项目估算，本机主要增长来自拉取的运行镜像、少量日志和 volume；半年约 78 个项目。普通 Web/API 项目建议扩到 150GB；若希望更稳并预留多服务项目和历史镜像空间，直接扩到 200GB。
```
