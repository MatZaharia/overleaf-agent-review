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
