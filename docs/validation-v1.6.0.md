# v1.6.0 validation / 验证记录

One compact source-adjacent review card replaces the duplicate windows. Details hide that card and return without beginning a new review or replacing its acceptance token. Setup and recent decisions are separate from review. Both presentations use a unified character diff, with display-only context elision and expandable exact before/after text. Highlights stay visible while the compact card hides.

默认显示源码旁的精简卡片；详情与小卡片互斥显示。往返切换不调用开始审阅或重新准备，不更换确认令牌，保留当前建议、进度、源码位置、面板布局和上下文展开状态。管理界面单独保留导入、连接与历史记录。两种界面共用合并字符差异，摘要缩短未变化上下文，完整文本可展开。小卡片收起时源码高亮保留。

## Automated checks

- `npm ci`, `npm test`, `npm run build`, `npm run build:demo`, `npm run package`, `git diff --check`.
- 124 tests: repeated compact/details/setup switches retain the same valid token and do not reopen or write source; stale tokens/projects are rejected; display mode/count/language survive source refresh.
- Inline-preview fallback keeps a functioning details view and guarded acceptance.
- Unified diff preserves exact original/replacement characters; elision preserves every changed segment and does not split Unicode code points.
- Existing character replacement, stale/ambiguous match, undo/redo, persisted decisions, circular/cursor navigation and 10,000-item checks continue to pass.

## Browser checks

Synthetic browser fixture with the actual extension bundles, CodeMirror and browser IndexedDB:

- Navigate to item 2/4 with Down; open details, expand context, return to compact and open details again. The same item, expanded context, source line 3 and zero document writes remain.
- Accept with Enter after switching. Only that item changes; the next pending count is 2/3. The source transaction contains only changed characters.
- Setup/Continue round-trip and Chinese/English switching retain the current item and count.
- Undo the accepted edit in the source editor while details are open. The pending count restores to 3/4 and source retains keyboard focus.
- Drag the compact card, switch to details and back. Its rectangle is unchanged.

Browser checks use non-private fixtures. The real extension installation, project pairing and manuscript acceptance remain under user control. No real Overleaf manuscript was modified in this validation.

## Updating

Overwrite the existing unpacked extension folder, reload the extension, confirm Overleaf has saved the document and refresh its tab. Resume the saved review; reconnect the Agent bridge if used. Do not clear progress for this update.

覆盖原扩展目录并重新加载，确认 Overleaf 已保存正文后刷新页面，再恢复审阅；使用 Agent 桥接时重新连接。此次更新不需要清除进度。
