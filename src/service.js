'use strict';
const Core = require('./suggestions');
const Rebase = require('./rebase');
const I18n = require('./i18n');
const Diff = require('./reviewDiff');
const Navigation = require('./navigation');

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
      const edits=data.edits.map(p=>({...p})).sort((a,b)=>a.from-b.from||a.to-b.to);
      const current=Rebase.render(data.base,edits);
      const ledger={base:data.base,current,edits,history:(data.history||[]).map(p=>({...p})),version:0};Rebase.remember(ledger,edits);
      ledgers.set(key(adapter.projectId(),file),ledger);
    }
    const view=adapter.view();if(view&&adapter.path())ledgerFor(adapter.projectId(),adapter.path(),textOf(view));
    return {ok:true,journal:drain()}; }
  function ledgerFor(owner,file,text){
    const id=key(owner,file);let ledger=ledgers.get(id);
    if(ledger){const update=Rebase.sync(ledger,text);if(!update.ok){ledger.invalid=true;return ledger}ledger.invalid=false;if(update.replace||update.edits.length)journals.push({file,edits:update.edits,replace:update.replace,removed:update.removed,decisions:update.decisions})}
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
      if(ledger.invalid)return {...failure('position_mismatch'),journal:drain()};
      let cache=navigationCache.get(view.state.doc);
      if(typeof view.state.doc.length!=='number'||!cache||cache.ledger!==ledger||cache.version!==ledger.version){cache={ledger,version:ledger.version,positions:new Map()};navigationCache.set(view.state.doc,cache)}
      if(!cache.indexed || cache.catalogId!==params.catalogId){cache.catalogId=params.catalogId;cache.complete=false;cache.indexed=new Map()}
      scan={id:crypto.randomUUID(),view,doc:view.state.doc,text,file,ledger,cache:cache.positions,index:cache,cursor:view.state.selection.main.head};
      const cached=Boolean(params.catalogId && cache.complete);
      const excluded=new Set(params.excludedIndexes || []);
      const target=cached?Navigation.nearest([...cache.indexed.values()].filter(p=>!excluded.has(p.index)),scan.cursor,params.direction,params.currentIndex):null;
      return {ok:true,scanId:scan.id,file,cursor:scan.cursor,cached,target,journal:drain()};
    }
    if(!scan || scan.id!==params.scanId || view!==scan.view || file!==scan.file ||
       (typeof view.state.doc.length==='number'?view.state.doc!==scan.doc:textOf(view)!==scan.text) || view.state.selection.main.head!==scan.cursor)return failure('navigation_changed');
    if(!Array.isArray(params.items)||params.items.length>128)return failure('invalid_navigation');
    const matches=[];let processed=0;const started=performance.now();
    for(const entry of params.items){
      const item=Core.normalizeItem(entry.item);
      if(item.file===file){
        const identity=entry.item.reviewKey || JSON.stringify(item);
        if(!scan.cache.has(identity)){
          const match=Rebase.resolve(scan.text,item,scan.ledger);
          const edits=match.ok?(match.characterChanges || characterEdits(match.patch,scan.text)):null;
          if(scan.cache.size>=10000)scan.cache.clear();
          scan.cache.set(identity,edits?.length?{from:edits[0].from,to:edits[edits.length-1].to}:null);
        }
        const position=scan.cache.get(identity);
        if(position){const match={index:entry.index,...position};matches.push(match);scan.index.indexed.set(entry.index,match)}
      }
      processed++;
      if(performance.now()-started>=8)break;
    }
    if(params.complete===true && !params.items.length && scan.index.catalogId)scan.index.complete=true;
    return {ok:true,scanId:scan.id,processed,matches};
  }
  async function prepare(params) {
    const item = Core.normalizeItem(params.item), owner = params.projectId;
    cancel(); const attempt = generation;
    if (!current(owner)) return failure('project_changed');
    const reveal=params.reveal!==false;
    const ready = reveal ? await adapter.open(item.file, owner) : adapter.path()===item.file;
    if (attempt !== generation) return failure('cancelled');
    if (!current(owner)) return failure('project_changed');
    if (!ready || adapter.path() !== item.file) return failure('file_not_ready');
    const view = adapter.view();
    if (!view) return failure('file_not_ready');
    const text = textOf(view);
    const ledger=ledgerFor(owner,item.file,text);
    const match = ledger.invalid?failure('position_mismatch'):Rebase.resolve(text,item,ledger);
    if (!match.ok) return {...match,journal:drain()};
    const highlights = characterEdits(match.patch, text);
    if (!highlights) return failure('diff_too_complex');
    const diff=Diff.parts(match.patch,highlights);
    const token = crypto.randomUUID();
    pending = { item, reviewKey:params.item.reviewKey, projectId: owner, token, view, text, doc:view.state.doc, line:match.line };
    const shown = await preview.show({ reveal, token, runProjectId: owner, path: item.file, base: text, patch: match.patch, highlightPatches: highlights, diff,
      labels: I18n.previewLabels(item,match.line,language) });
    if (attempt !== generation) { preview.clear({ token }); return failure('cancelled'); }
    if (!shown.ok && shown.code !== 'review_preview_unsupported') { cancel(); return failure('file_not_ready'); }
    pending.inline = shown.ok;
    return { ok: true, token, diff, item: {...item,original:match.patch.expected,replacement:match.patch.insert}, line: match.line, inline: shown.ok, journal:drain() };
  }
  async function status(params) {
    const item = pending;
    if (!item || item.token !== params.token) return failure('expired');
    if (!current(item.projectId)) { cancel(); return failure('project_changed'); }
    if (adapter.path() !== item.item.file) { cancel(); return failure('file_changed'); }
    const view = adapter.view();
    if (!view) { cancel(); return failure('file_not_ready'); }
    if (view !== item.view || (typeof view.state.doc.length==='number' ? view.state.doc!==item.doc : textOf(view)!==item.text)) {
      const result = await prepare({ item: {...item.item,reviewKey:item.reviewKey}, projectId: item.projectId, reveal:false });
      if(!result.ok&&['original_missing','already_applied','ambiguous_match','scope_missing','ambiguous_scope','overlapping_change','position_mismatch','no_change','diff_too_complex'].includes(result.code))pending={...item,view,doc:view.state.doc,text:textOf(view),inline:false,stale:result.code};
      return { ...result, refreshed: result.ok };
    }
    if(item.stale)return {...failure(item.stale),journal:drain()};
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
    const text = textOf(view),ledger=ledgerFor(item.projectId,item.item.file,text), match = ledger.invalid?failure('position_mismatch'):Rebase.resolve(text, item.item, ledger);
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
      if (ledger?.current===text && match.baselineChanges) { const edits=match.baselineChanges.map(p=>({...p,reviewKey:item.reviewKey}));Rebase.add(ledger,edits);Rebase.remember(ledger,edits);ledger.current=expected;journals.push({file:item.item.file,edits}); }
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
