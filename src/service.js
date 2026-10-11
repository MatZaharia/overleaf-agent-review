'use strict';
const Core = require('./suggestions');
const Rebase = require('./rebase');
const I18n = require('./i18n');

const { characterEdits } = require('./characterEdits');
function create({ adapter, preview, crypto }) {
  let pending = null, generation = 0, scan = null, language='zh-CN';
  const receipts = new Map(), ledgers = new Map();
  let journals=[];const textCache=new WeakMap(), navigationCache=new WeakMap();
  function textOf(view){const doc=view.state.doc;if(typeof doc.length!=='number')return doc.toString();if(!textCache.has(doc))textCache.set(doc,doc.toString());return textCache.get(doc)}
  const drain=()=>{const value=journals.map(entry=>({...entry,id:crypto.randomUUID()}));journals=[];return value};
  function begin(saved={}) { cancel(); ledgers.clear();journals=[];
    for(const [file,data] of Object.entries(saved.ledgers||{})){
      if(typeof data.base!=='string'||!Array.isArray(data.edits))continue;
      let current=data.base;for(const p of [...data.edits].sort((a,b)=>b.from-a.from||b.to-a.to))current=current.slice(0,p.from)+p.insert+current.slice(p.to);
      ledgers.set(key(adapter.projectId(),file),{base:data.base,current,edits:data.edits,version:0});
    }return {ok:true}; }
  function ledgerFor(owner,file,text){
    const id=key(owner,file);let ledger=ledgers.get(id);
    if(ledger){const update=Rebase.sync(ledger,text);if(!update.ok)ledger=null;else if(update.edits.length)journals.push({file,edits:update.edits,replace:update.replace})}
    if(!ledger){ledger={base:text,current:text,edits:[],version:0};ledgers.set(id,ledger);journals.push({file,base:text,edits:[]})}
    return ledger;
  }
  function snapshot() { const view=adapter.view(); return view ? {ok:true,projectId:adapter.projectId(),file:adapter.path(),source:textOf(view)} : failure('file_not_ready'); }
  const key = (owner,file) => owner+'/'+file;
  const failure = code => ({ ok: false, code, changedDocument: false });
  const current = projectId => projectId && adapter.projectId() === projectId;
  function cancel() {
    generation++;
    if (pending) preview.clear({ token: pending.token });
    pending = null; scan = null;
    return { ok: true };
  }
  function navigation(params){
    if(!current(params.projectId))return failure('project_changed');
    const view=adapter.view(),file=adapter.path();
    if(!view || !view.state.selection?.main)return failure('file_not_ready');
    if(!params.scanId){
      const text=textOf(view),ledger=ledgerFor(params.projectId,file,text);
      let cache=navigationCache.get(view.state.doc);
      if(typeof view.state.doc.length!=='number'||!cache||cache.ledger!==ledger||cache.version!==ledger.version){cache={ledger,version:ledger.version,positions:new Map()};navigationCache.set(view.state.doc,cache)}
      scan={id:crypto.randomUUID(),view,doc:view.state.doc,text,file,ledger,cache:cache.positions,cursor:view.state.selection.main.head};
      return {ok:true,scanId:scan.id,file,cursor:scan.cursor,journal:drain()};
    }
    if(!scan || scan.id!==params.scanId || view!==scan.view || file!==scan.file ||
       (typeof view.state.doc.length==='number'?view.state.doc!==scan.doc:textOf(view)!==scan.text) || view.state.selection.main.head!==scan.cursor)return failure('navigation_changed');
    if(!Array.isArray(params.items)||params.items.length>32)return failure('invalid_navigation');
    const matches=[];let processed=0;const started=performance.now();
    for(const entry of params.items){
      const item=Core.normalizeItem(entry.item);
      if(item.file===file){
        const identity=entry.item.reviewKey || JSON.stringify(item);
        if(!scan.cache.has(identity)){
          const match=Rebase.resolve(scan.text,item,scan.ledger);
          const edits=match.ok?characterEdits(match.patch,scan.text):null;
          if(scan.cache.size>=10000)scan.cache.clear();
          scan.cache.set(identity,edits?.length?{from:edits[0].from,to:edits[edits.length-1].to}:null);
        }
        const position=scan.cache.get(identity);
        if(position)matches.push({index:entry.index,...position});
      }
      processed++;
      if(performance.now()-started>=8)break;
    }
    return {ok:true,scanId:scan.id,processed,matches};
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
    const text = textOf(view);
    const match = Rebase.resolve(text,item,ledgerFor(owner,item.file,text));
    if (!match.ok) return {...match,journal:drain()};
    const highlights = characterEdits(match.patch, text);
    if (!highlights) return failure('diff_too_complex');
    const token = crypto.randomUUID();
    pending = { item, projectId: owner, token, view, text, doc:view.state.doc, line:match.line };
    const shown = await preview.show({ token, runProjectId: owner, path: item.file, base: text, patch: match.patch, highlightPatches: highlights,
      labels: I18n.previewLabels(item,match.line,language) });
    if (attempt !== generation) { preview.clear({ token }); return failure('cancelled'); }
    if (!shown.ok && shown.code !== 'review_preview_unsupported') { cancel(); return failure('file_not_ready'); }
    pending.inline = shown.ok;
    return { ok: true, token, item: {...item,original:match.patch.expected,replacement:match.patch.insert}, line: match.line, inline: shown.ok, journal:drain() };
  }
  async function status(params) {
    const item = pending;
    if (!item || item.token !== params.token) return failure('expired');
    if (!current(item.projectId)) { cancel(); return failure('project_changed'); }
    if (adapter.path() !== item.item.file) { cancel(); return failure('file_changed'); }
    const view = adapter.view();
    if (!view) { cancel(); return failure('file_not_ready'); }
    if (view !== item.view || (typeof view.state.doc.length==='number' ? view.state.doc!==item.doc : textOf(view)!==item.text)) {
      const result = await prepare({ item: item.item, projectId: item.projectId });
      return { ...result, refreshed: result.ok };
    }
    const result=item.inline ? preview.read({ token: item.token }) : { ok: true, token: item.token, decision: null };
    if(result.navigation===-1 || result.navigation===1)preview.consumeNavigation({token:item.token});
    return result;
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
    const text = textOf(view), match = Rebase.resolve(text, item.item, ledgerFor(item.projectId,item.item.file,text));
    if (!match.ok) { cancel(); return {...match,journal:drain()}; }
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
      result = adapter.path() === item.item.file && current(item.projectId) && adapter.view() === view && textOf(view) === expected
        ? { ok: true, changedDocument: true, verified: true, file: item.item.file, line: match.line, serverSaved: null }
        : { ok: false, code: 'write_unconfirmed', changedDocument: true, serverSaved: null };
    } catch (error) { result = { ok: false, code: 'write_unconfirmed', changedDocument: true, error: error.message }; }
    if (result.verified) {
      const ledger=ledgers.get(key(item.projectId,item.item.file));
      if (ledger?.current===text && match.baselineChanges) { Rebase.add(ledger,match.baselineChanges); ledger.current=expected;journals.push({file:item.item.file,edits:match.baselineChanges}); }
      else ledgers.delete(key(item.projectId,item.item.file));
    }
    result.journal=drain();
    receipts.set(item.token, result);
    if (receipts.size > 500) receipts.delete(receipts.keys().next().value);
    return result;
  }
  function setLanguage(params){language=I18n.normalize(params.language);if(pending?.inline)preview.labels({labels:I18n.previewLabels(pending.item,pending.line,language)});return {ok:true}}
  return { prepare, status, apply, cancel, begin, snapshot, navigation, setLanguage };
}
module.exports = { create };
