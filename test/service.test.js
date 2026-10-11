const test = require('node:test');
const assert = require('node:assert/strict');
const Service = require('../src/service');
const item = { id: 'one', file: 'main.tex', original: 'old', replacement: 'new' };
function fixture() {
 let text = 'lead\nold\ntail', project = 'owner', file = 'main.tex', sequence = 0;
 const writes = [], view = { dom: { isConnected: true }, state: { doc: { toString: () => text } }, dispatch({ changes: p }) { for (const change of [...p].reverse()) text = text.slice(0,change.from)+change.insert+text.slice(change.to); writes.push(...p); } };
 const preview = { show: async () => ({ ok: true }), read: () => ({ ok: true, decision: null }), clear: () => ({ ok: true }) };
 const adapter = { projectId: () => project, path: () => file, view: () => view, open: async target => { file = target; return true; } };
 const service = Service.create({ adapter, preview, crypto: { randomUUID: () => 'token-'+(++sequence) } });
 return { service, adapter, preview, writes, view, get text(){return text}, edit(value){text=value}, project(value){project=value}, file(value){file=value}, prepare: () => service.prepare({ item, projectId: 'owner' }) };
}
test('prepare and preview never dispatch writes; accepting applies only the one item', async () => {
 const h = fixture(), pending = await h.prepare(); assert.equal(h.writes.length,0);
 const result = h.service.apply({token:pending.token}); assert.equal(result.verified,true); assert.equal(h.writes.length,1); assert.equal(h.text,'lead\nnew\ntail'); assert.equal(result.serverSaved,null);
});
test('acceptance relocates using CURRENT source after unrelated edits', async () => {
 const h = fixture(), pending = await h.prepare(); h.edit('extra text\nlead\nold\ntail');
 const result=h.service.apply({token:pending.token}); assert.equal(result.ok,true); assert.equal(h.writes[0].from,16);
});
test('changed original after preview is skipped without a write', async () => {
 const h = fixture(), pending = await h.prepare(); h.edit('lead\nchanged\ntail');
 const result=h.service.apply({token:pending.token}); assert.equal(result.code,'original_missing'); assert.equal(h.writes.length,0);
});
test('already-applied after preview is skipped without a second replacement', async () => {
 const h = fixture(), pending = await h.prepare(); h.edit('lead\nnew\ntail');
 assert.equal(h.service.apply({token:pending.token}).code,'already_applied'); assert.equal(h.writes.length,0);
});
test('duplicated original introduced while reviewing is skipped', async () => {
 const h = fixture(), pending = await h.prepare(); h.edit('old old');
 assert.equal(h.service.apply({token:pending.token}).code,'ambiguous_match'); assert.equal(h.writes.length,0);
});
test('refreshing pending preview does not write and maps to fresh coordinates', async () => {
 const h = fixture(), pending = await h.prepare(); h.edit('new prefix\nold');
 const status=await h.service.status({token:pending.token}); assert.equal(status.refreshed,true); assert.notEqual(status.token,pending.token); assert.equal(h.writes.length,0);
 assert.equal(h.service.apply({token:pending.token}).code,'expired'); assert.equal(h.service.apply({token:status.token}).ok,true);
});
test('receipt tokens are idempotent and no replay occurs', async () => {
 const h = fixture(), pending = await h.prepare(), first=h.service.apply({token:pending.token}), second=h.service.apply({token:pending.token});
 assert.deepEqual(first,second); assert.equal(h.writes.length,1);
});
test('project/file changes never write to the new destination', async () => {
 for(const changed of ['project','file']) {
  const h=fixture(),pending=await h.prepare(); h[changed]('other'); const result=h.service.apply({token:pending.token}); assert.equal(result.ok,false); assert.equal(h.writes.length,0);
 }
});
test('cancel during delayed file opening prevents a late preview', async () => {
 const h=fixture();let finish;h.adapter.open=()=>new Promise(resolve=>{finish=resolve});const pending=h.prepare();h.service.cancel();finish(true);assert.equal((await pending).code,'cancelled');assert.equal(h.writes.length,0);
});
test('unverified dispatch preserves unknown result and is never reissued', async () => {
 const h=fixture();h.view.dispatch=()=>{throw new Error('unknown')};const pending=await h.prepare();const result=h.service.apply({token:pending.token});assert.equal(result.code,'write_unconfirmed');assert.equal(result.changedDocument,true);assert.equal(h.service.apply({token:pending.token}),result);
});
test('inline navigation is consumed once without a decision, write or token replacement',async()=>{
 const h=fixture();let navigation=1;
 h.preview.read=()=>({ok:true,decision:null,navigation});h.preview.consumeNavigation=()=>{navigation=null};
 const pending=await h.prepare(),result=await h.service.status({token:pending.token});
 assert.equal(result.navigation,1);assert.equal(result.decision,null);assert.equal((await h.service.status({token:pending.token})).navigation,null);assert.equal(h.writes.length,0);
 assert.equal(h.service.apply({token:pending.token}).verified,true);
});
test('switching language updates pending labels without source edits or losing the acceptance token',async()=>{
 const h=fixture(),labels=[];h.preview.labels=p=>labels.push(p.labels);
 const pending=await h.prepare();h.service.setLanguage({language:'en'});assert.equal(labels[0].accept,'Accept this item');assert.equal(labels[0].previous,'Previous item');
 h.service.setLanguage({language:'zh-CN'});assert.equal(labels[1].accept,'接受这一项');assert.equal(h.writes.length,0);assert.equal(h.service.apply({token:pending.token}).verified,true);
});
test('preview character diffs refresh from live source with no implicit editor write',async()=>{
 const h=fixture();let shown;h.preview.show=async p=>{shown=p;return {ok:true}};
 const pending=await h.prepare();assert.deepEqual(pending.diff,shown.diff);assert.equal(pending.diff.before.map(p=>p.text).join(''),'old');assert.equal(pending.diff.after.map(p=>p.text).join(''),'new');
 h.edit('prefix\nlead\nold\ntail');const refreshed=await h.service.status({token:pending.token});assert.equal(refreshed.refreshed,true);assert.deepEqual(refreshed.diff,pending.diff);assert.equal(h.writes.length,0);
});

test('typing elsewhere refreshes highlights without reopening, selecting or scrolling; explicit navigation reveals again',async()=>{
 const h=fixture(),shown=[];let opens=0;
 h.adapter.open=async()=>{opens++;return true};
 h.preview.show=async params=>{shown.push(params);return {ok:true}};
 let p=await h.prepare();assert.equal(shown.at(-1).reveal,true);assert.equal(opens,1);
 for(const prefix of ['manual\n','manual\nsecond\n']){
  h.edit(prefix+'lead\nold\ntail');p=await h.service.status({token:p.token});
  assert.equal(p.refreshed,true);assert.equal(shown.at(-1).reveal,false);assert.equal(opens,1);
 }
 await h.prepare();assert.equal(shown.at(-1).reveal,true);assert.equal(opens,2);assert.equal(h.writes.length,0);
});
