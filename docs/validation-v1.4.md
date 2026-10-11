# v1.4 validation / v1.4 验证

Date: 2026-10-11.

- 64 Node tests pass. Added coverage for pack-order navigation boundaries, source-order cursor selection, deferring without rejecting/writing, token cancellation before switching, live character positions, stale/ambiguous filtering, scan invalidation after source/cursor/file/project changes, adjacent-edit rebasing and document/semantic cache invalidation.
- Built actual extension bundles were exercised in the Codex in-app browser with the real CodeMirror demo. The persistent fixture uses a dedicated Worker and browser IndexedDB to simulate extension messaging; it is not an installed upgraded extension or a live Overleaf pairing test.
- Previous/next switching left the source unchanged. Moving the editor cursor to the abstract and choosing cursor-previous found the author suggestion.
- A deliberately reordered pack `[abstract, title, author]` navigated from abstract to author and back by cursor position, independently of JSON order.
- Deferring abstract, accepting title, then rejecting author returned to abstract. Title acceptance produced exactly one character change (`P` → `p`), with no extra writes from navigation. Refresh/resume retained the pending abstract and did not replay the accepted title or rejected author.
- With approximately 610,000 source characters and 10,000 suggestions (two valid targets and 9,998 stale targets), a cursor-next search reached item 10,000 in approximately 2.55 seconds; reverse navigation using cached positions took approximately 0.30 seconds. Measurements include browser tool/UI round-trip overhead. The source write counter stayed at one, solely from the fixture's explicit long-document insertion.
- Searches send at most 32 items per RPC and stop each matching batch after an 8 ms target budget, checked between items. This is not a hard per-item runtime guarantee. RPC message tasks allow input/render opportunities. Navigation caches are invalidated by document or baseline changes, and navigation never authorizes a write.

首次万项查找可能耗时数秒，显示查找状态，可停止；同一正文的后续查找复用定位缓存。光标查找仅在当前文件内选择可定位的未决定项，搜索中正文、文件或光标变化会要求重试。没有可匹配的候选时保留当前项，不做拒绝或强制替换。

Existing live-Overleaf verification and remaining limitations are documented in the README and [v1.2 notes](validation-v1.2.md). The new navigation was validated in a browser fixture; every live Overleaf layout and collaborative editing scenario has not been separately tested.
