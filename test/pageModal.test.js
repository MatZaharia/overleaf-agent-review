const test=require('node:test'),assert=require('node:assert/strict'),Modal=require('../src/pageModal');
function fixture(){
 let callback,frame,disconnected=false;
 const body={nodeType:1,parentElement:null,closest:()=>null,matches:()=>false,querySelector:()=>null};
 const nodes=[],events=[];
 const window={getComputedStyle:node=>node.style,MutationObserver:class{constructor(fn){callback=fn}observe(){}disconnect(){disconnected=true}},requestAnimationFrame:fn=>{frame=fn;return 1},cancelAnimationFrame:()=>{frame=null}};
 const document={body,querySelectorAll:()=>nodes};
 const watcher=Modal.watch({document,window,onChange:value=>events.push(value)});
 function node(){return {nodeType:1,parentElement:body,isConnected:true,hidden:false,style:{display:'block',visibility:'visible'},getAttribute:()=>null,getClientRects(){return this.hidden||this.style.display==='none'?[]:[{}]},closest:()=>null,matches:()=>true,querySelector:()=>null}}
 return {window,nodes,events,watcher,node,mutate(records){callback(records);const fn=frame;frame=null;fn?.()},disconnected:()=>disconnected};
}
test('webpage modal opening and closing suspends display without duplicate transitions',()=>{
 const f=fixture(),dialog=f.node();f.nodes.push(dialog);
 f.mutate([{type:'childList',addedNodes:[dialog],removedNodes:[]}]);assert.equal(f.watcher.blocked(),true);assert.deepEqual(f.events,[false,true]);
 f.mutate([{type:'attributes',target:dialog}]);assert.deepEqual(f.events,[false,true]);
 f.nodes.pop();dialog.isConnected=false;f.mutate([{type:'childList',addedNodes:[],removedNodes:[dialog]}]);assert.deepEqual(f.events,[false,true,false]);
 f.watcher.dispose();assert.equal(f.disconnected(),true);
});
test('hidden and inert dialog templates do not suppress review surfaces; visible backdrop does',()=>{
 const f=fixture(),dialog=f.node();dialog.hidden=true;f.nodes.push(dialog);f.mutate([{type:'attributes',target:dialog}]);assert.equal(f.watcher.blocked(),false);
 dialog.hidden=false;dialog.style.visibility='hidden';f.mutate([{type:'attributes',target:dialog}]);assert.equal(f.watcher.blocked(),false);
 dialog.style.visibility='visible';dialog.getAttribute=name=>name==='aria-hidden'?'true':null;f.mutate([{type:'attributes',target:dialog}]);assert.equal(f.watcher.blocked(),false);
 const backdrop=f.node();f.nodes.push(backdrop);f.mutate([{type:'childList',addedNodes:[backdrop],removedNodes:[]}]);assert.equal(f.watcher.blocked(),true);
});
test('nested dialogs remain blocked until all visible page dialogs close',()=>{
 const f=fixture(),first=f.node(),second=f.node();f.nodes.push(first,second);f.mutate([{type:'childList',addedNodes:[first,second],removedNodes:[]}]);
 first.hidden=true;f.mutate([{type:'attributes',target:first}]);assert.equal(f.watcher.blocked(),true);
 second.hidden=true;f.mutate([{type:'attributes',target:second}]);assert.equal(f.watcher.blocked(),false);
});
test('extension overlays and ordinary editor mutations cannot retrigger modal layout work',()=>{
 const f=fixture(),own=f.node();own.closest=()=>({});f.nodes.push(own);f.mutate([{type:'childList',addedNodes:[own],removedNodes:[]}]);assert.deepEqual(f.events,[false]);
 const editor=f.node();editor.matches=()=>false;f.mutate([{type:'attributes',target:editor}]);assert.deepEqual(f.events,[false]);
});
