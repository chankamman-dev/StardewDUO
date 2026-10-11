# GitHub 源码上传

本次准备的仓库名为 **StardewDUO**；应用和模组目前仍使用 StardewDS 的产品名称及身份，不因仓库名改变。

当前内部仓库包含开发历史、设备记录和曾经提交过的游戏素材，**不要将内部仓库或它的 Git 历史直接推送到公开 GitHub**。上传对象必须是 `tools/export-public-source.cjs` 从已提交的干净源码快照生成的新目录。`SOURCE-MANIFEST.json` 列出公开文件及 SHA-256；公开目录不含内部 `.git`、`HANDOFF.md`、存档、素材包、配对密钥、签名密钥、设备备份或构建产物。

1. 在新的空目录中导出源码，核对 `SOURCE-MANIFEST.json`，运行 `npm ci` 和 `npm run test:public`。导出必须基于固定的已提交快照，不能混入正在编辑的工作区文件。
2. 在 GitHub 创建**空仓库**，不要勾选自动生成 README、许可证或 `.gitignore`。MIT 许可证、第三方许可、隐私及安全说明均已在源码目录中。
3. 仅在公开源码目录运行 `git init`、`git add .`、`git commit`，设置该目录的 `origin` 后推送。不要把内部仓库设为公开仓库，也不要从内部仓库推送任何分支或标签。
4. 推送后查看 GitHub Actions 的 Source checks 是否通过；本机测试不能代替云端结果。

源码仓库就绪不代表可以上传 APK。公开发行另需从同一干净源码构建 App、模组和素材导出工具，使用维护者保管的发布签名，运行 `tools/check-distribution.cjs` 并编写对应版本的发行清单。**不要上传**本机私有素材包、`control-key.json`、签名密钥、存档、设备日志或当前开发测试 APK。历史 beta.1 的验证结果不自动适用于后续开发版。
