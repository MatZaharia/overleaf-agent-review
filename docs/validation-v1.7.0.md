# v1.7.0 validation / 验证记录

Two tabs can review different source files in the same project. **Current file (multiple tabs)** is the default: its queue, circular navigation and cursor search are restricted to the file selected when review starts. The full project pack stays shared and can be restored in the second tab. **All files (one tab)** retains project-wide navigation and requires exclusive review of the project.

同一项目可以在两个标签页分别审阅不同文件。默认“当前文件（多标签页）”将队列、循环导航和光标搜索限定于开始审阅时的文件。完整项目建议包共享，第二页可直接恢复。“全部文件（单标签页）”保留跨文件导航，并独占项目审阅。

Each file has one active reviewer. Claims and writes to progress are serialized in the background, and ownership survives MV3 worker suspension in Chrome session storage. Background page throttling does not release a claim. Stop, top-level loading/refresh, or closing the tab releases ownership. A refreshed page replaces only its old page's claim; old page credentials cannot persist decisions or journals. Acceptance renews ownership immediately before dispatch; a delayed approval has a short deadline and stops without recording a decision. There is no remote acceptance endpoint.

每个文件只能由一个标签页审阅；后台串行处理占用与进度写入，Chrome 会话存储保留权限。后台节流不会自动释放文件；停止、刷新／导航或关闭标签页会释放。刷新后的页面仅替换旧页面权限，旧权限不能保存决定或定位记录。接受前核验权限；延迟过久的接受请求不会写入，也不会把建议记录为已处理。

File journals stay isolated. Decision notifications carry small summaries and review keys rather than source or the full suggestion pack, and cannot navigate or reposition another page. Details/setup show shared accepted/rejected project counts; local pending counters remain scoped to the file. Undo reopens only the reverted written decision and updates other pages, including stopped reviewers. Existing rejection and unrelated-file journals remain intact. Active suggestion catalogs are pinned so another tab's imports cannot evict them. Identical packs are not re-keyed or rewritten; ongoing counter updates do not reload or hash the pack.

清除共享进度要求停止所有审阅页；重建定位仅要求停止对应文件审阅。更换建议包前须停止其他页；连接同一桥接服务的页面收到新版本时先停止旧审阅，再重试新版。按需读取由当前选中的浏览器标签页响应，不切换文件。

## Checks

- `npm ci` (no vulnerabilities), `npm test` (155 passing tests), `npm run build`, `npm run build:demo`, `npm run package`, `git diff --check`.
- Two independent scopes, same-file/all-files conflicts, serialized simultaneous start, cross-file write denial, worker restart, a day of background suspension, stop/close/refresh release, old-page rejection, pack replacement and clear-progress protection.
- Shared counts, idempotent decisions, undo and rejection isolation, stopped-page notifications, source-index preservation and pinned catalog lifetime. A 10,000-item pack produces two 5,000-item paged descriptors; decision updates and permission checks perform no full-pack load/hash.
- Synthetic browser fixture uses actual CodeMirror, browser IndexedDB, a SharedWorker and the same coordinator as the extension. It does not install an extension or modify an actual Overleaf manuscript.
- Main-file tab starts at 1/3; nested-file tab restores the shared pack without pasting and starts at 1/1. A second reviewer of the same file is blocked before any write. Main acceptance changes only its requested characters and advances its own queue to 1/2; the nested-file page stays in place and reports project decisions 1/4.
- Accepting the nested-file item updates project decisions to 2/4. Undoing the main-file edit returns its queue to 2/3 and shared decisions to 1/4, including the stopped nested-file page. Resuming that nested file retains its one written decision and leaves its editor write count at one.
- Background dwell retains the main tab's current item. English labels preserve filenames, counts and manuscript text. Browser console errors/warnings are empty; the fixture reports zero unhandled errors.
- ZIP uses the explicit package allowlist. Only synthetic fixtures, source code and documentation are included; private manuscripts, project IDs, pairing credentials and local work paths are excluded.

## Updating / 更新

Overwrite the extracted extension directory, reload it in Chrome, ensure the source is saved and refresh both Overleaf tabs. Resume without clearing progress. Open a different file in each tab and keep **Current file (multiple tabs)** selected. To review the entire project in one tab, select **All files (one tab)** before starting.

覆盖解压后的扩展目录，在 Chrome 重新加载，确认正文已保存后刷新两个 Overleaf 标签页。不必清除进度。每页打开不同文件，使用“当前文件（多标签页）”恢复；单页跨文件审阅则在开始前改选“全部文件（单标签页）”。
