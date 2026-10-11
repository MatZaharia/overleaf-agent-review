'use strict';
const Core = require('./suggestions');
const Rebase = require('./rebase');
const { characterEdits } = require('./characterEdits');
function create({ adapter, preview, crypto }) {
  let pending = null, generation = 0;
  const receipts = new Map(), ledgers = new Map();
  function begin() { cancel(); ledgers.clear(); return {ok:true}; }
  function snapshot() { const view=adapter.view(); return view ? {ok:true,projectId:adapter.projectId(),file:adapter.path(),source:view.state.doc.toString()} : failure('file_not_ready'); }
  const key = (owner,file) => owner+'/'+file;
  const failure = code => ({ ok: false, code, changedDocument: false });
  const current = projectId => projectId && adapter.projectId() === projectId;
  function cancel() {
    generation++;
    if (pending) preview.clear({ token: pending.token });
    pending = null;
    return { ok: true };
  }
  async function prepare(params) {
    const item = Core.normalizeItem(params.item), owner = params.projectId;
    cancel(); const attempt = generation;
    if (!current(owner)) return failure('project_changed');
    const ready = await adapter.open(item.file, owner);
    if (attempt !== generation) return failure('cancelled');
    if (!current(owner)) return failure('project_changed');
    if (!ready || adapter.path() !== item.file) return failure('file_not_ready');
    const view = adapter.view();
    if (!view) return failure('file_not_ready');
    const text = view.state.doc.toString(), id=key(owner,item.file);
    if (!ledgers.has(id)) ledgers.set(id,{base:text,current:text,edits:[]});
    const match = Rebase.resolve(text,item,ledgers.get(id));
    if (!match.ok) return match;
    const highlights = characterEdits(match.patch, text);
    if (!highlights) return failure('diff_too_complex');
    const token = crypto.randomUUID();
    pending = { item, projectId: owner, token, view, text };
    const shown = await preview.show({ token, runProjectId: owner, path: item.file, base: text, patch: match.patch, highlightPatches: highlights,
      labels: { title: '修改 ' + item.id + ' · L' + match.line, hint: '原文已高亮；接受时重新搜索，过时项跳过。', accept: '接受这一项', reject: '拒绝这一项', empty: '（删除此段）' } });
    if (attempt !== generation) { preview.clear({ token }); return failure('cancelled'); }
    if (!shown.ok && shown.code !== 'review_preview_unsupported') { cancel(); return failure('file_not_ready'); }
    pending.inline = shown.ok;
    return { ok: true, token, item: {...item,original:match.patch.expected,replacement:match.patch.insert}, line: match.line, inline: shown.ok };
  }
  async function status(params) {
    const item = pending;
    if (!item || item.token !== params.token) return failure('expired');
    if (!current(item.projectId)) { cancel(); return failure('project_changed'); }
    if (adapter.path() !== item.item.file) { cancel(); return failure('file_changed'); }
    const view = adapter.view();
    if (!view) { cancel(); return failure('file_not_ready'); }
    if (view !== item.view || view.state.doc.toString() !== item.text) {
      const result = await prepare({ item: item.item, projectId: item.projectId });
      return { ...result, refreshed: result.ok };
    }
    return item.inline ? preview.read({ token: item.token }) : { ok: true, token: item.token, decision: null };
  }
  function apply(params) {
    // A settled token returns its existing receipt, never replays an edit.
    if (receipts.has(params.token)) return receipts.get(params.token);
    const item = pending;
    if (!item || item.token !== params.token) return failure('expired');
    if (!current(item.projectId)) { cancel(); return failure('project_changed'); }
    if (adapter.path() !== item.item.file) { cancel(); return failure('file_changed'); }
    const view = adapter.view();
    if (!view?.dom?.isConnected) { cancel(); return failure('editor_changed'); }
    // Re-resolve from CURRENT source on acceptance, with no await between the
    // search and dispatch. Original lines/offsets from Codex are never used.
    const text = view.state.doc.toString(), match = Rebase.resolve(text, item.item, ledgers.get(key(item.projectId,item.item.file)));
    if (!match.ok) { cancel(); return match; }
    const changes = characterEdits(match.patch, text);
    if (!changes) { cancel(); return failure('diff_too_complex'); }
    if (!changes.length) { cancel(); return failure('no_change'); }
    let expected = text;
    for (const p of [...changes].reverse()) expected = expected.slice(0, p.from) + p.insert + expected.slice(p.to);
    const last = changes[changes.length - 1];
    const anchor = last.from + last.insert.length + changes.slice(0, -1).reduce((sum, p) => sum + p.insert.length - (p.to - p.from), 0);
    preview.clear({ token: item.token }); pending = null; generation++;
    let result;
    try {
      view.dispatch({ changes: changes.map(({ from, to, insert }) => ({ from, to, insert })), selection: { anchor }, scrollIntoView: true });
      result = adapter.path() === item.item.file && current(item.projectId) && adapter.view() === view && view.state.doc.toString() === expected
        ? { ok: true, changedDocument: true, verified: true, file: item.item.file, line: match.line, serverSaved: null }
        : { ok: false, code: 'write_unconfirmed', changedDocument: true, serverSaved: null };
    } catch (error) { result = { ok: false, code: 'write_unconfirmed', changedDocument: true, error: error.message }; }
    if (result.verified) {
      const ledger=ledgers.get(key(item.projectId,item.item.file));
      if (ledger?.current===text && match.baselineChanges) { ledger.edits.push(...match.baselineChanges); ledger.edits.sort((a,b)=>a.from-b.from); ledger.current=expected; }
      else ledgers.delete(key(item.projectId,item.item.file));
    }
    receipts.set(item.token, result);
    if (receipts.size > 500) receipts.delete(receipts.keys().next().value);
    return result;
  }
  return { prepare, status, apply, cancel, begin, snapshot };
}
module.exports = { create };
