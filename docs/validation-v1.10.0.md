# v1.10.0 validation / 验证记录

Details includes **Accept all** with a modal confirmation of the remaining count and current review scope. Cancel is focused by default. Approval covers only the pending indexes in that confirmation; it does not include saved rejections or writes, other files outside the selected scope, or items reopened later by undo. No source changes occur before confirmation.

详情新增“全部接受”，先用确认框显示剩余数量和当前审阅范围，默认聚焦“取消”。仅授权确认时的待处理集合，不包含已有接受／拒绝决定、范围外文件或后续撤销重新出现的项；确认前不写入正文。

Each item uses the existing prepare/apply freshness, character matching, ownership and write-verification checks. Stale and ambiguous items are skipped. Stop, invalidated extension, changed producer revision and an unconfirmed write end the old authorization. A suspended file never reuses the previous choice. After stopping or reloading, resume returns to individual review; another batch needs another confirmation. Completion returns to setup.

逐项使用现有定位、字符匹配、权限与写入核验。过时或不唯一的建议跳过；停止、扩展失效、建议版本更新或写入未确认都会结束旧授权。文件切换挂起不会复用上一项的批准。停止／刷新后恢复为逐项审阅，再次批量接受需重新确认；完成后回到管理页。

## Checks

- 179 automated tests pass. Dependency install, extension/demo/package builds and diff checks pass.
- Batch tests cover pending-only plans for 10,000 indexes; sequential preparation and guarded writes; stale skips; saved rejections; cancellation; uncertain writes; lost ownership; file suspension; and consumed approvals after undo. Keyboard tests ensure Enter on Accept all opens confirmation rather than accepting a single item. Chinese/English confirmation and progress messages are covered.
- Synthetic browser validation uses real CodeMirror, IndexedDB and the existing SharedWorker fixture, with no real Overleaf edits or automatic extension installation.
- Cancelling the three-item current-file confirmation causes zero editor writes. Confirming it writes two valid items and skips a stale item; the fourth suggestion in another file remains outside the scope. Confirmation shows the filename and count.
- An English confirmation excludes a previously rejected suggestion. Confirming the one remaining item preserves the rejection, writes only the remaining item and returns directly to setup.
- A 200-item synthetic batch is stopped partway through. In this run, 17 decisions were saved and 183 remained pending. Resume displays individual review of the 183 pending suggestions without further writes. The exact number processed before Stop depends on event timing.
- Browser warnings/errors and the unhandled-error count remain empty/zero.
- The ZIP uses an explicit allowlist and excludes pairing configuration, work files, private manuscripts, user screenshots and local paths.

## Updating / 更新

Reload the extracted extension, ensure Overleaf saved your source, refresh the page and resume review without clearing progress. The new action is in Details. Agents continue to publish suggestions only; users trigger and confirm bulk acceptance themselves.

解压并重新加载扩展，确认 Overleaf 正文已保存后刷新，恢复上次审阅，不必清除进度。“全部接受”入口在详情页；Agent 仍只提交建议，由用户触发并确认批量接受。
