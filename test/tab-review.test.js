const test=require('node:test'),assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb'),{webcrypto}=require('node:crypto');
const Progress=require('../src/progress'),Catalog=require('../src/catalog'),Tabs=require('../src/tabReview');
const project='0123456789abcdef01234567';
const pack={format:'codex-overleaf-suggestions',version:1,projectId:project,suggestions:[
 {id:'main-a',file:'main.tex',original:'old a',replacement:'new a'},
 {id:'other',file:'sections/other.tex',original:'old b',replacement:'new b'},
 {id:'main-c',file:'main.tex',original:'old c',replacement:'new c'}]};
function fixture(){
 const db=new IDBFactory(),progress=Progress.create(db,webcrypto),catalog=Catalog.create(webcrypto),events=[],values={};let time=1000;
 const storage={async get(key){return {[key]:structuredClone(values[key])}},async set(v){Object.assign(values,structuredClone(v))}};
 const deps={progress,catalog,storage,crypto:webcrypto,now:()=>time,broadcast:async(owners,event)=>events.push({owners:structuredClone(owners),event:structuredClone(event)})};
 let service=Tabs.create(deps);
 const who=tabId=>({tabId,clientId:'page-'+tabId});
 const send=(tabId,message)=>service.handle(project,who(tabId),message);
 const start=(tabId,file,source=pack)=>send(tabId,{type:'session',pack:source,acquire:true,file});
 return {start,send,progress,catalog,events,values,who,advance:ms=>{time+=ms},restart(){service=Tabs.create(deps)},forget:tabId=>service.forget(tabId),direct:(w,m)=>service.handle(project,w,m)};
}
test('two tabs get bounded independent file queues, full pack stays available for resume',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex'),b=await f.start(2,'sections/other.tex');
 assert.equal(a.reviewPack.count,2);assert.equal(b.reviewPack.count,1);assert.equal(a.pack.ref,b.pack.ref);assert.equal(a.pack.count,3);
 assert.deepEqual(f.catalog.items(project,a.reviewPack.ref,0).map(i=>i.file),['main.tex','main.tex']);
 assert.equal(f.catalog.items(project,b.reviewPack.ref,0)[0].file,'sections/other.tex');assert.equal(f.catalog.items(project,b.reviewPack.ref,0)[0].sourceIndex,1);assert.equal(f.catalog.items(project,a.reviewPack.ref,0)[1].sourceIndex,2);
 assert.notEqual(a.lease,b.lease);assert.deepEqual(a.summary,{total:3,confirmed:0,pending:3});
});
test('simultaneous acquisition is serialized, same-file and all-files conflicts block before a write',async()=>{
 const f=fixture(),results=await Promise.allSettled([f.start(1,'main.tex'),f.start(2,'main.tex')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/其他标签页/);
 await assert.rejects(f.start(3,''),/其他标签页/);
 await f.start(4,'sections/other.tex');
});
test('all-files review remains available but is exclusive to one tab per project',async()=>{
 const f=fixture(),s=await f.start(1,'');assert.equal(s.reviewPack.count,3);
 await assert.rejects(f.start(2,'sections/other.tex'),/其他标签页/);
 await f.send(1,{type:'reviewRelease',lease:s.lease});await f.start(2,'sections/other.tex');
});
test('saved decision broadcasts shared project counts without navigating or preparing either page',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex'),b=await f.start(2,'sections/other.tex');
 const item=f.catalog.items(project,a.reviewPack.ref,0)[0];
 await f.send(1,{type:'progress',lease:a.lease,decision:{reviewKey:item.reviewKey,state:'written'},journal:[{file:'main.tex',base:'old a old c',edits:[]}]});
 const shared=f.events.at(-1);assert.equal(shared.owners.length,2);assert.equal(shared.event.summary.confirmed,1);assert.equal(shared.event.updates[0].file,'main.tex');assert.equal(shared.event.type,'reviewShared');
 assert.equal((await f.send(2,{type:'reviewRenew',lease:b.lease})).summary.pending,2);
 await f.send(1,{type:'progress',lease:a.lease,decision:{reviewKey:item.reviewKey,state:'written'}});
 assert.equal(f.events.at(-1).event.summary.confirmed,1);
});
test('cross-file journals and decisions are rejected atomically',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex'),b=await f.start(2,'sections/other.tex'),other=f.catalog.items(project,b.reviewPack.ref,0)[0];
 await assert.rejects(f.send(1,{type:'progress',lease:a.lease,journal:[{file:'main.tex',base:'safe'},{file:'sections/other.tex',base:'wrong'}]}),/file mismatch/);
 await assert.rejects(f.send(1,{type:'progress',lease:a.lease,decision:{reviewKey:other.reviewKey,state:'written'}}),/file mismatch/);
 assert.deepEqual((await f.progress.load(project)).ledgers,{});assert.deepEqual((await f.progress.load(project)).decisions,{});
});
test('worker restart and long background suspension preserve ownership until explicit stop or close',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex');f.restart();
 await assert.rejects(f.start(2,'main.tex'),/其他标签页/);
 f.advance(86400000);assert.equal((await f.send(1,{type:'reviewRenew',lease:a.lease})).ok,true);await assert.rejects(f.start(2,'main.tex'),/其他标签页/);
 await f.forget(1);const b=await f.start(2,'main.tex');
 await assert.rejects(f.send(1,{type:'reviewRenew',lease:a.lease}),{code:'review_lease_lost'});
 await assert.rejects(f.send(1,{type:'progress',lease:a.lease,journal:[{file:'main.tex',base:'old'}]}),{code:'review_lease_lost'});
 assert.equal((await f.send(2,{type:'reviewRenew',lease:b.lease})).ok,true);
});
test('refreshing a tab replaces only its old page permission; stale page cannot persist',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex'),b=await f.start(2,'sections/other.tex');
 const fresh=await f.direct({tabId:1,clientId:'refreshed'},{type:'session',acquire:true,pack,file:'main.tex'});
 assert.equal(fresh.ok,true);await assert.rejects(f.send(1,{type:'reviewRenew',lease:a.lease}),{code:'review_lease_lost'});
 assert.equal((await f.send(2,{type:'reviewRenew',lease:b.lease})).ok,true);
});
test('release frees file immediately; old token cannot release a refreshed session',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex');await f.send(1,{type:'reviewRelease',lease:a.lease});
 const b=await f.start(2,'main.tex');await f.send(2,{type:'reviewRelease',lease:a.lease});
 assert.equal((await f.send(2,{type:'reviewRenew',lease:b.lease})).ok,true);
});
test('replacing pack or clearing shared progress waits for other reviewers to stop',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex'),b=await f.start(2,'sections/other.tex');
 const changed={...pack,suggestions:pack.suggestions.map(i=>({...i,replacement:i.replacement+'!'}))};
 await assert.rejects(f.start(3,'main.tex',changed),/先停止/);
 await assert.rejects(f.send(3,{type:'clearProgress'}),/先停止/);
 await assert.rejects(f.send(3,{type:'clearTracking',file:'main.tex'}),/先停止/);
 assert.equal((await f.send(3,{type:'clearTracking',file:'unrelated.tex'})).ok,true);
 assert.equal((await f.progress.load(project)).pack.suggestions[0].replacement,'new a');
 await f.send(1,{type:'reviewRelease',lease:a.lease});await f.send(2,{type:'reviewRelease',lease:b.lease});
 const c=await f.start(3,'main.tex',changed);assert.equal(c.ok,true);
});
test('undo broadcasts only reopened written decisions, preserving rejection and other file journal',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex'),b=await f.start(2,'sections/other.tex'),ia=f.catalog.items(project,a.reviewPack.ref,0)[0],ib=f.catalog.items(project,b.reviewPack.ref,0)[0];
 await f.send(1,{type:'progress',lease:a.lease,decision:{reviewKey:ia.reviewKey,state:'written'},journal:[{file:'main.tex',base:'old a',edits:[]}]});
 await f.send(2,{type:'progress',lease:b.lease,decision:{reviewKey:ib.reviewKey,state:'rejected'},journal:[{file:ib.file,base:'old b',edits:[]}]});
 await f.send(1,{type:'progress',lease:a.lease,journal:[{file:'main.tex',replace:true,edits:[],decisions:[{reviewKey:ia.reviewKey,state:'pending'}]}]});
 assert.equal(f.events.at(-1).event.summary.confirmed,1);assert.equal(f.events.at(-1).event.updates[0].state,'pending');
 const saved=await f.progress.load(project);assert.equal(saved.decisions[ia.reviewKey],undefined);assert.equal(saved.decisions[ib.reviewKey].state,'rejected');assert.equal(saved.ledgers[ib.file].base,'old b');
});
test('active catalogs survive repeated parses in other tabs and same-pack startup avoids key rehash',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex');
 for(let i=0;i<10;i++)f.catalog.parse(project,{...pack,suggestions:[{...pack.suggestions[0],id:'temporary-'+i}]});
 assert.equal(f.catalog.items(project,a.reviewPack.ref,0)[0].id,'main-a');
 const original=f.progress.savePack;f.progress.savePack=()=>assert.fail('unchanged pack must not be saved again');
 const b=await f.start(2,'sections/other.tex');assert.equal(b.ok,true);f.progress.savePack=original;
});
test('project/file ownership applies to shared status and no-suggestions scopes acquire no lease',async()=>{
 const f=fixture();await assert.rejects(f.start(1,'missing.tex'),/没有审阅建议/);
 assert.equal(Object.keys(f.values.reviewLeases||{}).length,0);
 await assert.rejects(f.start(2,'../private.tex'),/项目内/);
 await assert.rejects(f.start(3,'main.tex',{...pack,projectId:'ffffffffffffffffffffffff'}),/Project mismatch/);
 const a=await f.start(4,'main.tex');
 await assert.rejects(f.direct({tabId:5,clientId:'page-4'},{type:'reviewRenew',lease:a.lease}),{code:'review_lease_lost'});
});
test('stopped tabs still receive progress and undo summaries; closing a tab removes its subscriptions',async()=>{
 const f=fixture(),a=await f.start(1,'main.tex'),b=await f.start(2,'sections/other.tex');
 await f.send(2,{type:'reviewRelease',lease:b.lease});
 const item=f.catalog.items(project,a.reviewPack.ref,0)[0];
 await f.send(1,{type:'progress',lease:a.lease,decision:{reviewKey:item.reviewKey,state:'written'}});
 assert.equal(f.events.at(-1).owners.length,2);assert.equal(f.events.at(-1).event.summary.confirmed,1);
 await f.forget(2);await f.send(1,{type:'progress',lease:a.lease,decision:{reviewKey:item.reviewKey,state:'written'}});assert.equal(f.events.at(-1).owners.length,1);
 await f.send(1,{type:'reviewRelease',lease:a.lease});await f.send(2,{type:'clearProgress'});
 assert.deepEqual(f.events.at(-1).event.summary,{total:0,confirmed:0,pending:0});
});
test('10,000 suggestions stay paged across two scopes; shared counts update without reloading the pack',async()=>{
 const f=fixture(),large={...pack,suggestions:Array.from({length:10000},(_,i)=>({id:String(i),file:i%2?'sections/other.tex':'main.tex',original:'old '+i,replacement:'new '+i}))};
 const began=performance.now(),a=await f.start(1,'main.tex',large),b=await f.start(2,'sections/other.tex',large);
 assert.equal(a.reviewPack.count,5000);assert.equal(b.reviewPack.count,5000);assert.equal(a.reviewPack.suggestions,undefined);
 assert.ok(f.catalog.items(project,a.reviewPack.ref,0).length<=32);
 const ia=f.catalog.items(project,a.reviewPack.ref,0)[0];
 f.progress.load=()=>assert.fail('progress updates and renewals must not reload the full pack');
 f.progress.fingerprint=()=>assert.fail('renewal must not rehash the pack');
 await f.send(1,{type:'progress',lease:a.lease,decision:{reviewKey:ia.reviewKey,state:'rejected'}});
 const renewed=await f.send(2,{type:'reviewRenew',lease:b.lease});assert.equal(renewed.summary.pending,9999);
 console.log('10k two-tab scoped startup and decision sync:',Math.round(performance.now()-began),'ms');
});
