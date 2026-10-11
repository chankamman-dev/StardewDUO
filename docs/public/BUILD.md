# 从源码构建

Node.js 24、PowerShell 7、JDK17、.NET SDK8、Android SDK平台35和build-tools35.0.0。游戏及SMAPI由开发者自行提供，不随源码或发行包分发。

```powershell
npm ci
npm run test:public
$env:STARDEW_GAME_PATH='D:/Games/Stardew Valley'
$env:STARDEW_SMAPI_PATH='D:/Games/Stardew Valley'
./tools/package-mod.ps1
$env:ANDROID_HOME='D:/Android/sdk'
# 开发用包，源码清洁副本中不含游戏素材，启动后导入自己的素材
./tools/build-android.ps1
```

公开包用独立应用ID和自己的签名：

```powershell
$env:THOR_STORE_PASSWORD='your-secret-store-password'
$env:THOR_KEY_PASSWORD='your-secret-key-password'
./tools/build-android.ps1 -Public -Keystore 'D:/Private/release.keystore' -Alias stardewthor
```

不要将私钥或密码放进源码、CI日志或发行包。维护者保存自己的签名备份，后续公开版升级使用同一签名；个人开发包的签名与公开版独立。公开构建输出 `artifacts/StardewDS-<版本>.apk`（桌面名 StardewDS），开发构建输出 `StardewDS-<版本>-local.apk`（桌面名 StardewDS Dev），模组为 `StardewDS-Mod-<版本>.zip`。字节相同的APK不是本流程的承诺（ZIP时间戳与签名不同）；发布检查核对每个文件、源码与证据的SHA256。

本地素材生成见 INSTALL.md。浏览器预览需要素材已生成；把私有输出的android/assets游戏内容合并到本机android/assets，再运行 `npm run preview`。不得把生成的游戏内容提交到公开Git仓库。

公开源码包来自显式白名单导出，不包含内部Git历史、玩家数据、已提取游戏素材、设备备份或私钥。内部仓库历史曾含原版音效，不可直接推送该历史作为公开仓库。需要在导出的源码目录初始化一个新的Git仓库。

自包含检查（模型、作物计算、桥接协议、Wiki URL策略、素材导入）可以在没有游戏或素材的清洁源码副本运行。真实游戏联调和图像回归需要合法本机游戏与单独测试存档，测试范围分开记录。

发行目录可用 `node tools/check-distribution.cjs <clean-source-directory> <distribution-directory> <Android-SDK>` 核对源码清单、APK素材、包名版本签名、模组及导出工具文件列表。该检查需要Windows Android SDK构建工具；不执行游戏或设备安装。
