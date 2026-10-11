# StardewDS 双屏伴侣

StardewDS（原名 Stardew Thor）是用于 AYN Thor 的非官方《星露谷物语》下屏伴侣：上屏继续游戏，下屏查看背包、地图、居民、任务与日历、农务、手册、情境和设置。版本与验收状态以 [发布状态](docs/public/RELEASE.md) 为准。

- 背包：原版布局、品质与属性、数量步进、整理及经过游戏回执确认的物品操作。
- 地图与居民：世界/局部地图、居民定位、送礼聊天状态、档案、行程和礼物资料。
- 任务与农务：告示接取、奖励领取、已完成记录、生日节日、待办、收获日历、作物利润计算。
- 手册与角色：物品收藏、制作、装备、原版及模组技能、图鉴、剧情事件、社区中心收集包与Wiki阅读器。
- 模组适配：运行时物品与居民目录、已知信息隐藏、家庭与居民关系、农务扩展，以及模组清单和上屏 GMCM 设置入口。各项适配按版本限定，无法读取时明确提示。
- 情境：当前对象、箱子整组搬运、商店、钓鱼、矿层、夜晚结算和早晨简报；自动切换可逐项设置。

**版本状态**：当前源码是 App 0.11.1-dev.55、模组 0.10.1-dev.42，尚未作为这组版本公开发行。历史 beta.1 测试包已在一台 AYN Thor 上完成安装、首次素材导入、配对和短时实机检查（[记录](docs/public/THOR-BETA1-20260927.md)）；这些结果不代表当前源码的实机验收。60 分钟以上实际游玩和实际存档上的写入功能仍未验收。主机模拟、协议检查与隔离 PC 游戏验证的范围见 [发布状态](docs/public/RELEASE.md)。

应用 ID 为 `io.github.chankamman_dev.stardewds`（开发构建 `….dev`），模组 ID 为 `chankamman.StardewDS`。从 beta.1 升级时新 App 会作为另一个应用安装，需要重新导入素材和配对；模组文件夹名仍为 `StardewThor.ReadOnly`，覆盖三个文件即可，配对密钥与已完成任务记录会保留。

[安装与配对](docs/public/INSTALL.md) · [构建](docs/public/BUILD.md) · [GitHub 上传](docs/public/GITHUB.md) · [隐私](PRIVACY.md) · [参与开发](CONTRIBUTING.md) · [第三方许可](THIRD_PARTY_NOTICES.md)

需要自己的PC版游戏、Cinderbox与SMAPI；原版Android手游不是目标。本项目与 ConcernedApe、Nintendo、AYN 均无关联。公开APK不内置游戏原版美术、音效和离线文字，用户从自己的游戏生成并导入私有素材ZIP。未配对仍可查看；背包、制作、奖励和箱子操作需要本机密钥配对。多人游戏中的写入不受支持。没有保存、读档或任意脚本执行端点。

## 开发

Node.js 24、.NET SDK 8、JDK 17、PowerShell 7，Android 构建需要 SDK 35。

~~~powershell
npm ci
npm run test:public
~~~

这是不依赖游戏素材的自包含测试。游戏相关构建与素材生成的参数见构建/安装文档。发布源码采用MIT；Fusion Pixel Font保持OFL1.1。游戏本身与其素材不受MIT覆盖。

本地内部仓库保留开发历史与HANDOFF；公开源码由白名单导出，必须使用干净目录初始化公开Git，不能直接推送内部历史。
