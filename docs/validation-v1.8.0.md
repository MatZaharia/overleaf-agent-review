# v1.8.0 validation / 验证记录

Details includes a search field for original and replacement suggestion text. Literal, case-insensitive matches are separate from normal and cursor navigation; previous/next match wrap in pending queue order. The query persists across navigation and view changes. Acceptance, rejection and skipping filter existing result indices; undo can restore them. Current-file review uses only its scoped catalog. Search never reads or edits the online document.

详情新增建议搜索，匹配原文和修改后，按字面检索、不区分英文大小写。搜索导航与普通导航、光标导航独立，并在待处理结果中循环。搜索词跨建议和界面切换保留；已处理项移出结果，撤销后可恢复。当前文件模式只搜索本页队列。搜索本身不读取或写入在线正文。

Search is debounced for 250 ms and uses the existing bounded catalog pages (at most 32 items and normally 128 KiB per response). It yields after each batch and retains only the last query’s matching indices. Obsolete queries and stopped sessions cancel further reads; failures allow retry. Rendering does not create a result list for every item. Enter inside the input navigates to the next match; Shift+Enter goes back. Input typing and arrow keys do not accept or navigate the ordinary review queue.

Long original/after text limits now follow the detail panel’s container height rather than a fixed 180 px cap. Short texts retain their natural size. Removing the large card focus outline changes only CSS: deferred focus, keyboard shortcuts and individual control focus indicators remain.

## Checks

- `npm ci` reports no vulnerabilities; `npm test` passes 168 tests; extension/demo/package builds and `git diff --check` pass.
- Search tests cover originals/replacements independently, Chinese, literal regex characters, deletions, absent matches, cache reuse, pending decisions and undo, circular ordering, obsolete scans, stop, retry and translated labels/counts. A 10,000-item search reads 313 bounded batches with yields and reuses its cached indices for an unchanged query.
- A synthetic browser fixture with real CodeMirror, IndexedDB and a SharedWorker searches two results, navigates forward and wraps, finds replacement-only `SLIGHTLY`, retains the query after navigation, removes an accepted item from results and restores it after editor undo. Missing matches disable search navigation; English UI preserves the query.
- A 10,000-item browser fixture finds the replacement of suggestion 10000 and navigates directly to it. Searching the common phrase finds all 10000 pending suggestions; Enter in the search field wraps to suggestion 1 with zero editor writes. Browser warnings/errors and the fixture’s unhandled error counter remain empty/zero. These checks do not modify an actual Overleaf manuscript or install an extension.
- The final browser build preserves search and selected item through compact/detail changes. Resizing a long-context detail panel from 400 px to 700 px grows both original/after visible text heights from 100 px to 229 px; width adjustment reflows text normally. Both cards have no large focus outline, while keyboard navigation/acceptance still work.
- The release ZIP uses the explicit allowlist, with private manuscripts, project IDs, pairing credentials and local work files excluded.

## Updating / 更新

Reload the extension, ensure Overleaf saved the source, refresh and resume review without clearing progress. Search controls are in Details. Saved decisions remain compatible.

重新加载扩展，确认正文已保存后刷新并恢复审阅，不必清除进度；搜索入口在详情界面。已有审阅决定继续兼容。
