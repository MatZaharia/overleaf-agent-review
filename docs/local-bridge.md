# Local Codex bridge / 本地 Codex 连接

## 中文

本地服务监听固定地址 `127.0.0.1:43127`，使用随机令牌鉴权。它只接收建议包、当前文件源码和审阅结果，没有远程接受或直接修改正文的接口。

1. 安装 v1.1.0 插件。Chrome 会增加本机地址访问权限；手动配对前不会传输源码。
2. 在仓库或解压后的插件目录运行 `node bridge/cli.js start`（需要 Node.js 22+）。保持终端运行。随机令牌存放在 `work/bridge.json`，文件权限为 600，不要提交或分享该文件。
3. 在 Overleaf 项目右下角打开导入面板，把配置文件中的 token 填到“本地连接配对令牌”，点击“连接 Codex”。一次只绑定当前项目；其他项目需要单独配对。
4. 连接期间当前打开文件源码每两秒同步到本机服务。点击“断开”停止传输；重新加载页面后需要再次点击连接并填写令牌。

让当前本地 Codex 在同一目录执行：

```sh
# 实时快照导出；把 PROJECT_ID 换成项目 URL 中的 ID
node bridge/cli.js read --project PROJECT_ID --file main.tex --output work/current.tex
# Codex 按 current.tex 生成修改包后发布（没有接受正文修改）
node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json
# 查看当前文件名、快照时间/哈希和逐项接受/拒绝/跳过结果
node bridge/cli.js status --project PROJECT_ID
```

在其他工作目录调用时，可传 `--config /绝对路径/work/bridge.json`。read 默认拒绝超过 10 秒的快照；`--file` 只核对当前文件，不会打开文件。需要另一文件时先在 Overleaf 打开它。浏览器/电脑休眠或标签页节流可能造成快照过时，重新激活项目页后再读。

每次 publish 替换整个建议包并递增版本。插件收到新版本后取消旧预览，展开新版等待确认。已接受的正文不会撤销或重放；因此建议重新生成时先读当前源码，只发送剩余修改。审阅结果每两秒分批反馈，可能短暂落后于页面。自动更新按收到新版本的时间生效，不保证与本机发布瞬间同步。停止审阅不会断开源码同步；需要停止传输请点击“断开”。

服务仅保存内存状态，重启后需要重新发布；配置令牌保留。建议包最大 64 MiB、10,000 项，单个源码快照最大 16 MiB。没有远程全项目读取或自动接受功能。

## English

The bridge listens on `127.0.0.1:43127` and requires a random bearer token. There is no endpoint to accept suggestions or directly write the manuscript.

Run `node bridge/cli.js start` in the repository or extracted extension directory with Node.js 22+. Keep the process running. Copy the token from `work/bridge.json` into the extension's pairing field and click **连接 Codex**. Pairing binds the current project; other projects need their own pairing. The config has mode 600 and must not be shared or committed.

While connected, the currently open file is exported to the local bridge approximately every two seconds. Use the commands above to read it, publish suggestions, and inspect review results. Substitute your own `PROJECT_ID`. `--config` accepts an absolute config path. `read` rejects snapshots older than ten seconds and `--file` checks the active file without navigating. Activate the tab if browser throttling makes snapshots stale.

A publish replaces the whole pack and increments its revision. When received, a new revision cancels the old preview and starts review without accepting any edits. Previously accepted document changes remain; read current source and send only remaining suggestions. Results are reported in batches. Updates take effect when received, rather than atomically at local publish time. Stop review does not disconnect source export; use **断开** to disconnect. Reloading requires pairing again.

Bridge state is in memory and resets on restart; the token remains in the config. Limits: 10,000 suggestions, 64 MiB per pack, 16 MiB per source snapshot. Only the active file is exported, not the whole project. Source is sent to this local process only; using it in Codex may transmit it to your selected model provider.
