const test=require('node:test'),assert=require('node:assert/strict');
const Navigation=require('../src/navigation'),Service=require('../src/service');
test('pack navigation wraps in both directions and skips decided items',()=>{
 const pending=i=>i!==1;
 assert.equal(Navigation.adjacent(0,4,1,pending),2);
 assert.equal(Navigation.adjacent(2,4,-1,pending),0);
 assert.equal(Navigation.adjacent(0,4,-1,pending),3);
 assert.equal(Navigation.adjacent(3,4,1,pending),0);
});
test('both directions reach the other item when only two suggestions remain',()=>{
 const pending=i=>i!==1;
 for(const direction of [-1,1]){
  assert.equal(Navigation.adjacent(2,3,direction,pending),0);
  assert.equal(Navigation.adjacent(0,3,direction,pending),2);
 }
});
test('a single pending item stays selected and a full scan is bounded',()=>{
 for(const direction of [-1,1]){
  assert.equal(Navigation.adjacent(0,1,direction,()=>true),null);
  let calls=0;
  assert.equal(Navigation.adjacent(9999,10000,direction,i=>{calls++;return i===9999}),null);
  assert.equal(calls,9999);
 }
});
test('cursor navigation follows source positions, not pack order, and excludes current highlight',()=>{
 const matches=[{index:0,from:90,to:91},{index:1,from:10,to:11},{index:2,from:40,to:41}];
 assert.equal(Navigation.nearest(matches,50,-1,0),2);
 assert.equal(Navigation.nearest(matches,50,1,0),0);
 assert.equal(Navigation.nearest(matches,41,-1,2),1);
 assert.equal(Navigation.nearest(matches,0,-1,0),null);
});
function fixture(){
 let text='alpha old omega',file='main.tex',project='owner',head=0,sequence=0;
 const writes=[];const view={dom:{isConnected:true},state:{doc:{toString:()=>text},selection:{main:{get head(){return head}}}},dispatch({changes,selection}){for(const p of [...changes].reverse())text=text.slice(0,p.from)+p.insert+text.slice(p.to);writes.push(...changes);head=selection.anchor}};
 const adapter={view:()=>view,path:()=>file,projectId:()=>project,open:async target=>{file=target;return true}};
 const service=Service.create({adapter,preview:{clear(){},show:async()=>({ok:true})},crypto:{randomUUID:()=>String(++sequence)}});
 return {service,view,writes,edit:value=>{text=value},cursor:value=>{head=value},file:value=>{file=value},project:value=>{project=value}};
}
const item={id:'a',file:'main.tex',original:'alpha old omega',replacement:'alpha new omega'};
test('cursor scan locates actual changed characters without opening files or dispatching writes',()=>{
 const h=fixture(),scan=h.service.navigation({projectId:'owner'});
 const result=h.service.navigation({projectId:'owner',scanId:scan.scanId,items:[{index:7,item},{index:8,item:{...item,file:'other.tex'}}]});
 assert.deepEqual(result.matches,[{index:7,from:6,to:9}]);assert.ok(result.processed>=1 && result.processed<=2);
});
test('cursor scan excludes stale and ambiguous originals',()=>{
 const h=fixture();h.edit('old old');const scan=h.service.navigation({projectId:'owner'});
 const result=h.service.navigation({projectId:'owner',scanId:scan.scanId,items:[{index:0,item:{...item,original:'old',replacement:'new'}},{index:1,item:{...item,original:'missing'}}]});
 assert.deepEqual(result.matches,[]);
});
test('cursor scan invalidates on source, cursor, file and project changes',()=>{
 for(const change of ['source','cursor','file','project']){
  const h=fixture(),scan=h.service.navigation({projectId:'owner'});
  if(change==='source')h.edit('prefix alpha old omega');else if(change==='cursor')h.cursor(3);else if(change==='file')h.file('other.tex');else h.project('another');
  const result=h.service.navigation({projectId:'owner',scanId:scan.scanId,items:[{index:0,item}]});assert.equal(result.ok,false);
 }
});

test('cursor positions follow live rebasing after an accepted nearby change',async()=>{
 const h=fixture();const prepared=await h.service.prepare({projectId:'owner',item});
 assert.equal(h.service.apply({token:prepared.token,projectId:'owner'}).verified,true);
 h.edit('prefix alpha new omega');h.cursor(0);
 const scan=h.service.navigation({projectId:'owner'});
 const result=h.service.navigation({projectId:'owner',scanId:scan.scanId,items:[{index:1,item:{...item,replacement:'alpha old end'}}]});
 assert.deepEqual(result.matches,[{index:1,from:17,to:22}]);
 assert.equal(h.writes.length,1);
});
test('navigation cache survives cursor moves but invalidates with suggestion content or document identity',()=>{
 const h=fixture();let reads=0;
 h.view.state.doc={length:15,toString:()=>{reads++;return 'alpha old omega'}};
 const locate=candidate=>{const scan=h.service.navigation({projectId:'owner'});return h.service.navigation({projectId:'owner',scanId:scan.scanId,items:[{index:0,item:candidate}]}).matches};
 assert.equal(locate(item)[0].from,6);h.cursor(1);assert.equal(locate(item)[0].from,6);assert.equal(reads,1);
 assert.equal(locate({...item,replacement:'Alpha old omega'})[0].from,0);
 h.view.state.doc={length:22,toString:()=>{reads++;return 'prefix alpha old omega'}};
 assert.equal(locate(item)[0].from,13);assert.equal(reads,2);
});
