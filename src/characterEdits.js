'use strict';
const { diffChars } = require('diff');
// Unicode code-point diff; editor positions are UTF-16 offsets. Equal runs are
// never included in a write. All disjoint changes share one atomic transaction.
function characterEdits(patch, source) {
  const replacement = source.includes('\r\n') ? patch.insert.replace(/\r?\n/g, '\r\n') : patch.insert;
  const parts = diffChars(patch.expected, replacement, { timeout: 1000, maxEditLength: 4096 });
  if (!parts) return null; // Never fall back to a whole-sentence replacement.
  const changes = []; let offset = patch.from, pending = null;
  const flush = () => { if (pending) changes.push(pending); pending = null; };
  for (const part of parts) {
    if (!part.added && !part.removed) { flush(); offset += part.value.length; continue; }
    if (!pending) pending = { from: offset, to: offset, insert: '' };
    if (part.removed) { offset += part.value.length; pending.to = offset; }
    if (part.added) pending.insert += part.value;
  }
  flush();
  return changes.map(change => ({ ...change, expected: source.slice(change.from, change.to) }));
}
module.exports = { characterEdits };
