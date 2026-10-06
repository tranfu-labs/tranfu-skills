---
name: electron-macos-notifications
description: 给 macOS 上的 Electron 应用接入系统通知：主进程提交通知、读取/请求通知授权、点击回到对应位置、重启后恢复通知中心历史通知、Dock 角标、通知相关的打包配置。触发于"给 Electron 应用加系统通知""Electron mac 通知怎么配""通知不弹/没反应""读不到通知权限""点通知回不到对应页面"，或新 Electron 桌面项目需要任务完成提醒。Do NOT trigger for Windows/Linux 通知、Tauri/原生 Swift 应用、仅应用内弹出提示、"什么时候该发通知"的业务规则设计，或签名/公证/自动更新本身。
version: 0.1.0
author: aquarius-wing
updated_at: 2026-10-06
origin: own
---

# Electron macOS 系统通知接入

按下面的分工一次接对，不要自己摸索替代方案——表里每个"不要"都是已经实测走不通的路。

## 分工

| 职责 | 用什么 | 不要用 |
| --- | --- | --- |
| 提交通知、点击事件、历史恢复 | 主进程 `electron` 的 `Notification`（Electron ≥ 43：`id` / `groupId` / `Notification.getHistory()`） | renderer 的 Web Notification；自建第二套原生投递通道 |
| 读取/请求通知授权 | 自建 Swift 小程序（`.app` 包形态），调 `UNUserNotificationCenter` | `Notification.isSupported()`（不代表授权）；`systemPreferences`（只有媒体授权）；`macos-notification-state`（只有勿扰/锁屏状态） |
| 点击回到对应位置 | 稳定通知 id + 持久化 `id → 点击目标` 映射 | 依赖 `userInfo`（历史对象恢复不出来） |
| Dock 角标 | `app.dock.setBadge` | — |
| 打开系统通知设置 | `shell.openExternal("x-apple.systempreferences:com.apple.preference.notifications")` | — |

## 落地步骤

### 1. 启动 Electron 前清掉 `ELECTRON_RUN_AS_NODE`

环境里有这个变量时 Electron 会以纯 Node 跑，不加载应用代码。开发脚本、打包、调试命令一律清掉：

```js
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
spawn(electronBin, ["."], { env, stdio: "inherit" });
// 命令行：env -u ELECTRON_RUN_AS_NODE pnpm dist
```

### 2. Swift 授权小程序

只做两件事：`status` 读授权、`request` 请求授权，结果以 JSON 打到标准输出。

```swift
import Foundation
import UserNotifications

let mode = CommandLine.arguments[1]           // "status" | "request"
let sem = DispatchSemaphore(value: 0)
var out = ""
func read() {
  UNUserNotificationCenter.current().getNotificationSettings { s in
    out = #"{"authorizationStatus":"\#(s.authorizationStatus.name)","alert":"\#(s.alertSetting.name)","sound":"\#(s.soundSetting.name)","badge":"\#(s.badgeSetting.name)"}"#
    sem.signal()
  }
}
if mode == "request" {
  UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, err in
    if let err { out = #"{"error":"\#(err.localizedDescription)"}"#; sem.signal(); return }
    read()
  }
} else { read() }
sem.wait(); print(out); exit(out.hasPrefix(#"{"error""#) ? 1 : 0)
// .name：把枚举映射成 notDetermined/denied/authorized/provisional、enabled/disabled/notSupported
```

### 3. 构建脚本：同身份、双变体、先写 Info.plist 再签名

授权按 bundle id 存储，小程序必须和**提交通知的那个进程**同一个身份：打包态是 `build.appId`，开发态宿主是 Electron 本体 `com.github.Electron`。所以构建两个变体，运行时按宿主选择。

```js
// scripts/build-native.mjs（非 darwin 直接跳过）
execFileSync("swiftc", ["-O", "native/permission/main.swift", "-o", exe]);
for (const [bundleId, name] of [[pkg.build.appId, "PermissionBridge.app"],
                                ["com.github.Electron", "PermissionBridge.dev.app"]]) {
  // 写 Contents/Info.plist：CFBundleIdentifier=bundleId, CFBundleExecutable, CFBundlePackageType=APPL
  // 拷贝 exe 到 Contents/MacOS/ 并 chmod +x
  execFileSync("codesign", ["--force", "--sign", "-", "--identifier", bundleId, appBundle]);
}
```

