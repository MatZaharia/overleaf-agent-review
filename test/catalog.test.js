const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const Catalog=require('../src/catalog'),Runner=require('../src/runner');
const pack={format:'codex-overleaf-suggestions',version:1,suggestions:Array.from({length:10000},(_,i)=>({id:String(i),file:'main.tex',original:'old '+i,replacement:'new '+i}))};
test('10k packs stay off the page and are delivered in bounded windows',async()=>{
 const catalog=Catalog.create(webcrypto),meta=catalog.parse('p',pack);assert.equal(meta.count,10000);assert.equal(meta.suggestions,undefined);assert.ok(catalog.items('p',meta.ref,0).length<=32);assert.throws(()=>catalog.items('other',meta.ref,0));
 let calls=0,buffer=[],start=-1;const results=await Runner.run(meta,{async itemAt(i){if(i<start||i>=start+buffer.length){buffer=catalog.items('p',meta.ref,i);start=i}return buffer[i-start]},assertCurrent(){},call:async()=>{calls++;return{ok:false,code:'original_missing'}},record(){}});assert.equal(calls,10000);assert.equal(results.length,10000);assert.equal(results[0].item.original,undefined);
});
test('large input transport validates chunk order and project ownership',()=>{
 const catalog=Catalog.create(webcrypto),raw=JSON.stringify(pack);let meta;
 for(let index=0,from=0;from<raw.length;index++,from+=262144)meta=catalog.chunk('p',{uploadId:'test',index,chunk:raw.slice(from,from+262144),last:from+262144>=raw.length});
 assert.equal(meta.count,10000);assert.equal(catalog.items('p',meta.ref,9999)[0].id,'9999');assert.throws(()=>catalog.chunk('p',{uploadId:'wrong',index:2,chunk:'bad'}));
});
test('a single oversized item never causes the rest of the pack to be sent',()=>{
 const catalog=Catalog.create(webcrypto),meta=catalog.parse('p',{...pack,suggestions:[{...pack.suggestions[0],original:'x'.repeat(200000)},pack.suggestions[1]]});assert.equal(catalog.items('p',meta.ref,0).length,1);
});
