# v1.5.1 validation

Previous/Next navigation cycles through the pending queue, using both panels and the review card arrow keys. Accepted, rejected and skipped suggestions are excluded. With two pending items, either direction reaches the other; with one, navigation keeps the current item. Cursor-relative source navigation retains its positional meaning.

Checks include wrapping from either boundary, excluding decided items, a bounded scan of 10,000 suggestions, and runner navigation without source writes or count changes. A real CodeMirror localhost fixture tests `2 / 2` → `1 / 2` → `2 / 2`, both directions, the left preview arrows and ↑/↓ keys. Single-item navigation remains `1 / 1` and does not write source.

Run `npm ci`, `npm test`, `npm run build`, `npm run build:demo`, and `npm run package`. The synthetic fixture does not connect to Overleaf's server or use private manuscript text.
