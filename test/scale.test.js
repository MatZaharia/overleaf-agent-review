const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../src/suggestions'),Runner=require('../src/runner');
test('load and sequentially process 10,000 suggestions without retaining duplicate source',async()=>{
 const suggestions=Array.from({length:10000},(_,i)=>({id:String(i),file:'main.tex',original:('Sample paragraph with unchanged context. '.repeat(20))+'old '+i,replacement:('Sample paragraph with unchanged context. '.repeat(20))+'new '+i}));
 const start=performance.now(),pack=Core.parsePack(JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions}));
 assert.equal(pack.suggestions.length,10000);console.log('10k parse/validation: '+Math.round(performance.now()-start)+' ms');
 let records=0;
 const results=await Runner.run(pack,{projectId:'owner',assertCurrent(){},call:async()=>({ok:false,code:'original_missing'}),record(){records++}});
 assert.equal(records,10000);assert.equal(results.length,10000);
 assert.throws(()=>Core.parsePack({format:pack.format,version:1,suggestions:[...suggestions,suggestions[0]]}));
});
