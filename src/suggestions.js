'use strict';
const MAX_PACK_BYTES = 64 * 1024 * 1024;
function normalizePath(value) {
  if (typeof value !== 'string' || value.length > 512 || /[\\\x00-\x1f]/.test(value) || value.startsWith('/') || /^[a-z]:/i.test(value)) throw new Error('文件路径必须是项目内的相对路径');
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..') || !/\.(tex|bib|sty|cls|bst|bbx|cbx|lbx|cfg|def|clo|ist|txt|md|latex)$/i.test(value)) throw new Error('只支持项目内的文本文件');
  return value;
}
function normalizeItem(raw, index = 0) {
  if (!raw || typeof raw !== 'object' || typeof raw.original !== 'string' || !raw.original.length || typeof raw.replacement !== 'string') throw new Error('每项必须包含非空 original 和字符串 replacement');
  if (raw.original.length > 200000 || raw.replacement.length > 200000) throw new Error('单项修改过长');
  const context = raw.context || {};
  const item = { id: String(raw.id ?? index + 1), file: normalizePath(raw.file ?? raw.path), original: raw.original, replacement: raw.replacement, reason: typeof raw.reason === 'string' ? raw.reason : '' };
  for (const key of ['before', 'after']) {
    const value = raw[key] ?? context[key] ?? '';
    if (typeof value !== 'string' || value.length > 10000) throw new Error('上下文必须是文本且不超过 10000 字符');
    item[key] = value;
  }
  if (raw.scope !== undefined) {
    if (!raw.scope || typeof raw.scope.start !== 'string' || !raw.scope.start || typeof (raw.scope.end ?? '') !== 'string') throw new Error('scope 必须包含 start，可选 end，均为原文标记');
    item.scope = { start: raw.scope.start, end: raw.scope.end ?? '' };
  }
  return item;
}
function parsePack(input) {
  if (typeof input === 'string' && new TextEncoder().encode(input).length > MAX_PACK_BYTES) throw new Error('建议包不能超过 64 MiB');
  const pack = typeof input === 'string' ? JSON.parse(input) : input;
  if (!pack || pack.format !== 'codex-overleaf-suggestions' || pack.version !== 1 || !Array.isArray(pack.suggestions) || !pack.suggestions.length || pack.suggestions.length > 10000) throw new Error('需要 codex-overleaf-suggestions v1 建议包，含 1–10000 项');
  if (pack.projectId !== undefined && (typeof pack.projectId !== 'string' || !/^[a-f0-9]{24}$/i.test(pack.projectId))) throw new Error('projectId 必须是 Overleaf 项目 ID');
  const suggestions = pack.suggestions.map(normalizeItem);
  if (new Set(suggestions.map(s => s.id)).size !== suggestions.length) throw new Error('每项 id 必须唯一');
  return { format: pack.format, version: 1, projectId: pack.projectId || undefined, suggestions };
}
const logical = text => text.replace(/\r\n/g, '\n');
function occurrences(text, value, from = 0, to = text.length) {
  if (!value) return [];
  const found = [];
  for (let pos = text.indexOf(value, from); pos >= 0 && pos + value.length <= to; pos = text.indexOf(value, pos + 1)) {
    found.push(pos);
    if (found.length > 10000) break;
  }
  return found;
}
// At most two source snapshots: the baseline and current document.
const sourceIndexes = new Map();
function upper(array, offset, inclusive = true) {
  let lo = 0, hi = array.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (inclusive ? array[mid] <= offset : array[mid] < offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function sourceIndex(source) {
  if (sourceIndexes.has(source)) return sourceIndexes.get(source);
  const text = logical(source), lines = [0], carriageReturns = [];
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) lines.push(at + 1);
  for (let at = source.indexOf('\r\n'); at >= 0; at = source.indexOf('\r\n', at + 2)) carriageReturns.push(at - carriageReturns.length);
  const rawLines = carriageReturns.length ? lines.map(at => at + upper(carriageReturns, at, false)) : lines;
  const value = { text, lines, rawLines, carriageReturns };
  if (sourceIndexes.size >= 2) sourceIndexes.delete(sourceIndexes.keys().next().value);
  sourceIndexes.set(source, value);
  return value;
}
function lineAtSource(source, offset) { return upper(sourceIndex(source).rawLines, offset); }
function locate(source, rawItem) {
  const indexed=sourceIndex(source);
  const item = normalizeItem(rawItem), text = indexed.text, old = logical(item.original), next = logical(item.replacement);
  const before = logical(item.before), after = logical(item.after);
  let start = 0, end = text.length;
  if (item.scope) {
    const starts = occurrences(text, logical(item.scope.start));
    if (starts.length !== 1) return { ok: false, code: starts.length ? 'ambiguous_scope' : 'scope_missing' };
    start = starts[0];
    if (item.scope.end) {
      const ends = occurrences(text, logical(item.scope.end), start + logical(item.scope.start).length);
      if (!ends.length) return { ok: false, code: 'scope_missing' };
      end = ends[0];
    }
  }
  const anchored = (at, value) => (!before || text.slice(Math.max(0, at - before.length), at) === before)
    && (!after || text.slice(at + value.length, at + value.length + after.length) === after);
  if (old === next) return { ok: false, code: 'no_change' };
  const applied = occurrences(text, next, start, end).filter(at => anchored(at, next));
  const matches = occurrences(text, old, start, end).filter(at => anchored(at, old)
    && !applied.some(done => done <= at && done + next.length >= at + old.length));
  if (matches.length !== 1) return { ok: false, code: matches.length > 1 ? 'ambiguous_match' : applied.length ? 'already_applied' : 'original_missing' };
  const offset = matches[0];
  // LF uses direct UTF-16 offsets; CRLF uses the cached removed-CR index.
  const from = offset + upper(indexed.carriageReturns, offset, false);
  const endOffset = offset + old.length;
  const to = endOffset + upper(indexed.carriageReturns, endOffset, false);
  return { ok: true, patch: { from, to, expected: source.slice(from, to), insert: next }, line: upper(indexed.lines, offset) };
}
const skipped = {
  position_mismatch: '定位后的字符与原文不一致，跳过',
  overlapping_change: '与已接受修改重叠冲突，跳过',
  diff_too_complex: '字符差异过于复杂，跳过',
  original_missing: '原文或上下文已经变化，跳过', already_applied: '已经应用，跳过', ambiguous_match: '匹配到多处原文，跳过',
  scope_missing: '板块标记已经变化，跳过', ambiguous_scope: '板块标记不唯一，跳过', no_change: '内容没有变化，跳过',
  file_not_ready: '文件或 Code 编辑器未就绪，跳过', file_changed: '当前文件已切换，跳过', editor_changed: '编辑器状态已变化，跳过'
};
module.exports = { parsePack, normalizeItem, normalizePath, locate, skipped, MAX_PACK_BYTES, lineAtSource };
