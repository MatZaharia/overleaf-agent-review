# Agent guide / Agent 操作指南

## 中文：发送审阅建议

目标是把用户的修改意见变成可逐项确认的建议包，并送到 Overleaf 插件。Agent 不直接改正文。此接口使用本地命令行和 JSON，不绑定 Codex；目前以 Codex 验证流程，其他 Agent 集成尚未单独验证。

### 前提

- Node.js 22+。运行时不需要安装 npm 依赖；仓库或解压的发布包包含 CLI 及其依赖源码。
- 用户已在 Chrome 安装插件，并完成[本地连接配对](local-bridge.md)。服务需要保持运行，目标 Overleaf 标签页需要保持打开。配对由用户完成，Agent 不应擅自安装扩展或修改浏览器权限。
- 知道目标项目 URL 和实际文件路径。项目 ID 是 URL `/project/` 后的 24 位十六进制字符串，不要使用演示 ID。
- 掌握与意见对应的精确 LaTeX 原文，来源可以是用户提供的片段、已有文件或可选的按需读取。

### 生成、校验、发布

1. 在仓库或解压目录中创建 `work/`，把建议包保存为 UTF-8 的 `work/suggestions.json`。使用 JSON 序列化工具生成文件，避免 shell 转义损坏 LaTeX。完整字段见 [README](../README.zh-CN.md#建议包格式)，最小结构如下：

```json
{
  "format": "codex-overleaf-suggestions",
  "version": 1,
  "projectId": "0123456789abcdef01234567",
  "suggestions": [
    {
      "id": "title-case",
      "file": "main.tex",
      "original": "\\title{Your Paper}",
      "replacement": "\\title{Your paper}",
      "reason": "标题中的 Paper 改为小写 paper"
    }
  ]
}
```

这个示例 ID 和标题只用于演示，必须替换成用户项目与实际原文。项目改名后协议标识仍保留 `codex-overleaf-suggestions`，以兼容现有建议包。

2. 把每项设计为一个独立决定。尽量细到字、词或标点；为安全定位，可以在 original 中包含更长的准确片段，插件仍只写入变化的字符。短原文容易重复时，用紧邻的 `before` / `after` 或唯一的 `scope.start` / `scope.end` 限定位置。空 replacement 表示删除；纯插入需要包含相邻的非空原文作为锚点。不要用模糊匹配或行号定位。
3. 校验后发布，`PROJECT_ID` 必须换成实际 ID：

```sh
node bridge/cli.js validate --file work/suggestions.json --project PROJECT_ID
node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json
```

服务配置在其他目录时，为 publish / status / read 加 `--config /absolute/path/work/bridge.json`。validate 不读取配置、不联网、不需要配对。校验只检查格式、限制、ID 唯一性及指定项目，不能保证原文在当前页面匹配；定位与过时检查在插件中执行。

发布成功返回形如 `{"ok":true,"revision":1,"count":1}`。这表示本地服务收到建议，插件将在下一次检查时获取；不表示页面已经显示，更不表示正文已修改。向用户报告“已提交 N 项，版本 R，等待逐项确认”。保留 JSON 文件供手动导入或排查。

### 反馈与更新

需要反馈时运行：

```sh
node bridge/cli.js status --project PROJECT_ID
```

`revision` 是当前包版本，`results` 包含 `id`、`state`、`code`、时间。结果可能比页面落后约两秒；空 results 不证明用户拒绝或建议失效。`written` 表示编辑器写入核验成功，仍应通过 Overleaf 检查保存/编译。`rejected` 表示用户拒绝，`skipped` 的原因在 code 中。`unknown` 表示写入结果未核验，不得自动重放。只在需要时查状态，不持续轮询，不唤醒 Agent 或向聊天推消息。

每次 publish **替换整个建议包**，不会追加。更新前考虑已有反馈，发送完整的下一版本。ID、文件、原文、替换、上下文和范围均未变的已接受/拒绝项可保留决定，修改 reason 不会要求重新审阅；不要通过改 ID 强行重新提出已拒绝项。确需重新审阅，应遵循用户的新指令。可以移除已完成项；如果没有剩余建议，不要发布空包，直接报告完成。

相邻修改可在插件基准定位中组合，但同一字符的修改会冲突。尽量避免重叠、避免用之前可能改变的文字作为唯一上下文；过时、已应用或不唯一的项会跳过，不要以扩大替换范围或模糊匹配的方式强行应用。用户接受后才会在实时源码中进行字符替换。

### 可选：按需读取当前正文

只在缺少所需原文或需要确认当前内容时使用：

```sh
node bridge/cli.js read --project PROJECT_ID --file main.tex --output work/current.tex
```

此命令主动请求一次当前打开文件的源码，最多等待 10 秒，不会自动打开目标文件或读取全项目，不回退到旧快照。`--file` 核对实际打开文件；超时或文件不匹配时，应激活正确标签页/文件后重试。无需持续同步正文。令牌文件和稿件内容不要提交到公开仓库。

### 失败时如何交付

校验失败：修复 JSON，不发布。连接失败：保留校验好的文件，说明尚未送达，提供[连接说明](local-bridge.md)或让用户手动导入；不要自动接受或改网页正文作为替代。不要反复启动服务：已有服务监听固定端口时使用现有配置。

## English: deliver review suggestions

Use this repository to **generate → validate → publish → let the user review**. Source reading is optional when exact source is already available. The CLI and JSON interface are provider-independent; the workflow has been developed with Codex, while other Agent integrations have not been separately verified.

1. Obtain the actual project ID from the Overleaf URL and the project-relative file path. Copy original text from source you have seen; never guess it. Node.js 22+ is required. Runtime CLI commands work from the repository or extracted release without npm installation.
2. Generate a UTF-8 `work/suggestions.json` in the format shown above. Replace the example ID and source. Keep `format: "codex-overleaf-suggestions"` and `version: 1` for compatibility. Make each item one independent decision, preferably a small character/word/punctuation change. Use exact adjacent context or a unique scope for ambiguous originals. An empty replacement deletes text; an insertion needs a nonempty neighboring original as its anchor. Even a longer original is applied as character edits.
3. Run `validate --file work/suggestions.json --project PROJECT_ID`, using the full CLI command above. It is offline and requires no token. It checks pack validity, not live matching.
4. With a running, user-paired bridge and the target tab open, run `publish --project PROJECT_ID --file work/suggestions.json`. Use `--config /absolute/path/work/bridge.json` for a service started elsewhere. Follow [setup](local-bridge.md) if not paired. Never expose or commit the token. Report the returned revision and count as **submitted for review**, not applied or necessarily displayed. Do not directly write source or automate acceptance.
5. Use `status --project PROJECT_ID` when feedback is needed. Results can lag behind the page by roughly two seconds. Empty results are not proof of rejection or failure. `written` is a verified editor write; Overleaf still governs save/compile. `rejected` is a user decision, and `skipped` includes a reason code. `unknown` means an unverified write. Do not replay unverified writes or continuously poll/wake an Agent.
6. Publishing replaces the complete pack. Send the complete intended next revision, not just an append-only fragment. Retain stable IDs and unchanged content/context/scope to preserve accepted/rejected decisions. A changed reason alone does not reset a decision. Do not rename IDs to resubmit rejected items without new user instructions. Remove completed items if appropriate; with no remaining suggestions, report completion rather than publishing an empty pack.
7. Prefer independent nonoverlapping suggestions. Nearby edits can compose, while changes to the same characters conflict. Stale, applied or ambiguous matches are skipped; do not force them with fuzzy or expanded replacement. Only explicit user acceptance writes the live source.
8. If exact source is missing, optionally request one fresh active-file snapshot with `read --project PROJECT_ID --file main.tex --output work/current.tex`. It waits up to ten seconds, does not navigate or export the whole project, and never falls back to an old snapshot. Activate the correct tab/file before retrying.
9. If delivery fails, provide the validated JSON file for manual import and state that it has not been delivered. Do not substitute direct editor writes. Preserve private manuscripts and token files outside Git.
