<h1 align="center">StardewDUO 双屏伴侣</h1>

<p align="center"><b>中文</b> · <a href="README.en.md">English</a></p>

<p align="center">
  为 AYN Thor 做的非官方《星露谷物语》下屏伴侣：<b>上屏继续游戏，下屏随手翻看</b>背包、地图、居民、任务与日历、农务、手册和情境。
</p>

<p align="center">
  <img src="docs/images/thor-map.webp" width="460" alt="AYN Thor 上屏是游戏，下屏是 StardewDS 的地图页，标出了各位居民的实时位置">
</p>

<p align="center">
  <a href="docs/public/INSTALL.md">安装与配对</a> · <a href="docs/public/BUILD.md">构建</a> · <a href="docs/public/RELEASE.md">发布状态</a> · <a href="PRIVACY.md">隐私</a> · <a href="CONTRIBUTING.md">参与开发</a> · <a href="THIRD_PARTY_NOTICES.md">第三方许可</a>
</p>

## 看一看

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/images/inventory.webp" alt="背包页：手持物品、属性与操作按钮"><br><b>背包</b><br><sub>原版布局，属性、售价与整理</sub></td>
    <td align="center" width="33%"><img src="docs/images/villagers.webp" alt="居民列表：生日、好感、今日送礼与聊天"><br><b>居民</b><br><sub>好感、生日、今日聊天与送礼</sub></td>
    <td align="center" width="33%"><img src="docs/images/morning-briefing.webp" alt="早晨简报：天气、运势、生日提醒"><br><b>早晨简报</b><br><sub>明日天气、今日运势、生日与待办</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/images/dialogue.webp" alt="对话页：居民说的话以英文原文显示，点词查释义"><br><b>对话</b><br><sub>看英文原句、点词查义、朗读</sub></td>
    <td align="center"><img src="docs/images/calendar.webp" alt="任务与日历：本季生日和节日"><br><b>任务与日历</b><br><sub>本季生日、节日、告示与任务</sub></td>
    <td align="center"><img src="docs/images/villager-profile.webp" alt="居民档案：当前位置、行程、家人与朋友"><br><b>居民档案</b><br><sub>当前位置、今日行程、家人朋友</sub></td>
  </tr>
</table>

<sub>截图来自开发中的版本（App 0.11.1-dev.62 至 dev.74；上排为新的手账风格，下排为原版菜单风格）。手账风格和对话页尚未包含在当前公开源码（App 0.11.1-dev.55）中。截图中的游戏画面版权归 ConcernedApe 所有。</sub>

## 能做什么

下屏有八个页签，从上到下依次是：

**🎒 背包**
- 原版 6×2 分页布局，可展开查看全部格子；手持格、品质星、数量与水壶水量和游戏一致。
- 物品说明、分类、售价，以及武器、食物、装备等的属性。
- 直接拖动换位、拆分与合并、整理、定量丢弃与销毁。每次操作都由游戏回执确认，不会凭点击伪造结果。
- 一键跳到手册里的这件物品。

**🗺️ 地图**
- 世界地图与所在地点的局部地图，可拖动和缩放，跟随玩家。
- 每位居民的实时位置用像素头像标出，重叠时聚合计数。

**❤️ 居民**
- 列表、头像网格两种视图，支持搜索、按地区筛选、排序和置顶。
- 好感进度、生日、今天是否聊过天、本周送礼次数。
- 档案：当前位置、今日行程、家人与朋友、礼物喜好，以及这位居民的剧情事件。

**❗ 任务与日历**
- 进行中的任务与特殊订单；今日告示板委托可以直接在下屏接取，完成后可领取奖励，并保留已完成记录。
- 本季日历：生日、节日、书商等日程。
- 剧情事件：按居民和地点筛选，显示触发条件和是否已看过。

**🌱 农务**
- 今日待办：没浇水的作物、可收获的作物与机器、动物。
- 明日预告与资讯：天气、运势、旅行货车、生日、家人。
- 收获日历：已种下的作物什么时候成熟。
- 作物利润计算：按季节和天数比较种什么最划算。

