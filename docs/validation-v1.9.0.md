# v1.9.0 validation / 验证记录

The detail and setup screens use consistent controls, a compact header and a fixed search/action footer. Full context uses parallel before/after panes above 560px panel width and stacked panes on narrower panels. Compact diff and full context are mutually exclusive perspectives. Changing views preserves the pending item, search query and saved decisions. Stop returns directly to setup after cancellation; the existing write-verification and ownership checks remain in place.

详情和管理页统一控件与工具栏，搜索和操作区固定在底部。宽于 560px 的面板并排显示原文与修改后，窄面板上下排列。简洁对比与完整上下文互斥显示，切换保留当前建议、搜索词和已保存的决定。停止直接返回管理页，保留既有写入核验和文件／标签页权限检查。

Manual paste and JSON file import share a collapsed setup section. The file handler retains its input reference before asynchronous file reading so clearing the chooser does not use a cleared event target. The bridge pairing token remains private and is never part of a suggestion pack.

## Checks

- 171 automated tests pass. Extension and demo builds pass. New keyboard regression coverage ensures Enter on a comparison-view control does not accept a suggestion; Chinese and English labels are covered.
- Synthetic browser testing uses real CodeMirror, IndexedDB and the existing SharedWorker fixture; no production manuscript is edited and no extension is automatically installed.
- Review navigation retains the full-context perspective; search matches originals/replacements and keeps the query through compact/detail and setup switches. Acceptance updates the pending counter and project count. Stop returns directly to setup; resume restores saved decisions.
- English/Chinese switching works. Width resizing switches between parallel and stacked panes. The final parallel layout fills available content height without clipping the panes behind the footer.
- A 50-line synthetic reason scrolls within the content area while the footer keeps the same top/bottom position. Next-item navigation preserves the selected comparison perspective. Browser warnings/errors and unhandled errors remain empty/zero.
- Manual pasted JSON starts review. File import displays its filename and clears the file chooser without an unhandled exception.
- The release ZIP is produced from the explicit allowlist, excluding work files, local pairing configuration, manuscripts and private screenshots.

## Updating / 更新

Extract the new extension ZIP, reload the extension from that extracted folder, ensure Overleaf saved your edits, refresh the page and resume review. Keep existing saved progress; clearing it is unnecessary. For local Agent connections, reconnect on the refreshed page.

解压新安装包，从新目录重新加载扩展，确认 Overleaf 已保存正文后刷新页面，再恢复上次审阅。不必清除进度；刷新后如需本地 Agent 连接，请重新配对连接。
