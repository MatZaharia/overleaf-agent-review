const test=require('node:test'),assert=require('node:assert/strict'),Search=require('../src/suggestionSearch'),I18n=require('../src/i18n');
const items=[{original:'Alpha old',replacement:'Beta new',reason:'ignored phrase'},{original:'中文原文',replacement:'中文修改'},{original:'symbols [.*]',replacement:''},{original:'beta other',replacement:'ALPHA'}];
function fixture(){let reads=0,yields=0;const index=Search.create({total:items.length,readPage:async offset=>{reads++;return items.slice(offset,offset+2)},yieldTask:async()=>{yields++}});return{index,reads:()=>reads,yields:()=>yields}}
test('literal case-insensitive matching searches original and replacement separately, including Chinese and deletion',async()=>{
 const f=fixture();assert.deepEqual(await f.index.search('beta'),[0,3]);assert.deepEqual(await f.index.search('中文修改'),[1]);assert.deepEqual(await f.index.search('[.*]'),[2]);assert.deepEqual(await f.index.search('ignored phrase'),[]);assert.deepEqual(await f.index.search('oldBeta'),[]);assert.deepEqual(await f.index.search(''),[]);
});
test('navigation reuses the last query and dynamically removes decisions and restores undone items',async()=>{
 const f=fixture();const first=await f.index.search('alpha');assert.deepEqual(await f.index.search('ALPHA'),first);assert.equal(f.reads(),2);assert.equal(f.yields(),2);
 const decided=new Set([0]);assert.deepEqual(Search.pending(first,i=>!decided.has(i)),[3]);decided.delete(0);assert.deepEqual(Search.pending(first,i=>!decided.has(i)),[0,3]);
 assert.equal(Search.adjacent([0,3],0,1),3);assert.equal(Search.adjacent([0,3],3,1),0);assert.equal(Search.adjacent([0,3],0,-1),3);assert.equal(Search.adjacent([0,3],2,1),3);assert.equal(Search.adjacent([0,3],2,-1),0);assert.equal(Search.adjacent([],0,1),null);
});
test('changed query and session stop cancel obsolete scans before reading another page',async()=>{
 let release,reads=0;const index=Search.create({total:2,readPage:async offset=>{reads++;if(reads===1)await new Promise(resolve=>release=resolve);return [items[offset]]},yieldTask:async()=>{}});
 const old=index.search('alpha'),fresh=index.search('中文');release();assert.equal(await old,null);assert.deepEqual(await fresh,[1]);assert.equal(reads,3);
 let finish;const stopped=Search.create({total:2,readPage:async offset=>{await new Promise(resolve=>finish=resolve);return [items[offset]]}});const pending=stopped.search('alpha');stopped.cancel();finish();assert.equal(await pending,null);
});
test('search failures can be retried and empty pages stop rather than looping forever',async()=>{
 let fail=true;const index=Search.create({total:1,readPage:async()=>{if(fail)return [];return [items[0]]},yieldTask:async()=>{}});await assert.rejects(index.search('alpha'),/empty/);fail=false;assert.deepEqual(await index.search('alpha'),[0]);
});
test('10,000-item search stays paged, yields between batches and caches only result indices',async()=>{
 let batches=0,yields=0;const index=Search.create({total:10000,readPage:async offset=>{batches++;return Array.from({length:Math.min(32,10000-offset)},(_,n)=>({original:'old '+(offset+n),replacement:(offset+n)%100===0?'target':'new'}))},yieldTask:async()=>{yields++}});
 const results=await index.search('target');assert.equal(results.length,100);assert.equal(batches,313);assert.equal(yields,313);await index.search('TARGET');assert.equal(batches,313);
});
test('search controls and counts switch language without translating query or manuscript text',()=>{
 for(const label of ['搜索建议','搜索原文或修改后','上一个搜索项','下一个搜索项','正在搜索建议…','没有匹配的待处理建议','搜索失败，请重新输入'])assert.notEqual(I18n.translate(label,'en'),label);
 assert.equal(I18n.translate('搜索结果 2 / 15','en'),'Search matches 2 / 15');
});
