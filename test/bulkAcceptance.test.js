const test=require('node:test'),assert=require('node:assert/strict');
const Batch=require('../src/bulkAcceptance'),Runner=require('../src/runner');
const items=Array.from({length:4},(_,i)=>({id:String(i),reviewKey:String(i),file:'main.tex',original:'old '+i,replacement:'new '+i}));
const pack={suggestions:items};
test('confirmation plans only currently pending indexes, including a bounded 10,000-item queue',()=>{
 assert.deepEqual(Batch.plan(4,i=>i!==1),[0,2,3]);assert.equal(Batch.plan(10000,i=>i%2===0).length,5000);
 const batch=Batch.create();assert.equal(batch.decision(0,{token:'zero'}),null);
 batch.start([0,2,3],2);assert.equal(batch.total,3);assert.equal(batch.decision(2,{token:'current'}),null);assert.equal(batch.active,false);
});
test('confirmed batch still prepares each original, skips stale items, and does not touch saved rejections',async()=>{
 const batch=Batch.create(),events=[],choices=[];
 const results=await Runner.run(pack,{decisions:{'1':{state:'rejected'}},assertCurrent(){},
 async call(method,p){events.push([method,p?.item?.id??p?.token]);if(method==='prepare')return p.item.id==='2'?{ok:false,code:'original_missing'}:{ok:true,token:p.item.id};return {ok:true,verified:true}},
 review:async(item,p,o)=>{const approval=batch.decision(o.index,p);if(approval)return approval;choices.push(item.id);batch.start(Batch.plan(o.total,o.isPending),o.index);return {accepted:true,token:p.token}},
 record(){batch.record()}});
 assert.deepEqual(choices,['0']);assert.deepEqual(events.filter(e=>e[0]==='prepare').map(e=>e[1]),['0','2','3']);
 assert.deepEqual(events.filter(e=>e[0]==='apply').map(e=>e[1]),['0','3']);assert.deepEqual(results.map(r=>r.state),['written','retained','skipped','written']);
});
test('stopping a confirmed batch preserves the remainder and sends no later write',async()=>{
 const batch=Batch.create(),writes=[];let cancelled=false;
 await assert.rejects(Runner.run(pack,{assertCurrent(){if(cancelled)throw Object.assign(new Error('Stopped'),{code:'cancelled'})},
 async call(method,p){if(method==='prepare')return {ok:true,token:p.item.id};if(method==='apply')writes.push(p.token);return {ok:true,verified:true}},
 review:async(_item,p,o)=>{batch.start(Batch.plan(o.total,o.isPending),o.index);return {accepted:true,token:p.token}},
 record(){batch.stop();cancelled=true}}),{code:'cancelled'});
 assert.deepEqual(writes,['0']);assert.equal(batch.decision(1,{token:'next'}),null);
});
test('uncertain writes and lost ownership stop a confirmed batch before another suggestion',async()=>{
 for(const code of ['write_unconfirmed','review_lease_lost']){
  const batch=Batch.create(),writes=[],prepared=[];
  await assert.rejects(Runner.run(pack,{assertCurrent(){},async call(method,p){if(method==='prepare'){prepared.push(p.item.id);return {ok:true,token:p.item.id}}if(method==='apply'){writes.push(p.token);return {ok:false,code,changedDocument:code==='write_unconfirmed'}}return {ok:true}},review:async(_item,p,o)=>{batch.start(Batch.plan(o.total,o.isPending),o.index);return {accepted:true,token:p.token}},record(){}}),{code});
  assert.deepEqual(writes,['0']);assert.deepEqual(prepared,['0']);
 }
});
test('file suspension cancels bulk approval instead of replaying the previous choice',()=>{
 const batch=Batch.create();batch.start([0,1],0);assert.throws(()=>batch.decision(1,{suspended:true,token:'one'}),{code:'review_file_mismatch'});assert.equal(batch.active,false);assert.equal(batch.decision(1,{token:'fresh'}),null);
});
test('undo and reopened suggestions never expand or reuse a consumed approval',()=>{
 const batch=Batch.create();batch.start([1,2],1);assert.deepEqual(batch.decision(2,{token:'two'}),{accepted:true,token:'two'});
 assert.equal(batch.decision(2,{token:'undone'}),null);assert.equal(batch.active,false);
 batch.start([1,2],1);assert.equal(batch.decision(0,{token:'previously written'}),null);assert.equal(batch.active,false);
});
