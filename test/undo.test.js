const test=require('node:test'),assert=require('node:assert/strict');
const {EditorState}=require('@codemirror/state');
const {history,undo,redo,isolateHistory}=require('@codemirror/commands');
const {IDBFactory}=require('fake-indexeddb'),{webcrypto}=require('node:crypto');
const Service=require('../src/service'),Progress=require('../src/progress'),Runner=require('../src/runner');
const base='AA negative result matters: and rest';
const items=[['prefix','AA','A'],['later','rest','end'],['middle','matters:','shows how']].map(([id,from,to])=>({id,reviewKey:id,file:'main.tex',original:base,replacement:base.replace(from,to)}));
function fixture(text=base){
 let serial=0,writes=0;const reveals=[];
 const view={dom:{isConnected:true},state:EditorState.create({doc:text,extensions:[history()]}),dispatch(spec){writes++;this.state=this.state.update({...spec,annotations:spec.annotations||isolateHistory.of('full')}).state}};
 const create=()=>Service.create({adapter:{projectId:()=> 'owner',path:()=> 'main.tex',view:()=>view,open:async()=>true},preview:{show:async p=>{reveals.push(p.reveal);return {ok:true}},clear(){},read:()=>({ok:true,decision:null})},crypto:{randomUUID:()=>String(++serial)}});
 const command=fn=>fn({state:view.state,dispatch:tr=>{writes++;view.state=tr.state}});
 return {view,create,reveals,get writes(){return writes},undo:()=>command(undo),redo:()=>command(redo)};
}
async function accept(service,item){const p=await service.prepare({projectId:'owner',item});assert.equal(p.ok,true,p.code);const r=service.apply({projectId:'owner',token:p.token});assert.equal(r.verified,true);return [...p.journal,...r.journal]}
test('native undo reopens only the undone edit and preserves independent baseline positions',async()=>{
 const h=fixture(),service=h.create();await accept(service,items[1]);await accept(service,items[0]);
 let p=await service.prepare({projectId:'owner',item:items[2]});assert.equal(p.item.replacement,'A negative result shows how and end');
 assert.equal(h.undo(),true);const writes=h.writes;
 p=await service.status({projectId:'owner',token:p.token});assert.equal(p.ok,true);assert.equal(p.item.replacement,'AA negative result shows how and end');
 assert.deepEqual(p.journal.flatMap(j=>j.decisions||[]),[{reviewKey:'prefix',state:'pending'}]);
 assert.equal(h.writes,writes);assert.equal(h.reveals.at(-1),false);
 const reopened=await service.prepare({projectId:'owner',item:items[0]});assert.equal(reopened.ok,true);assert.equal(reopened.item.replacement,'A negative result matters: and end');
 await accept(service,items[2]);assert.equal(h.view.state.doc.toString(),'AA negative result shows how and end');
});
test('native undo handles insertions, deletions, multiple character edits and Unicode',async()=>{
 for(const [original,replacement] of [['cat','cat fish'],['cat fish','cat'],['The robots senses and produces.','The robots sense and produce.'],['A 🐸 x','A 🦊 xx']]){
  const h=fixture(original),service=h.create(),item={id:'undo',reviewKey:'undo',file:'main.tex',original,replacement};
  await accept(service,item);assert.equal(h.undo(),true);
  const p=await service.prepare({projectId:'owner',item});assert.equal(p.ok,true,p.code);assert.equal(p.item.original,original);assert.equal(p.item.replacement,replacement);
  assert.equal(p.journal.some(j=>j.replace&&j.edits.length===0),true);assert.equal(service.apply({projectId:'owner',token:p.token}).verified,true);assert.equal(h.view.state.doc.toString(),replacement);
 }
});
test('redo and a second undo preserve ownership and never replay a settled token',async()=>{
 const h=fixture(),service=h.create();await accept(service,items[0]);let p=await service.prepare({projectId:'owner',item:items[2]});
 h.undo();p=await service.status({projectId:'owner',token:p.token});assert.equal(p.ok,true);
 h.redo();p=await service.status({projectId:'owner',token:p.token});assert.equal(p.ok,true);assert.equal(p.item.replacement,'A negative result shows how and rest');
 assert.equal((await service.prepare({projectId:'owner',item:items[0]})).code,'already_applied');
 h.undo();p=await service.prepare({projectId:'owner',item:items[0]});assert.equal(p.ok,true);const r=service.apply({projectId:'owner',token:p.token});h.undo();assert.equal(service.apply({projectId:'owner',token:p.token}),r);assert.equal(h.view.state.doc.toString(),base);
});
test('a manual edit inside an accepted range is external and cannot be overwritten',async()=>{
 const h=fixture('CAT COG'),service=h.create(),item={id:'a',reviewKey:'a',file:'main.tex',original:'CAT COG',replacement:'cat COG'};
 await accept(service,item);h.view.dispatch({changes:{from:1,to:2,insert:'X'}});
 const p=await service.prepare({projectId:'owner',item});assert.equal(p.ok,false);assert.equal(h.view.state.doc.toString(),'cXt COG');
 const other=await service.prepare({projectId:'owner',item:{id:'b',file:'main.tex',original:'CAT COG',replacement:'CAT cog'}});assert.equal(other.ok,true);assert.equal(other.item.replacement,'cXt cog');
});
test('a stale pending preview recovers after undo without taking source focus',async()=>{
 const h=fixture('CAT COG'),service=h.create(),item={id:'a',reviewKey:'a',file:'main.tex',original:'CAT COG',replacement:'cat COG'};
 let p=await service.prepare({projectId:'owner',item});h.view.dispatch({changes:{from:0,to:3,insert:'DOG'}});
 const stale=await service.status({projectId:'owner',token:p.token});assert.equal(stale.ok,false);h.undo();p=await service.status({projectId:'owner',token:p.token});assert.equal(p.ok,true);assert.equal(h.reveals.at(-1),false);
});
test('undo journal clears an empty ledger and saved decision atomically across worker restart',async()=>{
 const database=new IDBFactory(),progress=Progress.create(database,webcrypto),h=fixture('old'),service=h.create();
 await progress.savePack('owner',{format:'codex-overleaf-suggestions',version:1,suggestions:[{id:'a',file:'main.tex',original:'old',replacement:'new'}]});
 const item=(await progress.load('owner')).pack.suggestions[0];const journal=await accept(service,item);
 await progress.save('owner',{journal,decision:{reviewKey:item.reviewKey,state:'written'}});
 h.undo();const p=await service.prepare({projectId:'owner',item});await progress.save('owner',{journal:p.journal});await progress.save('owner',{journal:p.journal});
 const state=await Progress.create(database,webcrypto).load('owner');assert.equal(state.decisions[item.reviewKey],undefined);assert.deepEqual(state.ledgers['main.tex'].edits,[]);assert.equal(state.ledgers['main.tex'].history.length,1);
 const fresh=h.create();fresh.begin({ledgers:state.ledgers});assert.equal((await fresh.prepare({projectId:'owner',item})).ok,true);
});
test('undo while paused is reconciled on resume before saved written decisions are retained',async()=>{
 const h=fixture(),service=h.create(),journal=await accept(service,items[0]);const ledger={base:journal[0].base,edits:journal.flatMap(j=>j.edits)};h.undo();
 const fresh=h.create(),begin=fresh.begin({ledgers:{'main.tex':ledger}});assert.equal(begin.journal.flatMap(j=>j.decisions||[])[0].reviewKey,'prefix');assert.equal((await fresh.prepare({projectId:'owner',item:items[2]})).item.replacement,base.replace('matters:','shows how'));
});
test('runner immediately restores pending counts and circular navigation after undo',async()=>{
 let reconcile,visits=0;const seen=[];const decisions={};
 const result=await Runner.run({suggestions:items},{decisions,assertCurrent(){},observe:fn=>{reconcile=fn},call:async(_m,p)=>({ok:true,verified:true,token:p?.item?.id}),record:r=>{decisions[r.item.reviewKey]={state:r.state}},review:async(item,p,options)=>{
  seen.push([item.id,options.position,options.remaining]);visits++;
  if(visits===1)return {accepted:true,token:p.token};
  if(visits===2){reconcile([{reviewKey:'prefix',state:'pending'}]);assert.equal(options.remaining,3);assert.equal(options.position,2);assert.equal(options.isPending(0),true);assert.equal(options.isDecided(items[0]),false);return {navigate:0}}
  return {accepted:false};
 }});
 assert.deepEqual(seen,[['prefix',1,3],['later',1,2],['prefix',1,3],['later',1,2],['middle',1,1]]);assert.equal(result.length,3);assert.equal(result.some(r=>r.state==='written'),false);assert.equal(reconcile,null);
});
test('descriptor resume reopens an unvisited saved decision before choosing the first card',async()=>{
 const seen=[];
 await Runner.run({count:3},{itemAt:async i=>items[i],decisions:{prefix:{state:'written'}},initialCounts:{written:1,rejected:0,skipped:0,unknown:0,retained:1},decidedIndexes:[0],decisionIndexes:{prefix:0},observe:fn=>fn?.([{reviewKey:'prefix',state:'pending'}]),assertCurrent(){},call:async()=>({ok:true,token:'x'}),record(){},review:async(item,_p,options)=>{seen.push([item.id,options.remaining]);return {accepted:false}}});
 assert.deepEqual(seen,[['prefix',3],['later',2],['middle',1]]);
});
test('upgrade associates legacy written edits with their exact suggestion before undo',async()=>{
 const progress=Progress.create(new IDBFactory(),webcrypto);
 await progress.savePack('owner',{format:'codex-overleaf-suggestions',version:1,suggestions:[{id:'a',file:'main.tex',original:'old',replacement:'new'}]});
 const key=(await progress.load('owner')).pack.suggestions[0].reviewKey;
 await progress.save('owner',{decision:{reviewKey:key,state:'written'},journal:[{file:'main.tex',base:'old',edits:[{from:0,to:3,insert:'new'}]}]});
 const saved=await progress.load('owner'),h=fixture('old'),service=h.create();assert.equal(saved.ledgers['main.tex'].edits[0].reviewKey,key);
 const result=service.begin({ledgers:saved.ledgers});assert.deepEqual(result.journal.flatMap(j=>j.decisions||[]),[{reviewKey:key,state:'pending'}]);
});
test('later rejection and unconfirmed decisions survive undo of an old accepted edit',async()=>{
 const progress=Progress.create(new IDBFactory(),webcrypto);
 for(const state of ['rejected','unknown']){
  await progress.save('owner',{decision:{reviewKey:state,state}});
  await progress.save('owner',{journal:[{file:'main.tex',replace:true,edits:[],decisions:[{reviewKey:state,state:'pending'}]}]});
  assert.equal((await progress.load('owner')).decisions[state].state,state);
 }
});
test('undo among 10,000 accepted edits retains all other anchors without repeated full-document copying',()=>{
 const Rebase=require('../src/rebase'),base=Array.from({length:10000},(_,i)=>'Unique '+i+' old.\n').join(''),edits=[];
 let from=base.indexOf('old.');while(from>=0){edits.push({from,to:from+3,insert:'new',expected:'old',reviewKey:String(edits.length)});from=base.indexOf('old.',from+4)}
 const current=Rebase.render(base,edits),ledger={base,current,edits,version:0},target=edits[7000],text=current.slice(0,target.from)+'old'+current.slice(target.to);
 const start=performance.now(),result=Rebase.sync(ledger,text),elapsed=performance.now()-start;
 assert.equal(result.ok,true);assert.equal(ledger.edits.length,9999);assert.equal(Rebase.render(base,ledger.edits),text);assert.deepEqual(result.decisions,[{reviewKey:'7000',state:'pending'}]);
 console.log('10k accepted-edit undo reconciliation: '+Math.round(elapsed)+' ms');
});
