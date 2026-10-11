const test=require('node:test'),assert=require('node:assert/strict'),{EditorState}=require('@codemirror/state');
const Service=require('../src/service'),Rebase=require('../src/rebase');
function fixture(text){let sequence=0;const view={dom:{isConnected:true},state:EditorState.create({doc:text}),dispatch(change){this.state=this.state.update(change).state}};
 const preview={show:async()=>({ok:true}),clear(){},read:()=>({ok:true,decision:null})};
 const create=()=>Service.create({adapter:{projectId:()=> 'owner',path:()=> 'main.tex',view:()=>view,open:async()=>true},preview,crypto:{randomUUID:()=>String(++sequence)}});
 return {view,create,edit(changes){view.dispatch({changes})}};
}
const item=(replacement)=>({id:replacement,file:'main.tex',original:'CAT COG',replacement});
test('manual prefix edits preserve own accepted changes, including repeated edits to that prefix',async()=>{
 const h=fixture('CAT COG'),service=h.create();let p=await service.prepare({projectId:'owner',item:item('cat COG')});service.apply({token:p.token});
 h.edit({from:0,insert:'prefix '});p=await service.prepare({projectId:'owner',item:item('CAT cog')});assert.equal(p.item.replacement,'cat cog');
 h.edit({from:0,to:6,insert:'edited prefix'});p=await service.status({token:p.token});assert.equal(p.ok,true);assert.equal(service.apply({token:p.token}).ok,true);assert.equal(h.view.state.doc.toString(),'edited prefix cat cog');
});
test('external edits to requested characters are never overwritten',async()=>{
 const ledger={base:'CAT COG',current:'cat COG',edits:[{from:0,to:3,insert:'cat'}],version:0};assert.equal(Rebase.sync(ledger,'cat DOG').ok,true);assert.equal(Rebase.resolve('cat DOG',item('CAT cog'),ledger).ok,false);
});
test('unchanged immutable CodeMirror documents are not serialized on status polls',async()=>{
 const h=fixture('CAT COG\n'+'long unchanged paragraph\n'.repeat(10000)),service=h.create(),p=await service.prepare({projectId:'owner',item:item('cat COG')});
 const doc=h.view.state.doc,original=doc.toString.bind(doc);let reads=0;doc.toString=()=>{reads++;return original()};
 for(let i=0;i<100;i++)assert.equal((await service.status({token:p.token})).ok,true);assert.equal(reads,0);
});
test('journal restore continues the next original-baseline suggestion without replay',async()=>{
 const h=fixture('CAT COG'),service=h.create(),p=await service.prepare({projectId:'owner',item:item('cat COG')}),written=service.apply({token:p.token});
 const events=[...p.journal,...written.journal],saved={base:events[0].base,edits:events.flatMap(e=>e.edits)};
 const restored=h.create();restored.begin({ledgers:{'main.tex':saved}});const next=await restored.prepare({projectId:'owner',item:item('CAT cog')});assert.equal(next.item.replacement,'cat cog');assert.equal(restored.apply({token:next.token}).ok,true);assert.equal(h.view.state.doc.toString(),'cat cog');
});

test('restore preserves a boundary insertion beside an accepted character range',async()=>{
 const h=fixture('prefix cat COG'),service=h.create();service.begin({ledgers:{'main.tex':{base:'CAT COG',edits:[{from:0,to:0,insert:'prefix ',external:true},{from:0,to:3,insert:'cat'}]}}});
 const p=await service.prepare({projectId:'owner',item:item('CAT cog')});assert.equal(p.ok,true);assert.equal(service.apply({token:p.token}).ok,true);assert.equal(h.view.state.doc.toString(),'prefix cat cog');
});
