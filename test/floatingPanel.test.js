const test=require('node:test'),assert=require('node:assert/strict');
const {attach,clamp}=require('../src/floatingPanel');
class Target {
 constructor(){this.listeners=new Map();this.style={};this.classList={add(){}};this.captured=null;}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn)}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn)}
 setPointerCapture(id){this.captured=id}
 hasPointerCapture(id){return this.captured===id}
 releasePointerCapture(){this.captured=null}
 emit(name,extra={}){const event={button:0,target:this,currentTarget:this,pointerId:1,preventDefault(){},...extra};for(const fn of this.listeners.get(name)||[])fn(event)}
}
test('panel bounds enforce a usable minimum and keep the whole panel inside even a small viewport',()=>{
 assert.deepEqual(clamp({left:-30,top:900,width:50,height:40},{left:8,top:8,width:900,height:600}),{left:8,top:448,width:280,height:160});
 assert.deepEqual(clamp({left:500,top:500,width:900,height:700},{left:8,top:8,width:200,height:100}),{left:8,top:8,width:200,height:100});
});
test('drag/resize retains geometry across items, ignores controls and other pointers, and removes handlers on disposal',()=>{
 const panel=new Target(),drag=new Target(),resize=new Target(),window=new Target(),state={};Object.assign(window,{innerWidth:1000,innerHeight:800});
 const options={panel,drag,resize,window,state,defaultRect:()=>({left:200,top:100,width:350,height:260})};
 let floating=attach(options);floating.layout();
 drag.emit('pointerdown',{target:{closest:()=>true},clientX:200,clientY:100});drag.emit('pointermove',{clientX:250,clientY:180});assert.equal(state.rect,undefined);
 drag.emit('pointerdown',{clientX:200,clientY:100});drag.emit('pointermove',{pointerId:2,clientX:400,clientY:300});assert.equal(state.rect,undefined);
 drag.emit('pointermove',{clientX:250,clientY:180});drag.emit('pointerup');assert.deepEqual(state.rect,{left:250,top:180,width:350,height:260});
 resize.emit('pointerdown',{clientX:600,clientY:440});resize.emit('pointermove',{clientX:680,clientY:500});resize.emit('pointerup');assert.deepEqual(state.rect,{left:250,top:180,width:430,height:320});
 floating.dispose();assert.equal([...drag.listeners.values()].reduce((n,set)=>n+set.size,0),0);assert.equal([...window.listeners.values()].reduce((n,set)=>n+set.size,0),0);
 floating=attach({...options,defaultRect:()=>({left:0,top:0,width:300,height:200})});assert.deepEqual(floating.layout(),state.rect);
 Object.assign(window,{innerWidth:400,innerHeight:300});window.emit('resize');assert.deepEqual(state.rect,{left:8,top:8,width:384,height:284});floating.dispose();
});
test('keyboard moving and resizing never consumes keys on child controls; capture is released on cancellation',()=>{
 const panel=new Target(),drag=new Target(),resize=new Target(),window=new Target();Object.assign(window,{innerWidth:1000,innerHeight:800});
 const state={},floating=attach({panel,drag,resize,window,state,defaultRect:()=>({left:100,top:100,width:300,height:200})});
 drag.emit('keydown',{key:'ArrowRight',shiftKey:true});assert.equal(state.rect.left,120);
 resize.emit('keydown',{key:'ArrowDown'});assert.equal(state.rect.height,205);
 drag.emit('keydown',{key:'ArrowLeft',target:{}});assert.equal(state.rect.left,120);
 resize.emit('pointerdown',{clientX:0,clientY:0});assert.equal(resize.captured,1);resize.emit('pointercancel');assert.equal(resize.captured,null);floating.dispose();
});
