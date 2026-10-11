const test=require('node:test'),assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb'),{webcrypto}=require('node:crypto');
const Progress=require('../src/progress'),Runner=require('../src/runner');
const project='project',item={id:'a',file:'main.tex',original:'old',replacement:'new',before:'',after:''};
const pack={format:'codex-overleaf-suggestions',version:1,suggestions:[item]};
test('progress survives a new worker, merges unchanged decisions, and reopens changed suggestions',async()=>{
 const database=new IDBFactory(),first=Progress.create(database,webcrypto);
 await first.savePack(project,pack);let state=await first.load(project),key=state.pack.suggestions[0].reviewKey;
 await first.save(project,{decision:{reviewKey:key,state:'rejected'},journal:[{id:'baseline',file:'main.tex',base:'old',edits:[]}]});
 await first.save(project,{journal:[{id:'edit',file:'main.tex',edits:[{from:0,to:3,insert:'new'}]}]});
 await first.save(project,{journal:[{id:'edit',file:'main.tex',edits:[{from:0,to:3,insert:'new'}]}]});
 const second=Progress.create(database,webcrypto);state=await second.load(project);assert.equal(state.decisions[key].state,'rejected');assert.equal(state.ledgers['main.tex'].edits.length,1);
 await second.savePack(project,{...pack,suggestions:[{...item,reason:'new explanation'}]});assert.equal((await second.load(project)).pack.suggestions[0].reviewKey,key);
 await second.savePack(project,{...pack,suggestions:[{...item,replacement:'different'}]});state=await second.load(project);assert.notEqual(state.pack.suggestions[0].reviewKey,key);assert.equal(state.decisions[state.pack.suggestions[0].reviewKey],undefined);
 assert.equal((await second.load('other-project')).pack,null);
 await second.clear(project);assert.equal((await second.load(project)).pack,null);
});
test('resume never dispatches previously accepted or rejected items, but retries stale skips',async()=>{
 let calls=0;const retained=[];const result=await Runner.run({suggestions:[{...item,reviewKey:'accepted'},{...item,reviewKey:'rejected'},{...item,reviewKey:'stale'}]},{decisions:{accepted:{state:'written'},rejected:{state:'rejected'},stale:{state:'skipped'}},assertCurrent(){},call:async()=>{calls++;return{ok:false,code:'original_missing'}},record(){},retained:result=>retained.push(result.state)});
 assert.deepEqual(retained,['written','rejected']);assert.equal(calls,1);assert.deepEqual(result.map(r=>r.state),['retained','retained','skipped']);
});
test('unknown previous write blocks resume rather than replaying it',async()=>{
 await assert.rejects(Runner.run({suggestions:[{...item,reviewKey:'unknown'}]},{decisions:{unknown:{state:'unknown'}},assertCurrent(){},call(){assert.fail('must not replay')}}),{code:'write_unconfirmed'});
});

test('normalized packs without an optional project ID can be validated again',()=>{const Core=require('../src/suggestions');assert.equal(Core.parsePack(Core.parsePack(pack)).suggestions.length,1)});
