const test=require('node:test'),assert=require('node:assert/strict');
const Runner=require('../src/runner');
const suggestions=[1,2,3].map(id=>({id:String(id),file:'main.tex',original:'old'+id,replacement:'new'+id}));
const pack={suggestions};
test('skip outdated first item and continue to review and apply later items',async()=>{
 const writes=[],records=[],seen=[];
 const result=await Runner.run(pack,{projectId:'project',assertCurrent(){},async call(method,p){
  if(method==='prepare')return p.item.id==='1'?{ok:false,code:'original_missing'}:{ok:true,token:p.item.id};
  if(method==='apply'){writes.push(p.token);return{ok:true,verified:true,changedDocument:true}};return{ok:true};
 },async review(item,p){seen.push(item.id);return{accepted:item.id==='3',token:p.token}},record:r=>records.push(r)});
 assert.deepEqual(writes,['3']);assert.deepEqual(seen,['2','3']);assert.deepEqual(result.map(r=>r.state),['skipped','rejected','written']);
});
test('no write before explicit acceptance and no batch dispatch',async()=>{
 const choices=[],writes=[];
 const pending=Runner.run(pack,{projectId:'project',assertCurrent(){},async call(method,p){if(method==='prepare')return{ok:true,token:p.item.id};if(method==='apply'){writes.push(p.token);return{ok:true,verified:true}}return{ok:true}},review:(_i,p)=>new Promise(resolve=>choices.push(v=>resolve({accepted:v,token:p.token}))),record(){}});
 await new Promise(r=>setImmediate(r));assert.equal(writes.length,0);choices[0](true);
 await new Promise(r=>setImmediate(r));assert.deepEqual(writes,['1']);choices[1](false);
 await new Promise(r=>setImmediate(r));assert.deepEqual(writes,['1']);choices[2](true);await pending;assert.deepEqual(writes,['1','3']);
});
test('target becomes stale after approval: skip apply result and continue',async()=>{
 const result=await Runner.run(pack,{projectId:'project',assertCurrent(){},async call(method,p){if(method==='prepare')return{ok:true,token:p.item.id};return p.token==='1'?{ok:false,code:'already_applied',changedDocument:false}:{ok:true,verified:true}},async review(_i,p){return{accepted:true,token:p.token}},record(){}});
 assert.deepEqual(result.map(r=>r.state),['skipped','written','written']);
});
test('unconfirmed writes stop the queue; do not replay or dispatch the next item',async()=>{
 const prepared=[],writes=[];
 await assert.rejects(Runner.run(pack,{projectId:'project',assertCurrent(){},async call(method,p){if(method==='prepare'){prepared.push(p.item.id);return{ok:true,token:p.item.id}}writes.push(p.token);return{ok:false,code:'write_unconfirmed',changedDocument:true}},async review(_i,p){return{accepted:true,token:p.token}},record(){}}),{code:'write_unconfirmed'});
 assert.deepEqual(prepared,['1']);assert.deepEqual(writes,['1']);
});
test('cancellation after choice stops before dispatch',async()=>{
 let cancelled=false,writes=0;
 await assert.rejects(Runner.run(pack,{projectId:'project',assertCurrent(){if(cancelled)throw Object.assign(new Error('cancel'),{code:'cancelled'})},async call(method){if(method==='apply')writes++;return{ok:true,token:'one'}},async review(){cancelled=true;return{accepted:true,token:'one'}},record(){}}),{code:'cancelled'});assert.equal(writes,0);
});
test('navigating forwards and backwards defers items without rejection or writes and revisits them',async()=>{
 const seen=[],writes=[],records=[];let visit=0;
 const result=await Runner.run(pack,{assertCurrent(){},async call(method,p){if(method==='prepare')return{ok:true,token:p.item.id};if(method==='apply'){writes.push(p.token);return{ok:true,verified:true}}return{ok:true}},async review(item,p){seen.push(item.id);visit++;if(visit===1)return{navigate:2};if(visit===2)return{navigate:1};return{accepted:visit===3,token:p.token}},record:r=>records.push(r)});
 assert.deepEqual(seen,['1','3','2','3','1']);assert.deepEqual(writes,['2']);assert.equal(records.length,3);assert.deepEqual(result.map(r=>r.state),['rejected','written','rejected']);
});
test('navigation expires previous acceptance tokens before preparing a different suggestion',async()=>{
 const events=[];let navigated=false;
 await Runner.run({suggestions:suggestions.slice(0,2)},{assertCurrent(){},async call(method,p){events.push(method==='prepare'?method+p.item.id:method);return{ok:true,token:p?.item?.id}},async review(_i,_p){if(!navigated){navigated=true;return{navigate:1}}return{accepted:false}},record(){}});
 assert.deepEqual(events.slice(0,3),['prepare1','cancel','prepare2']);assert.equal(events.includes('apply'),false);
});
test('live counts follow decisions, stale skips and deferrals rather than item index',async()=>{
 const snapshots=[],seen=[];let first=true;
 await Runner.run(pack,{assertCurrent(){},progress:value=>snapshots.push(value),async call(method,p){
  if(method==='prepare')return p.item.id==='3'?{ok:false,code:'original_missing'}:{ok:true,token:p.item.id};
  return{ok:true,verified:true};
 },async review(item,p){seen.push({id:item.id,progress:snapshots.at(-1)});if(first){first=false;return{navigate:1}}return{accepted:item.id==='2',token:p.token}},record(){}});
 assert.deepEqual(seen.map(v=>v.id),['1','2','1']);
 assert.equal(seen[1].progress.completed,0);assert.equal(seen[1].progress.pending,3);
 assert.equal(seen[2].progress.completed,2);assert.equal(seen[2].progress.pending,1);
 assert.deepEqual(snapshots.map(v=>[v.completed,v.pending]),[[0,3],[1,2],[2,1],[3,0]]);
 assert.deepEqual(snapshots.at(-1),{total:3,completed:3,pending:0,written:1,rejected:1,skipped:1,unknown:0,retained:0});
});
test('retained decisions count once and do not cause editor writes',async()=>{
 const items=suggestions.map(item=>({...item,reviewKey:item.id})),snapshots=[],writes=[];
 await Runner.run({suggestions:items},{assertCurrent(){},decisions:{'1':{state:'written'},'2':{state:'rejected'}},progress:v=>snapshots.push(v),async call(method,p){if(method==='apply')writes.push(p.token);return{ok:true,token:p?.item?.id}},async review(){return{accepted:false}},record(){}});
 assert.deepEqual(writes,[]);assert.deepEqual(snapshots.at(-1),{total:3,completed:3,pending:0,written:1,rejected:2,skipped:0,unknown:0,retained:2});
});
test('an unconfirmed write updates counts once and stops before the next item',async()=>{
 const snapshots=[],prepared=[];
 await assert.rejects(Runner.run(pack,{assertCurrent(){},progress:v=>snapshots.push(v),async call(method,p){if(method==='prepare'){prepared.push(p.item.id);return{ok:true,token:p.item.id}}return{ok:false,code:'write_unconfirmed',changedDocument:true}},async review(_i,p){return{accepted:true,token:p.token}},record(){}}),{code:'write_unconfirmed'});
 assert.deepEqual(prepared,['1']);assert.equal(snapshots.at(-1).unknown,1);assert.equal(snapshots.at(-1).completed,1);assert.equal(snapshots.at(-1).pending,2);
});
test('card remaining count updates after decisions and excludes saved decisions beyond the cursor',async()=>{
 const seen=[],items=suggestions.map(item=>({...item,reviewKey:item.id}));
 await Runner.run({suggestions:items},{assertCurrent(){},decisions:{'3':{state:'written'}},async call(method,p){return{ok:true,token:p?.item?.id}},async review(item,_p,options){seen.push([item.id,options.remaining]);return{accepted:false}},record(){}});
 assert.deepEqual(seen,[['1',2],['2',1]]);
});
test('settling 2/3 shows the next pending suggestion as 2/2 and then wraps to 1/1',async()=>{
 const seen=[];let first=true;
 await Runner.run(pack,{assertCurrent(){},async call(_method,p){return{ok:true,verified:true,token:p?.item?.id}},async review(item,prepared,options){seen.push([item.id,options.position,options.remaining]);if(first){first=false;return{navigate:1}}return{accepted:true,token:prepared.token}},record(){}});
 assert.deepEqual(seen,[['1',1,3],['2',2,3],['3',2,2],['1',1,1]]);
});
test('descriptor packs count and rank saved decisions without loading all source into the page',async()=>{
 const items=suggestions.map(item=>({...item,reviewKey:item.id})),seen=[];
 await Runner.run({count:3},{assertCurrent(){},itemAt:async index=>items[index],decisions:{'3':{state:'written'}},initialCounts:{written:1,rejected:0,skipped:0,unknown:0,retained:1},decidedIndexes:[2],async call(_method,p){return{ok:true,token:p?.item?.id}},async review(item,_p,options){seen.push([item.id,options.position,options.remaining]);assert.equal(options.isPending(2),false);return{accepted:false}},record(){}});
 assert.deepEqual(seen,[['1',1,2],['2',1,1]]);
});
