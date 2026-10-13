# v1.7.1 validation / 验证记录

When navigation reveals a distant source target, CodeMirror completes scrolling in a later layout pass. Previously the compact card could be hidden at the initial focus attempt, then appear without keyboard focus. Focus now waits for the visible card, runs once and uses `preventScroll`. View changes, disposal and source invalidation remove pending listeners. Outside pointer, keyboard and focus activity cancels the request; switching away from the browser tab also cancels it.

远距离导航时，编辑器在后续布局中完成滚动；旧版首次尝试聚焦时卡片可能仍隐藏，显示后便没有快捷键焦点。现在等卡片可见后完成一次聚焦，不增加滚动。切换视图、关闭预览或原文变化时移除待完成请求；期间在卡片外点击、输入、改变焦点或离开浏览器标签页会取消请求，保留自由编辑行为。

Clicking the compact title, text or action buttons activates card shortcuts even when a drag handler prevents the browser's default focus or a button disables itself. A blue focus-within outline covers both the card and its focused controls. Input fields and resize controls are excluded; Tab-focused drag/resize handles retain layout keys. No document-global acceptance/navigation shortcuts were added.

点击精简卡片的标题、文字或操作按钮即可激活卡片快捷键；按钮禁用或拖动处理不会留下意外丢失的焦点。蓝框同时体现卡片及其中操作按钮的焦点。输入框与缩放手柄保留原行为；通过 Tab 聚焦移动／缩放控件后仍可微调布局。源码编辑器里的上下键与回车不会触发审阅操作。

## Checks

- `npm ci`: no vulnerabilities. `npm test`: 161 passing tests. Extension/demo/package builds and `git diff --check` pass.
- New focus regressions cover delayed visibility, single focus without scroll, Shadow DOM event retargeting, cancellation by source clicks/typing/focus, background tabs, disconnected cards, disposal and subsequent explicit navigation. Existing composing, modifier, held-key and editor-input guards still pass.
- Synthetic browser fixture with real CodeMirror: keyboard Down moves from line 2 to line 93, another Down to line 184, Up returns to line 93, and Enter applies only the intended character edit and advances to `2 / 2`. Each revealed compact card has keyboard focus without an extra click.
- Manual source ArrowUp and typing stay in the editor at line 183; refreshed preview retains `2 / 2` without stealing focus. Clicking the card title reactivates shortcuts and Up returns to the first pending item.
- Details ↗, detail-mode Down and Back to compact preserve the selected item and focus in the shown review view. A webpage modal hides review surfaces; closing it restores the item without grabbing focus. Clicking the restored title enables navigation again. Browser console warnings/errors are empty.
- Tests use synthetic text only; no actual Overleaf manuscript was modified or extension installation automated. Release ZIP uses the explicit allowlist and excludes local work files, private manuscripts and pairing credentials.

## Updating / 更新

Reload the updated extension, ensure Overleaf has saved your source, refresh the page and resume review. Saved decisions remain compatible; clearing progress is unnecessary. Clicking source intentionally removes review focus; click the card to resume its keyboard controls.

重新加载新版扩展，确认正文已保存后刷新 Overleaf，恢复审阅即可，不必清除进度。点击源码后不显示审阅蓝框是正常行为；再点击卡片即可使用审阅快捷键。