**📘 手册**
- 物品目录：搜索、分类、收藏与最近查看。
- 制作：已学配方的材料与容量检查，一次制作 1–99 次或最大次数（料理只读）。
- 角色：装备、原版与模组技能及经验。
- 图鉴、社区中心收集包（含 Joja 路线）、内置 Wiki 阅读器。

**🔍 情境**：会随游戏自动切换（每种都可以单独开关）
- 面前的对象：居民、作物、机器、动物、放置物。
- 打开的箱子：在下屏整组搬运物品。
- 商店、钓鱼、矿井层数。
- 夜晚结算当天的出货，早上醒来看到当天简报：天气、运势、生日提醒、待办。
- 对话（**开发版**）：居民正在说的话显示英文原句，点词查释义、加入生词，可以朗读；方便边玩边学英语。
- 钓鱼日志（**开发版**）：做成旧钓鱼日志的样子，显示这里值得钓的鱼、上钩的鱼和收获记录。

**🎮 设置**
- 中文 / English、文字大小、界面音效、闲置自动变暗（**开发版**）、隐藏原版工具栏。
- 隐藏未知信息：未结识的居民、未发现的物品与喜好、未解锁的地图、未看过的剧情、未收集的图鉴，六项可以分别设置。
- 模组管理：已加载模组的清单与中文备注，有 GMCM 设置的模组可以在下屏直接修改设置。
- 配对、素材导入与连接诊断。

**模组适配**：运行时读取模组新增的物品、居民、技能和农务内容，按已验证的版本限定，读不到时会明确提示。

**手账风格界面**（**开发版**）：皮革封皮、层叠书页和布面书签，切换页签时有翻页动画；也可以在设置里换回原版菜单风格。

## 需要什么

- 自己的 PC 版《星露谷物语》，在 Thor 上通过 Cinderbox 与 SMAPI 运行；原版 Android 手游不是目标。
- 下屏 App 与配套 SMAPI 模组，安装与配对步骤见 [安装与配对](docs/public/INSTALL.md)。
- 公开 APK 不内置游戏原版美术、音效和离线文字：用户从自己的游戏生成并导入私有素材 ZIP。
- 未配对也可以查看；背包、制作、奖励和箱子操作需要本机密钥配对。多人游戏中的写入不受支持。没有保存、读档或任意脚本执行端点。

本项目与 ConcernedApe、Nintendo、AYN 均无关联。

## 版本状态

当前源码是 App 0.11.1-dev.55、模组 0.10.1-dev.42，尚未作为这组版本公开发行。历史 beta.1 测试包已在一台 AYN Thor 上完成安装、首次素材导入、配对和短时实机检查（[记录](docs/public/THOR-BETA1-20260927.md)）；这些结果不代表当前源码的实机验收。60 分钟以上实际游玩和实际存档上的写入功能仍未验收。主机模拟、协议检查与隔离 PC 游戏验证的范围见 [发布状态](docs/public/RELEASE.md)。

应用 ID 为 `io.github.chankamman_dev.stardewds`（开发构建 `….dev`），模组 ID 为 `chankamman.StardewDS`。从 beta.1 升级时新 App 会作为另一个应用安装，需要重新导入素材和配对；模组文件夹名仍为 `StardewThor.ReadOnly`，覆盖三个文件即可，配对密钥与已完成任务记录会保留。

## 开发

Node.js 24、.NET SDK 8、JDK 17、PowerShell 7，Android 构建需要 SDK 35。

~~~powershell
npm ci
npm run test:public
~~~

这是不依赖游戏素材的自包含测试。游戏相关构建与素材生成的参数见 [构建](docs/public/BUILD.md) / [安装](docs/public/INSTALL.md) 文档。发布源码采用 MIT；Fusion Pixel Font 保持 OFL 1.1。游戏本身与其素材不受 MIT 覆盖。

本地内部仓库保留开发历史与 HANDOFF；公开源码由白名单导出，必须使用干净目录初始化公开 Git，不能直接推送内部历史。[GitHub 上传说明](docs/public/GITHUB.md)
