const test=require('node:test'),assert=require('node:assert/strict'),{action}=require('../src/reviewKeyboard');
const event=(key,extra={})=>({key,target:{},...extra});
test('review shortcuts provide navigation and acceptance but ignore held/composing/modifier keys',()=>{
 assert.equal(action(event('ArrowUp')),'previous');assert.equal(action(event('ArrowDown')),'next');assert.equal(action(event('Enter')),'accept');
 for(const property of ['repeat','isComposing','defaultPrevented','ctrlKey','metaKey','altKey','shiftKey'])assert.equal(action(event('Enter',{[property]:true})),null);
 assert.equal(action(event('Escape')),null);
 const locate={matches:selector=>selector==='.locate'};
 assert.equal(action(event('Enter',{composedPath:()=>[locate]})),null);
 assert.equal(action(event('ArrowDown',{composedPath:()=>[locate]})),'next');
});
test('typing fields, the LaTeX editor and panel geometry controls retain their normal keys',()=>{
 for(const name of ['input','textarea','select','[contenteditable]:not([contenteditable="false"])','.panel-drag','.panel-resize']){
  const node={matches:selector=>selector.includes(name)};
  for(const key of ['Enter','ArrowUp','ArrowDown'])assert.equal(action(event(key,{composedPath:()=>[{},node,{}]})),null);
 }
});

const {attach,deferredFocus}=require('../src/reviewKeyboard');
class Target {
 constructor(){this.listeners=new Map();this.isConnected=true;this.focuses=[];this.visibilityState='visible'}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn)}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn)}
 emit(name,event={}){for(const fn of [...(this.listeners.get(name)||[])])fn(event)}
 focus(options){this.focuses.push(options)}
 contains(node){return node===this}
 count(){return [...this.listeners.values()].reduce((sum,set)=>sum+set.size,0)}
}
test('clicking review buttons or a dragged title activates shortcuts without scrolling',()=>{
 const card=new Target(),choices=[];attach(card,choice=>choices.push(choice));
 const ordinary={closest:()=>null};
 card.emit('pointerdown',{button:0,target:ordinary});assert.deepEqual(card.focuses,[{preventScroll:true}]);
 card.emit('click',{target:ordinary});assert.equal(card.focuses.length,2);
 card.emit('keydown',event('ArrowDown',{preventDefault(){},stopPropagation(){}}));assert.deepEqual(choices,['next']);
 for(const button of [1,2])card.emit('pointerdown',{button,target:ordinary});assert.equal(card.focuses.length,2);
 for(const selector of ['input','textarea','select','contenteditable','panel-resize']){
  const field={closest:query=>query.includes(selector)?{}:null};
  card.emit('pointerdown',{button:0,target:field});card.emit('click',{target:field});
 }
 assert.equal(card.focuses.length,2);
});
function focusFixture(){
 const card=new Target(),document=new Target();let visible=false;
 const focus=deferredFocus(card,{document,visible:()=>visible});
 return {card,document,focus,show:()=>{visible=true},outside:name=>document.emit(name,{target:{},composedPath:()=>[{}]})};
}
test('distant suggestions receive focus once after layout reveals the card, without repeated focus',()=>{
 const f=focusFixture();f.focus.request();assert.equal(f.card.focuses.length,0);assert.equal(f.document.count(),4);
 f.focus.flush();assert.equal(f.card.focuses.length,0);
 f.show();f.focus.flush();f.focus.flush();assert.deepEqual(f.card.focuses,[{preventScroll:true}]);assert.equal(f.document.count(),0);
});
test('manual source clicks, typing or focus changes cancel a pending reveal focus',()=>{
 for(const name of ['pointerdown','keydown','focusin']){
  const f=focusFixture();f.focus.request();f.outside(name);f.show();f.focus.flush();assert.equal(f.card.focuses.length,0,name);assert.equal(f.document.count(),0);
 }
});
test('retargeted Shadow DOM events within the review card do not cancel its focus request',()=>{
 const f=focusFixture();f.focus.request();
 f.document.emit('focusin',{target:{},composedPath:()=>[{},f.card,{}]});
 f.show();f.focus.flush();assert.equal(f.card.focuses.length,1);
});
test('disposed, disconnected and background cards never receive a deferred focus',()=>{
 const f=focusFixture();f.focus.request();f.focus.dispose();f.show();f.focus.flush();assert.equal(f.card.focuses.length,0);assert.equal(f.document.count(),0);
 const g=focusFixture();g.focus.request();g.show();g.card.isConnected=false;g.focus.flush();assert.equal(g.card.focuses.length,0);g.focus.dispose();assert.equal(g.document.count(),0);
 const h=focusFixture();h.focus.request();h.document.visibilityState='hidden';h.document.emit('visibilitychange');h.show();h.document.visibilityState='visible';h.focus.flush();assert.equal(h.card.focuses.length,0);assert.equal(h.document.count(),0);
});
test('a fresh explicit navigation can focus after an earlier request was cancelled',()=>{
 const f=focusFixture();f.focus.request();f.outside('pointerdown');f.show();f.focus.request();assert.equal(f.card.focuses.length,1);assert.equal(f.document.count(),0);
});
test('Enter on search navigation buttons keeps their native search action instead of accepting',()=>{
 const button={matches:selector=>selector==='.search-navigation'};
 assert.equal(action(event('Enter',{composedPath:()=>[button]})),null);
 assert.equal(action(event('ArrowDown',{composedPath:()=>[button]})),'next');
});
