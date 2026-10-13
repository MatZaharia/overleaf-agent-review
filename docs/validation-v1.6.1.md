# v1.6.1 validation / 验证记录

Review highlights now use a separate clipped layer below webpage dialogs. Visible page modals temporarily hide highlights, compact cards and the details/import panel. Closing the modal restores display without cancelling the pending token, moving source selection, changing progress or writing source. Hidden dialog templates do not block review; nested visible dialogs remain blocking until all close. Modal detection observes relevant DOM changes without polling or responding to the extension's own layout changes.

审阅高亮改为独立且裁剪到编辑器范围的显示层。网页弹窗打开时，高亮、小卡片和详情/导入面板暂时隐藏，关闭后恢复，不取消待确认令牌、不移动源码光标、不修改进度或正文。隐藏的弹窗模板不影响审阅；多个弹窗均关闭后才恢复。

Full context and concise changes are mutually exclusive perspectives in details. The chosen perspective persists through previous/next navigation, acceptance, compact/details switching and temporary page modals during the current session. Source refreshes still use the exact guarded edit ranges.

完整上下文与简洁对比互斥显示。本次会话中，上一项、下一项、接受后跳转、精简/详情切换和网页弹窗关闭均保留所选视角。显示切换不改变实际写入范围或原有校验。

## Checks

- `npm ci`, `npm test` (128 passing tests), `npm run build`, `npm run build:demo`, `npm run package`, `git diff --check`.
- Tests cover dialog visibility, opening/closing, multiple dialogs, hidden templates and ignoring extension/editor mutations; existing guarded writes, undo/redo and 10,000-item checks pass.
- Synthetic CodeMirror browser fixture: modal hides all three review surfaces in compact and details modes; closing retains item 1/4 or 2/4, source line and zero writes.
- Full-context mode hides the combined comparison. Next retains full-context mode at 2/4; accepting changes only the author range and advances to 2/3 in full-context mode. Compact/details round-trip retains that perspective.
- Switching back to concise changes and navigating retains the concise perspective.
- Public package uses an explicit file allowlist; no private manuscript, account/project identifier, pairing token or working-directory files are included.

## Updating / 更新

Overwrite the existing unpacked extension folder, reload the extension, ensure Overleaf has saved the source and refresh its tab. Resume the saved review without clearing progress.

覆盖原扩展目录，重新加载扩展，确认 Overleaf 正文已保存后刷新页面并恢复审阅。不需要清除进度。
