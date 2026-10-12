# v1.5.4 validation / 验证记录

Chrome extension updates invalidate the extension connection in already-open pages. The old content script now catches synchronous exceptions and rejected messages/storage calls, stops review and bridge polling, clears the old inline preview, disables actions and displays a localized refresh instruction. Before acceptance, a project-checked extension ping confirms the connection is live. No automatic retry or page reload is performed.

扩展重新加载后，旧 Overleaf 页面可能仍保留旧的内容脚本。此版本统一处理消息和存储接口失效，停止审阅与连接轮询，关闭旧预览、禁用相关操作，并以中英文提示刷新。接受前先检查扩展连接；不会自动重试写入或自动刷新正文。

## Checks

- `npm ci`, `npm test`, `npm run build`, `npm run build:demo`, `npm run package` and `git diff --check`.
- 115 tests: missing runtime, synchronous invalidation errors, rejected messages, late responses, storage failures, ordinary transport errors and prevention of writes after a failed acceptance preflight.
- The background ping retains sender and Overleaf project URL checks.
- Synthetic browser fixture: invalidate the next extension message, click Accept, verify zero source writes, zero unhandled rejections, a refresh notice and disabled review controls.
- Refresh that fixture and resume the saved pack; acceptance succeeds. Invalidate the runtime during review and verify the old preview closes and review stops.

Browser checks use a simulated extension connection with the actual content script, page service, CodeMirror editor and browser IndexedDB. They do not install/reload the user's actual extension or modify a private Overleaf project.

## Recovery

Confirm Overleaf has saved the document, refresh its tab, and choose **Resume review / 恢复上次审阅**. Reconnect the Agent bridge if used. Existing saved review progress is retained. If a write was already dispatched when the extension reloaded, check the actual source before accepting again.
