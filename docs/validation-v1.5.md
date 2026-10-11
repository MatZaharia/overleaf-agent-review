# v1.5.0 validation

The bundled extension includes the separate import/review screens, pending queue position, movable/resizable panels, bilingual UI, character diff emphasis, review keyboard shortcuts and centered source navigation.

## Checks

- `npm ci`, `npm test`, `npm run build`, `npm run build:demo`, `npm run package`.
- Synthetic long-document fixture with a real CodeMirror editor; no private manuscript or pairing token is used.
- Navigate from `1 / 3` to `2 / 3`: no source write and no change to the pending total.
- Accept `2 / 3`: one character-edit transaction; original pack item #3 becomes `2 / 2`.
- Reject `2 / 2`: no source write; the deferred original item #1 returns as `1 / 1`.
- Back to import / Continue review preserves the pending item and its count without writing or rejecting.
- The review screen hides import/connection fields and contains no progress bar. English/Chinese switches preserve the queue position.
- Saved written/rejected decisions from the current pack are excluded from counts and navigation even if they occur later in original pack order. Decisions for removed/changed suggestions are ignored.
- Stale skips reduce the pending total, and an unconfirmed write still stops subsequent dispatch.

The localhost fixture verifies the UI and editor transaction behavior. Saving to Overleaf's server must be checked in the user's real project.
