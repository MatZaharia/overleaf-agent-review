# v1.5.2 validation / 验证记录

## Fixes

- Passive source refresh updates preview coordinates and tokens without reopening the file, selecting text, focusing a card, or scrolling the editor. Explicit item navigation still reveals the target.
- If manual editing invalidates the pending original, the card disables acceptance and waits for explicit navigation/dismissal. Navigation records the stale item once as skipped; typing does not advance the queue or steal focus.
- Restored journal chunks are sorted by baseline coordinates before constructing the position index. A regression reproduces an out-of-order restore that previously changed nearby characters instead of `matters:`. It now produces `shows how` at the intended position. Mapped edit ranges must equal their baseline expected characters before preview or write.
- Cursor navigation keeps a completed index for the current immutable source document, tracking ledger and pack session. Repeated cursor moves reuse positions and exclude newly settled items. A document, ledger or pack change invalidates the index. Partial searches cannot mark it complete after source/cursor changes.
- Matching caches at most two LF/CRLF line/offset indexes, avoiding a source-prefix walk and line splitting per suggestion. Navigation reuses the already prepared character edits and transports bounded batches (up to 128 items, with a text-size limit and an 8 ms page-service work budget).

## Checks

`npm ci`, `npm test` (97 tests), `npm run build`, `npm run build:demo`, and `npm run package` pass. Coverage includes stale/ambiguous guards, Unicode/CRLF coordinates, character-only atomic writes, restore order, passive refresh, cache invalidation, decision exclusion, cyclic navigation, pairing/CLI and progress persistence.

Browser checks use the actual extension bundles in a synthetic CodeMirror page with a worker messaging shim and browser-native IndexedDB. No private manuscript or live Overleaf project is used.

1. Pending item at line 93: click a different source line (54), append `manual-one`, wait for preview refresh, then append `manual-two`. Both strings remain on line 54; source focus stays in the editor. Explicit Next reveals line 184.
2. Edit the pending original itself: acceptance is disabled, typing continues on the same source line, and the queue remains on the stale card. Explicit Next skips that item and updates the remaining counter.
3. Restore two accepted edits in reverse document order. Before/after preview is `A negative result matters: and end` → `A negative result shows how and end`; accepting writes that exact result, with unchanged surrounding characters preserved.
4. Worker-backed pack with 10,000 independently locatable suggestions and approximately 670,000 source characters: first cursor navigation took **2,093 ms** and 315 page navigation requests; the next took **17 ms** and 2 requests. Rejecting the current item and navigating backwards took **10 ms**, 2 requests, and showed `2 / 9999`, excluding the rejected item. Navigation made zero source writes.
5. A local Node comparison of the previous and revised service on a similar 670,000-character, 10,000-item fixture measured first-index matching at **14,031 ms → 2,101 ms**. The cached query took **0.74 ms**; this query measurement excludes browser/worker transport and preview rendering.

Timings are observations on the development machine, not a latency guarantee. A changed source must be matched again; a first scan of a large pack can still take seconds. Real Overleaf layouts and collaborative editing need separate verification. Updating the extension requires reloading it and refreshing the Overleaf tab; no pairing token or private document is included in the package.

## 中文说明

正文变化时只刷新预览，不抢回源码光标或滚动位置。手动改掉当前原文时提示失效、禁用接受，等用户主动导航后再跳过。修复了乱序历史修改恢复造成的位置偏移，并核对映射后的原文字符。万项光标查找建立索引后重复导航复用缓存；正文或建议包变化时重新校验。上述浏览器验证仅使用本地合成稿件，不代表已在用户的私人 Overleaf 项目中完成验证。更新扩展后需重新加载并刷新 Overleaf 页面。