- 必须是 `.app` 包：裸可执行调 `UNUserNotificationCenter.current()` 直接崩溃（`bundleProxyForCurrentProcess is nil`）。
- 签名必须在写完 Info.plist 之后；签名后再改 Info.plist 等于签名损坏，`requestAuthorization` 立即返回 `UNErrorDomain error 1`。
- 不要运行时改写 Info.plist 来切身份，预先构建两个变体。

### 4. 主进程调用授权小程序

```ts
function resolvePermissionExecutable(): string {
  const bundle = app.isPackaged
    ? path.join(process.resourcesPath, "native", "PermissionBridge.app")
    : deriveRunningBundleId() === "com.github.Electron"
      ? DEV_BRIDGE_DEV_APP   // native/build/PermissionBridge.dev.app
      : DEV_BRIDGE_APP;
  return path.join(bundle, "Contents", "MacOS", "permission");
}
// deriveRunningBundleId：读 process.execPath 往上三级的 Contents/Info.plist 里的 CFBundleIdentifier
```

`spawn` 时加 5 秒超时。桥返回 `{"error": ...}` 时原样透出为"暂时无法检测"，不要伪装成"未开启"。`request` 失败后回读一次 `status`：`denied` 就引导打开系统设置（已拒绝的身份不会再弹授权框）。每次真正发送前都重新 `status`。

### 5. 提交通知：三态结算 + 稳定 id

```ts
export const SUBMIT_TIMEOUT_MS = 8_000;

show(input): Promise<{ ok: true } | { ok: false; reason: "failed" | "unsupported" | "timeout" }> {
  if (!Notification.isSupported()) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    const n = new Notification({ id: input.notificationId, groupId: GROUP_ID, title: input.title, body: input.body });
    let done = false;
    const settle = (r) => { if (!done) { done = true; clearTimeout(t); resolve(r); } };
    // 被系统通知服务拒绝（签名验证失败等）时 show/failed 都不触发，只能靠超时闭合
    const t = setTimeout(() => settle({ ok: false, reason: "timeout" }), SUBMIT_TIMEOUT_MS);
    n.on("failed", () => settle({ ok: false, reason: "failed" }));
    n.on("show", () => settle({ ok: true }));
    n.on("click", () => emitClick(input.target));
    n.show();
  });
}
```

- 通知 id 由业务事件 id 确定性生成：`${PREFIX}${encodeURIComponent(eventId)}`，所有通知共用一个固定 `groupId`，每条 id 独立。
- 提交**之前**把 `notificationId → 点击目标` 原子写进持久化状态（旧状态缺这个字段按空映射读）。
- `timeout` / `failed` 只映射为"暂时无法发送系统通知"，不回滚业务事实、不伪造送达。

### 6. 启动时恢复历史通知

```ts
// app ready 后、业务运行时创建之前执行一次（只在 darwin）
const known = new Set(Object.keys(state.notificationTargets).filter((id) => decodeId(id) !== null));
for (const n of await Notification.getHistory()) {
  if (!known.has(n.id) || restored.has(n.id)) continue;
  restored.set(n.id, n);              // live 对象，引用保留到应用退出，否则 click 丢失
  n.on("click", () => onHistoryClick(n.id));
}
```

- 每个 id 只挂一次 listener；未知 id、空结果、API 不存在只记日志，不导航。
- 点击先持久化为"待定位"载荷，业务运行时就绪后再消费；普通启动没有点击就不自动跳转。
- `Notification.handleActivation` 只适用于 Windows，macOS 不用。

### 7. 打包

```jsonc
"build": {
  "appId": "com.example.app",
  "extraResources": [{ "from": "native/build/PermissionBridge.app", "to": "native/PermissionBridge.app" }],
  "mac": { "identity": "<Developer ID Application 证书名>" }
}
```

- `pnpm build` 里先跑 `build-native.mjs` 再打包。
- 正式包必须用 Developer ID 证书签名并公证：系统通知服务会校验签名，adhoc 签名和未公证的 Developer ID 都会被拒，表现为授权框不弹、`show` 超时。签名、公证、发版流水线另行配置（有 `electron-mac-release` skill 时走它）。
- 同一 bundle id 的系统授权框只弹一次，用户没响应就被记为拒绝；开发期需要重新触发时换一个 bundle id。

## 排障

- 通知一直超时：先查正式签名与公证（`spctl -a -vv <App>.app`、`codesign --verify --deep --strict`），再查 `log stream --predicate 'process == "usernoted"'`。
- 授权一直 `error 1`：检查小程序 Info.plist 的 bundle id 是否与宿主一致、是否在签名后被改过。
- 开发态读到的授权和打包态不同：正常，两者是不同身份，各自授权。
