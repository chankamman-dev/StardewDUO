# 安装与配对

[English](INSTALL.en.md)

StardewDS 是 AYN Thor 的下屏伴侣：游戏在上屏，App 在下屏。**整个安装都在 Thor 上完成，不需要电脑**，大约 5 分钟。

```text
                                     AYN Thor
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ ① 装 App  →  ② App 装好配套模组  →  ③ 上屏打开游戏，停在标题画面                  │
 │           →  ④ 下屏「从游戏导入」素材  →  ⑤ 载入存档，上屏确认配对（可选）          │
 └──────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> 这是测试版。开始前请**备份存档**。已验证的组合是游戏 1.6.15 + SMAPI 4.5.2，其他组合尚未确认。
> 本页的流程需要 App 0.11.1-dev.77 及以上（内置模组 0.10.1-dev.59）。更早的版本请按文末[附录](#附录用电脑生成素材包或手动安装模组)操作。

## 0. 准备

| 需要什么 | 说明 |
| --- | --- |
| PC 版《星露谷物语》 | 在 Thor 上通过 Cinderbox + SMAPI 运行，能正常进入标题画面。原版 Android 手游不支持 |
| `StardewDS-<版本>.apk` | 只需要这一个文件，配套模组已经内置在 App 里 |

为什么素材要现场生成：为尊重版权，App 不带任何游戏原版美术、音效和文字。这些由你 Thor 上自己的游戏现场生成，只保存在这台设备上，不会上传。

## ① 安装 App

在 Thor 上安装 `StardewDS-<版本>.apk`，在**下屏**打开。第一次打开会显示首次使用页，上面列着三步，下面按顺序做即可。

## ② 安装配套模组

1. 保存并**完全退出游戏**。游戏开着时 App 不会写入，会提示「请先退出游戏再安装」。
2. 在首次使用页第 1 步「安装配套模组」右侧点 **安装**。
3. 系统的文件夹选择器会打开，一般已经停在 `StardewValley`。确认当前是 `内部存储 › StardewValley`，点 **使用此文件夹**，再点 **允许**。
   - 选里面的 `desktop` 或 `Mods` 也可以，App 都能找到模组目录。
4. App 把模组写进 `StardewValley/desktop/Mods/StardewThor.ReadOnly/`，并逐个文件校验。

**完成标志：** 第 1 步显示「安装完成 0.10.1-dev.59」。

App 只写自己的三个文件（`manifest.json`、`StardewThor.ReadOnly.dll`、`StardewThor.Bridge.dll`），不碰其他模组，也不碰本模组的 `config.json`、`control-key.json` 和数据。文件夹授权只需一次，以后更新模组不用再选，也可以随时在系统设置里撤销。

不要同时安装其他占用 23871 端口的双屏桥接模组。

## ③ 打开游戏，停在标题画面

在上屏用 Cinderbox（SMAPI）启动游戏，**停在标题画面，先不要载入存档**。模组第一次加载时会自动生成 `config.json` 和配对密钥 `control-key.json`。

## ④ 从游戏导入素材

1. 回到下屏，点 **从游戏导入**。
2. 状态栏显示「游戏正在生成素材… N%」：游戏在标题画面现场生成素材包，期间上屏可能停顿一两秒。
3. 生成完后 App 下载并逐个文件校验，然后直接进入主界面。

**完成标志：** 看到带侧边栏的主界面。以后要重新生成，在 **设置 → 本机文件 → 游戏素材** 点 **从游戏导入**。

导入失败时会写明原因，原有素材不受影响：

| 提示 | 怎么办 |
| --- | --- |
| 未连上游戏 | 游戏没开，或模组没加载。打开游戏，查看 SMAPI 日志里是否有 `StardewDS Bridge` |
| 配套模组太旧 | 模组版本早于 0.10.1-dev.59，先完成第 ② 步 |
| 请回到标题画面 | 只能在标题画面生成。回到标题画面再点一次 |
| 游戏没能生成素材 | 查看 SMAPI 日志中 `Asset pack failed` 一行，反馈时附上这一行 |

> [!CAUTION]
> 素材是游戏原版内容，只供你自己的设备使用，**不要上传或分享**。

## ⑤ 载入存档，配对（可选）

不配对也能看所有资料和游戏状态。要在下屏**整理背包、制作、领取奖励、整组搬运箱子**，需要配对一次：

1. 在 App 里打开 **设置 → 本机文件 → 控制配对**，点 **配对**。
2. 该行显示「请进入存档，上屏会询问」。在上屏载入存档。
3. 角色可以自由行动时，上屏会弹出「StardewDS 下屏请求配对」的确认框，点绿色的 **✓**。
4. 下屏显示「配对完成」就好了。

点红色的 **✗**、关掉确认框或 90 秒内没回答，都不会交出密钥，可以随时再点 **配对**。

<details>
<summary>另一种方式：从文件导入密钥</summary>

在同一行点 **从文件导入**，进入 `内部存储 › StardewValley › desktop › Mods › StardewThor.ReadOnly`，选中 `control-key.json`。如果选择器里看不到这个文件夹，先用文件管理器把它复制到下载文件夹，从那里选，导入后**删掉这份副本**。

</details>

> [!WARNING]
> `control-key.json` 是控制你游戏的钥匙。不要放进反馈附件、截图或公开仓库。

## 开始使用

载入存档后，下屏的背包页应显示实时的日期、时间和物品。

App 和游戏都在同一台 Thor 上，经本机端口连接：**不需要 Wi-Fi、账号或任何服务器**。只有 Wiki 阅读器需要联网。

## 更新

| 更新什么 | 怎么做 |
| --- | --- |
| App | 直接覆盖安装新 APK，**不要清除 App 数据**，素材、收藏、配对和文件夹授权都会保留。更新必须是同一发布签名的包 |
| 模组 | 新 App 自带新模组。完全退出游戏后，在 **设置 → 本机文件 → 配套模组** 点 **更新**（该行会显示「已装旧版 …，可更新」）。`config.json` 和 `control-key.json` 会保留 |
| 素材 | 游戏或模组内容有较大变化后，在标题画面重新 **从游戏导入** |

App 和模组请一起升级，否则 App 会提示模组版本较旧。App 不会用旧模组覆盖更新的模组。

从历史 beta.1（应用 ID `io.github.thordev.stardewcompanion.beta`）升级时，新 App（`io.github.chankamman_dev.stardewds`，开发构建带 `.dev` 后缀）会作为另一个应用安装，需要重新导入素材和配对。确认新版可用后再卸载旧版。

## 遇到问题

| 现象 | 先检查 |
| --- | --- |
| 安装模组提示「请先退出游戏再安装」 | 完全退出游戏（包括 Cinderbox）后再点 |
| 「没找到 Mods，请选 StardewValley」 | 选错了文件夹。再点一次，选 `内部存储 › StardewValley` |
| 「已装较新的版本，未改动」 | 已经装了比 App 自带版本更新的模组，App 不会降级。请把 App 也更新到对应版本 |
| 文件夹选择器不让选某个文件夹 | Android 不允许授权存储根目录和下载文件夹，选 `StardewValley` 即可 |
| 下屏显示“未连接游戏” | 游戏正在运行；SMAPI 日志里桥接模组加载成功；没有别的模组占用 23871 端口。可在设置里核对模组版本和上次同步时间 |
| 下屏显示“等待进入存档” | 正常：游戏还在标题画面，载入存档后就会显示 |
| 只能看，不能操作物品 | 完成第 ⑤ 步配对。多人游戏、剧情事件中、光标正拿着物品时，部分操作会被限制 |
| 页面显示“更新配套模组后查看” | 模组比 App 旧，在 **设置 → 本机文件 → 配套模组** 点 **更新** |
| 农务、情境页短暂显示“读取中” | 正常：这些数据在打开页面时才开始读取 |

测试状态：无电脑流程（App 安装模组、游戏内生成素材、上屏确认配对）已在隔离的 PC 测试游戏和自动测试中逐项验证，Thor 实机验收正在进行。历史 beta.1 的首次安装记录见 [这里](THOR-BETA1-20260927.md)，实际游玩与写入功能的验收状态见 [发布状态](RELEASE.md)。请先在备份过的存档里使用。

## 附录：用电脑生成素材包，或手动安装模组

适用于 App 0.11.1-dev.77 之前的版本，或游戏内生成反复失败时。新版 App 仍可在首次使用页或设置里用 **从文件导入** 选择电脑做好的素材包。

<details>
<summary>在 Windows PC 上生成素材包</summary>

需要：同一份游戏的 PC 安装目录（含 SMAPI）、[Node.js](https://nodejs.org/) 24、PowerShell 7、本仓库源码（GitHub 页面 **Code → Download ZIP** 解压即可）、发行包里的 `StardewDS-AssetExporter-<版本>.zip`。以下命令在 PowerShell 里执行，路径换成你自己的。

1. 在源码目录安装依赖：

   ```powershell
   cd D:\StardewDUO
   npm ci
   ```

2. 把 `StardewDS-AssetExporter-<版本>.zip` 解压成 `D:\ExportMods\AssetExporter\`（里面应有 `manifest.json` 和 `AssetExporter.dll`）。这个文件夹只放这一个工具。想自己编译：设好 `STARDEW_GAME_PATH`、`STARDEW_SMAPI_PATH` 后运行 `dotnet build tools/AssetExporter -c Release`（需要 .NET SDK 8）。
3. 只加载这个目录启动游戏，停在标题画面，等 SMAPI 窗口出现 `Owned-game content exported` 后退出：

   ```powershell
   & 'D:\Games\Stardew Valley\StardewModdingAPI.exe' --mods-path 'D:\ExportMods'
   ```

4. 打包（第三个参数必须是还不存在的新文件夹）：

   ```powershell
   node tools/extract-local-assets.cjs 'D:\Games\Stardew Valley' 'D:\ExportMods\AssetExporter\export' 'D:\ThorAssetsWork'
   ```

5. 把生成的 `D:\ThorAssetsWork\StardewDS-private-assets.zip` 复制到 Thor 的下载文件夹，在 App 里点 **从文件导入** 选中它。

</details>

<details>
<summary>手动安装模组</summary>

1. 完全退出游戏。
2. 解压发行包里的 `StardewDS-Mod-<版本>.zip`，把 `StardewThor.ReadOnly` 文件夹放进 `内部存储/StardewValley/desktop/Mods/`。文件夹名保持 `StardewThor.ReadOnly`。
3. 升级时只替换 `manifest.json`、`StardewThor.ReadOnly.dll`、`StardewThor.Bridge.dll` 三个文件，保留 `config.json` 和 `control-key.json`。回退时恢复备份的这三个文件。

</details>
