# v1.5.3 validation / 验证记录

This patch reconciles editor undo with accepted character edits and the pending review queue. It keeps the original baseline and unrelated accepted edits; a manual change remains external and cannot be overwritten by a suggestion. Undo reconciliation updates the saved journal and accepted decision in one IndexedDB transaction, including when the remaining edit list becomes empty. Older saved edits acquire ownership only through exact baseline matching against a saved written suggestion.

本次修复撤销后无法重新定位及影响其他建议的问题。撤销对应的建议重新进入待审队列，数量、循环导航和光标导航同步更新。保留原文基准和其他已接受修改；手动编辑仍须通过字符核验，不能被建议覆盖。空修改记录也会正确保存，更新旧版本无需清空全部进度。

## Automated checks / 自动检查

- `npm ci`, `npm test`, `npm run build`, `npm run build:demo` and `npm run package`.
- 109 tests, including CodeMirror's real history undo/redo commands: insertions, deletions, Unicode, disjoint character edits, out-of-order acceptance, stale preview recovery, idempotent tokens, worker restart, legacy records, retained rejections and live pending counts.
- A 10,000-accepted-edit fixture undoes one edit and verifies that the other 9,999 anchors and reconstructed source remain exact. Rebuilding uses one joined sequence of source slices, avoiding repeated whole-document copies.

## Browser checks / 浏览器检查

Tested in a synthetic local CodeMirror page using the actual extension bundles, browser IndexedDB and an extension messaging fixture. The page does not connect to Overleaf or read a private manuscript.

1. Accept two independent suffix deletions in one suggestion, then use the native editor undo shortcut. The current card returns from `1 / 2` to `2 / 3`; the editor keeps focus at the undone line.
2. Select the previous item. The restored original is highlighted again with exactly the two suffix deletions, without another source write.
3. Accept the word replacement on a distant line, undo, and navigate from the cursor. The original `very` and replacement `slightly` are located on the correct line.
4. Stop review, undo a written edit, reload the page and resume. Saved accepted decisions are reconciled before the first card, and undone suggestions are reviewable again without clearing progress.

测试使用合成正文；在浏览器真实撤销后验证数量、字符差异、上一项和光标定位，并验证停止后撤销、刷新恢复的流程。未在用户私人 Overleaf 项目中自动接受建议。

While review is active, source checks refresh the queue without selecting or scrolling the source. If review has already ended or was stopped, use **Resume last review / 恢复上次审阅**; the corresponding file is reconciled when checked. Rejections remain decided. Redo never triggers an automatic editor write. If a large or conflicting source change cannot be reconciled safely, mapped writes stay disabled rather than discarding the baseline.
