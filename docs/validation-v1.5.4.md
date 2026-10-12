# v1.5.4 validation / 验证记录

Chrome extension updates invalidate the extension connection in already-open pages. The old content script now catches synchronous exceptions and rejected messages/storage calls, stops review and bridge polling, clears the old inline preview, disables actions and displays a localized refresh instruction. Before acceptance, a project-checked extension ping confirms the connection is live. No automatic retry or page reload is performed.

扩展重新加载后，旧 Overleaf 页面可能仍保留旧的内容脚本。此版本统一处理消息和存储接口失效，停止审阅与连接轮询，关闭旧预览、禁用相关操作，并以中英文提示刷新。接受前先检查扩展连接；不会自动重试写入或自动刷新正文。

## Checks

- `npm ci`, `npm test`, `npm run build`, `npm run build:demo`, `npm run package` and `git diff --check`.
- 118 tests: missing runtime, synchronous invalidation errors, rejected messages, late responses, storage failures, ordinary transport errors and prevention of writes after a failed acceptance preflight.
- The background ping retains sender and Overleaf project URL checks.
- Synthetic browser fixture: invalidate the next extension message, click Accept, verify zero source writes, zero unhandled rejections, a refresh notice and disabled review controls.
- Refresh that fixture and resume the saved pack; acceptance succeeds. Invalidate the runtime during review and verify the old preview closes and review stops.

Browser checks use a simulated extension connection with the actual content script, page service, CodeMirror editor and browser IndexedDB. They do not install/reload the user's actual extension or modify a private Overleaf project.

## Recovery

Confirm Overleaf has saved the document, refresh its tab, and choose **Resume review / 恢复上次审阅**. Reconnect the Agent bridge if used. Existing saved review progress is retained. If a write was already dispatched when the extension reloaded, check the actual source before accepting again.

## Stale tracking recovery / 定位恢复

If saved tracking no longer matches the source, review pauses instead of skipping the whole pack. Click **Rebuild tracking (keep decisions)** to reset only the affected file’s baseline while retaining the pack and accepted/rejected decisions. This does not edit source. Matching then uses the current exact source; undo associations and nearby-edit context mappings from the old baseline are lost. Suggestions that no longer match are still skipped and may need an updated pack from your Agent. Avoid **Clear progress** for this repair: that action removes all saved decisions. Pack updates and manual stops now display distinct status messages.

如果提示定位记录与当前正文不一致，审阅会暂停，避免连续跳过整个建议包。点击 **重新建立定位（保留决定）**，只重建出错文件的定位基准，保留建议包以及接受／拒绝记录，不写入正文。重建后仅按当前原文严格匹配；旧基准的撤销关联和相邻修改上下文映射无法继续使用，无法精确匹配的建议仍会跳过，必要时请 Agent 更新建议。不要用“清除进度”代替这一步，后者会删除所有保存的决定。切换建议版本与手动停止也会分别显示明确的状态。

Tests cover an irreconcilable saved baseline, pausing at prepare/preview/apply without recording skips, and file/project-scoped recovery that retains all decisions (including unconfirmed writes). The synthetic browser fixture restored review twice with zero writes and zero unhandled rejections; an accepted title and rejected author remained decided, with only two pending items after recovery. Manual stop showed a readable resume instruction.
