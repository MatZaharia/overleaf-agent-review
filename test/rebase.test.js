const test=require('node:test'),assert=require('node:assert/strict');
const Rebase=require('../src/rebase'),Service=require('../src/service');
const item=(original,replacement,extra={})=>({id:'test',file:'main.tex',original,replacement,...extra});
test('own preceding change updates exact adjacent context',()=>{
 const result=Rebase.resolve('A newer B old',{...item('old','new'),before:'A old B '},{base:'A old B old',current:'A newer B old',edits:[{from:2,to:5,insert:'newer'}]});
 assert.equal(result.ok,true);assert.equal(result.patch.expected,'old');assert.equal(result.patch.from,10);
});
test('whole-sentence anchors compose independent character corrections',()=>{
 const result=Rebase.resolve('cat COG',item('CAT COG','CAT cog'),{base:'CAT COG',current:'cat COG',edits:[{from:0,to:3,insert:'cat'}]});
 assert.equal(result.ok,true);assert.equal(result.patch.insert,'cat cog');
});
test('overlap is a conflict, never an overwrite',()=>{
 assert.equal(Rebase.resolve('bat',item('cat','rat'),{base:'cat',current:'bat',edits:[{from:0,to:1,insert:'b'}]}).code,'overlapping_change');
});
test('external edits cannot be attributed to the plugin ledger',()=>{
 assert.equal(Rebase.resolve('A external B old',item('old','new',{before:'A old B '}),{base:'A old B old',current:'A newer B old',edits:[{from:2,to:5,insert:'newer'}]}).code,'original_missing');
});
test('actual sequential service writes compose without modifying equal characters',async()=>{
 let text='CAT COG',count=0;
 const view={dom:{isConnected:true},state:{doc:{toString:()=>text}},dispatch(t){if(t.changes){count++;for(const p of [...t.changes].reverse())text=text.slice(0,p.from)+p.insert+text.slice(p.to)}}};
 const service=Service.create({adapter:{projectId:()=> 'owner',path:()=> 'main.tex',view:()=>view,open:async()=>true},preview:{show:async()=>({ok:true}),clear(){}},crypto:{randomUUID:()=>String(count)}});
 for(const replacement of ['cat COG','CAT cog']){const p=await service.prepare({projectId:'owner',item:item('CAT COG',replacement)});assert.equal(p.ok,true);assert.equal(service.apply({token:p.token}).ok,true)}
 assert.equal(text,'cat cog');assert.equal(count,2);
});
