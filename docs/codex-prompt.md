# Generate a suggestion pack / 生成建议包

## English

Using the current LaTeX source and editing instructions I provide, output a valid JSON suggestion pack. Do not edit the online manuscript directly. Each suggestion should be one independent decision; prefer the smallest character, word, or punctuation change. Use exact adjacent `before`/`after` context or a unique `scope` marker to locate short originals safely.

Format: `{"format":"codex-overleaf-suggestions","version":1,"suggestions":[{"id":"unique-id","file":"main.tex","original":"exact source","replacement":"new text","reason":"why"}]}`. Add the current `projectId` if known. `scope` takes `start` and optional `end` text markers.

Copy originals from source you have actually read, never guess or use line numbers as addresses. Escape LaTeX backslashes correctly in JSON. Use an empty replacement for deletion. Explain unresolved instructions separately rather than inventing an original. Avoid overlapping suggestions; account for earlier accepted changes when overlap is necessary.

## 中文

根据我提供的当前 LaTeX 源码和修改意见，输出合法 JSON 建议包。不要直接改在线论文。每条建议必须可独立确认，尽量细到字、词或标点；用紧邻原文的 `before`/`after` 上下文或唯一 `scope` 标记定位短原文。

格式：`{"format":"codex-overleaf-suggestions","version":1,"suggestions":[{"id":"唯一ID","file":"main.tex","original":"精确原文","replacement":"新文本","reason":"修改理由"}]}`。知道当前项目 ID 时加入 `projectId`。`scope` 包含 `start` 和可选 `end` 文本标记。

原文必须来自实际读取的源码，不猜测，不用行号作为替换地址。LaTeX 反斜杠正确转义。删除使用空 replacement。无法确定原文的意见单独说明，不加入执行包。尽量不重叠；必须重叠时考虑前项接受后的结果。

## Connected workflow / 本地连接流程

After pairing, use `node bridge/cli.js read --project PROJECT_ID --file main.tex --output work/current.tex` to read the current open source before making suggestions. Write the pack to `work/suggestions.json`, then use `node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json`. Check `status` for decisions; publishing does not accept changes. Use `--config` when the bridge config is in a different directory. Never print or include its token in a suggestion pack. See [local bridge setup](local-bridge.md).

配对后，先运行 `node bridge/cli.js read --project 项目ID --file main.tex --output work/current.tex` 读取当前打开的源码，再根据实际原文生成 `work/suggestions.json`，运行 `node bridge/cli.js publish --project 项目ID --file work/suggestions.json` 推送。通过 `status` 查看审阅结果；发布建议不代表接受修改。配置不在当前目录时加 `--config`。不要输出令牌或把令牌放入建议包。详见[连接说明](local-bridge.md)。
