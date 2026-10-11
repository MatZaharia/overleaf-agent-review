const test = require('node:test'), assert = require('node:assert/strict');
const { characterEdits } = require('../src/characterEdits');
const Service = require('../src/service');
function edits(old,next) { return characterEdits({from:0,to:old.length,expected:old,insert:next},old); }
test('a one-character correction leaves the rest of the sentence outside the write',()=>{
 assert.deepEqual(edits('This is a cat.','This is a bat.'),[{from:10,to:11,insert:'b',expected:'c'}]);
});
test('disjoint characters retain the unchanged intervening text',()=>{
 assert.deepEqual(edits('甲中间不变乙','丙中间不变丁'),[{from:0,to:1,insert:'丙',expected:'甲'},{from:5,to:6,insert:'丁',expected:'乙'}]);
});
test('Unicode emoji are not split; insertion and deletion retain existing characters',()=>{
 assert.deepEqual(edits('a😀b','a😃b'),[{from:1,to:3,insert:'😃',expected:'😀'}]);
 assert.deepEqual(edits('abcd','abXcd'),[{from:2,to:2,insert:'X',expected:''}]);
 assert.deepEqual(edits('abcd','acd'),[{from:1,to:2,insert:'',expected:'b'}]);
});
test('unchanged CRLF and LaTeX syntax are never part of the transaction',()=>{
 const old='\\title{甲}\r\n\\author{乙}';
 const p=edits(old,'\\title{丙}\n\\author{乙}');
 assert.deepEqual(p,[{from:7,to:8,insert:'丙',expected:'甲'}]);
});
test('service writes two character edits atomically, including after live relocation',async()=>{
 let text='lead 甲中间不变乙 tail',transactions=[];
 const view={dom:{isConnected:true},state:{doc:{toString:()=>text}},dispatch(transaction){transactions.push(transaction);for(const p of [...transaction.changes].reverse())text=text.slice(0,p.from)+p.insert+text.slice(p.to)}};
 const service=Service.create({adapter:{projectId:()=> 'owner',path:()=> 'main.tex',view:()=>view,open:async()=>true},preview:{show:async()=>({ok:true}),clear(){}},crypto:{randomUUID:()=> 'token'}});
 const pending=await service.prepare({projectId:'owner',item:{id:'one',file:'main.tex',original:'甲中间不变乙',replacement:'丙中间不变丁'}});
 text='new prefix '+text;
 assert.equal(service.apply({token:pending.token}).verified,true);
 assert.equal(transactions.length,1);
 assert.deepEqual(transactions[0].changes,[{from:16,to:17,insert:'丙'},{from:21,to:22,insert:'丁'}]);
 assert.equal(text,'new prefix lead 丙中间不变丁 tail');
});
