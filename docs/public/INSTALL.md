# 安装 StardewDS 公开测试版

StardewDS 是一款 AYN Thor 下屏伴侣，需要拥有 PC 版《星露谷物语》，并在 Thor 上通过 Cinderbox 和 SMAPI 运行。原版 Android 游戏不是本测试版的目标。主机验证基线为游戏 1.6.15、SMAPI 4.5.2；其他组合尚未确认。备份存档后再参加测试。

## 1. 配套模组

保存并完全退出游戏，解压发行包的 `StardewDS-Mod-<版本>.zip`，将其中的 `StardewThor.ReadOnly` 文件夹（沿用原文件夹名，便于覆盖升级）放到 Cinderbox 使用的 `StardewValley/Mods` 下。升级只替换 manifest.json、StardewThor.ReadOnly.dll、StardewThor.Bridge.dll，保留 config.json 和 control-key.json。不要同时安装其他监听 23871 端口的双屏桥接模组。

## 2. 从自己的游戏生成素材

公开 APK 不包含游戏原版美术、音效或离线游戏文字。第一次使用需要在 Windows PC 上生成私有素材包；以后 App 升级会保留导入的素材。

安装 Node.js（本轮使用24）和 PowerShell 7，需要自己的游戏目录和 SMAPI 文件。发行包已提供 `StardewDS-AssetExporter-<版本>.zip` 工具，可直接解压到独立 ExportMods 目录。自行编译工具时另需 .NET SDK 8；源码根目录运行：

```powershell
npm ci
$env:STARDEW_GAME_PATH='D:/Games/Stardew Valley'
$env:STARDEW_SMAPI_PATH='D:/Games/Stardew Valley'
dotnet build tools/AssetExporter -c Release
```

使用预编译工具也需要先在源码目录运行 `npm ci` 安装素材转换依赖。自行编译时，把 tools/AssetExporter/manifest.json 和 tools/AssetExporter/bin/Release/net6.0/AssetExporter.dll 复制到一个独立的 `ExportMods/AssetExporter` 目录。用自己的 SMAPI 启动游戏，并传入 `--mods-path` 指向 ExportMods。停在标题画面，日志出现 `Owned-game content exported` 后退出，不需要打开任何存档。目录中的 export 文件夹包含此次导出结果。这个工具只在标题画面导出；完成后移除它。

```powershell
node tools/extract-local-assets.cjs "$env:STARDEW_GAME_PATH" 'D:/ExportMods/AssetExporter/export' 'D:/ThorAssetsWork'
```

第三个参数必须是尚不存在的新目录。将输出中的 `StardewDS-private-assets.zip` 复制到 Thor 的下载文件夹。素材包只供自己的设备使用，请勿上传到公开发行页面。

## 3. APK 与配对

安装发行包中的 `StardewDS-<版本>.apk`，在下屏打开。首次启动会显示导入引导页：点“选择素材 ZIP”并选中自己的素材包，App 逐个文件校验后直接进入主界面。导入失败时引导页会写明原因（不是素材包、不完整、已损坏、过大或无法读取），原有素材不受影响。以后可在“设置 → 本机文件”重新导入。当前公开构建的应用 ID 为 `io.github.chankamman_dev.stardewds`，开发构建使用 `.dev` 后缀；历史 beta.1 使用 `io.github.thordev.stardewcompanion.beta`，升级到新 ID 时会作为另一个应用安装，需要重新导入素材和配对。确认新版可用后再卸载旧版。

启动游戏一次，模组会生成 control-key.json。需要操作背包、制作、领取奖励或搬运箱子时，将自己模组文件夹的 control-key.json 复制到下载目录，在 App“设置 → 本机文件 → 控制配对”点“导入配对”选择该文件，该行会显示“已配对”；随后删除下载目录的副本。不要把它放进反馈附件、公开仓库或截图。未配对时仍可查看资料与游戏状态。

打开游戏并载入存档，下屏背包应显示实时日期和物品。App 与游戏在同一台 Thor 上，通过本机回环端口连接，无需 Wi-Fi、登录或远程服务器。Wiki 阅读器需要联网。

## 更新与卸载

公开 APK 后续更新必须使用同一发布签名。只覆盖安装，不清除 App 数据，以保留素材、收藏和配对。模组升级在游戏完全退出后进行，保留配置与配对文件。回退模组时恢复备份的三个文件；回退 App 版本可能需要先卸载，因此先保留自己的素材包和配对原文件。

## 排查

- 未连接：确认游戏已载入存档、SMAPI 成功加载桥接模组、没有另一个模组占用23871。设置里核对模组版本和上次同步。
- 只能查看：完成“配对控制”；多人游戏、剧情事件、光标正拿着物品等状态会限制部分操作。
- 素材包无效：引导页或设置行会显示具体原因。用当前源码和自己的游戏重新生成，不能直接选择原始游戏 ZIP，也不能把普通 ZIP 改名代替素材包。
- 旧模组提示：App 和模组应一起升级。农务及情境数据按需采集，刚打开页面可能短暂显示读取中。

beta.1 已在一台 Thor 上完成首次安装、素材导入与配对（见 THOR-BETA1-20260927.md）；实际游玩与写入功能的验收状态见 RELEASE.md。请先在备份后的存档中测试。
