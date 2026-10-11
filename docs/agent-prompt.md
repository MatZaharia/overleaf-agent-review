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

Read [AGENTS.md](../AGENTS.md) and the [Agent guide](agent-guide.md). Use the provided pack directly, or generate `work/suggestions.json` from already-written review notes with exact originals and replacements. Validate it, then publish through the paired bridge. Report the revision and count as submitted for user review. Only request source with `read` if needed. Do not directly edit the manuscript or accept suggestions automatically.

先阅读 [AGENTS.md](../AGENTS.md) 和 [Agent 操作指南](agent-guide.md)。已有建议包直接使用；已有意见含精确原文和改后文本时直接转成建议包，校验后通过已配对的连接发布，报告版本与项数，等待用户确认；需要原文时才调用 read。不要直接改稿件或自动接受。
