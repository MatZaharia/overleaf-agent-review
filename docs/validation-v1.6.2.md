# v1.6.2 validation / 验证记录

Manually changing files suspends the current suggestion instead of recording a skip and automatically opening the next suggestion's file. It preserves the queue position, decisions and perspective; acceptance is disabled while the suggestion's file is not active. Status polling neither opens files nor consumes the previous preview's queued approval/navigation. Manually returning refreshes with a new token and without source selection, focus or scroll. The old token cannot write after suspension, even if its file has become active again.

手动切换文件后，当前建议暂挂，不算跳过、不自动打开下一项所属文件。当前项、数量、已有决定和查看视角保留；离开期间禁用接受。状态检查不打开文件，也不消费旧预览的接受或导航请求。手动返回后重新校验当前正文并生成新令牌，不抢光标、焦点或滚动位置。暂挂的旧令牌不会自动恢复写入权限。

**Locate current item** explicitly opens the current suggestion's file again, without settling it. Ordinary previous/next navigation can open the chosen suggestion's file; cursor navigation searches the file currently open. An acceptance/file-switch race leaves the item pending and requires another human decision rather than replaying approval or advancing the queue.

**定位当前项** 可主动回到同一建议，不处理该项。普通上一项／下一项可跨文件导航；光标导航查找当前打开的文件。接受请求与切换文件并发时，若没有实际写入，就保留当前建议并等待新的人工决定，不重放接受、不推进队列。

File opening removes the fixed 250 ms wait and responds to DOM readiness with a bounded 50 ms fallback for store-only changes. Ready files return immediately; all temporary observers/timers are removed. Target file and changed EditorView identity remain mandatory on file switches; project changes abort waiting and fallback activation. Preview creation avoids a second redundant file-open request.

## Checks

- `npm ci`, `npm test` (137 passing tests), `npm run build`, `npm run build:demo`, `npm run package`, `git diff --check`.
- Tests cover repeated status polls while in another file, temporary missing editors, old-token rejection, file labels updating before the source editor, resuming against edited source, stale source recovery after undo, project changes and file-switch races without skips/reopening/replayed writes.
- Readiness tests verify immediate ready-file return, DOM wakeup, bounded fallback/timeout and observer/timer cleanup. Existing character edits, undo/redo, presentation and 10,000-item checks pass.
- Synthetic CodeMirror browser fixture: start at main-file suggestion 1/4, manually open a nested file and type there; the active nested file and count 1/4 remain. Details display a disabled Accept and Locate button. Locate returns to main-file 1/4 without writing.
- From the nested file, cursor-next selects its suggestion 4/4. Previous explicitly opens the main file at 3/4. Manual nested-file/main-file round-trip retains 3/4 and the user's source cursor at line 1 instead of revealing the suggestion at line 9. No additional source writes occur.
- Browser console has no errors; testing uses synthetic text only and does not operate a real Overleaf manuscript.
- Public ZIP checked against the explicit allowlist and private-material patterns.

## Updating / 更新

Overwrite the unpacked extension directory, reload the extension, ensure Overleaf has saved the source and refresh its tab. Resume review without clearing progress.

覆盖原扩展目录，重新加载扩展，确认 Overleaf 正文已保存后刷新页面并恢复审阅。不需要清除进度。
