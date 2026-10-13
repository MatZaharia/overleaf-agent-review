const test=require('node:test'),assert=require('node:assert/strict'),Ready=require('../src/editorReady');
function fixture(){
 let mutation,interval,timeout,disconnected=0;const timers=new Set();
 const window={MutationObserver:class{constructor(fn){mutation=fn}observe(){}disconnect(){disconnected++}},setInterval(fn){interval=fn;timers.add('interval');return 'interval'},setTimeout(fn){timeout=fn;timers.add('timeout');return 'timeout'},clearInterval(id){timers.delete(id)},clearTimeout(id){timers.delete(id)}};
 return {window,document:{body:{}},timers,changed:()=>mutation(),poll:()=>interval(),expire:()=>timeout(),disconnected:()=>disconnected};
}
test('already loaded files resolve immediately without a fixed delay or observer',async()=>{
 const f=fixture();assert.equal(await Ready.wait({...f,check:()=>true,timeoutMs:4000}),true);assert.equal(f.timers.size,0);assert.equal(f.disconnected(),0);
});
test('file readiness wakes on DOM updates and disposes every observer and timer',async()=>{
 const f=fixture();let ready=false;const result=Ready.wait({...f,check:()=>ready,timeoutMs:4000});ready=true;f.changed();assert.equal(await result,true);assert.equal(f.timers.size,0);assert.equal(f.disconnected(),1);
});
test('store-only editor updates use the bounded fallback; unavailable files time out safely',async()=>{
 const f=fixture();let ready=false;const result=Ready.wait({...f,check:()=>ready,timeoutMs:4000});ready=true;f.poll();assert.equal(await result,true);assert.equal(f.timers.size,0);
 const g=fixture(),missing=Ready.wait({...g,check:()=>false,timeoutMs:4000});g.expire();assert.equal(await missing,false);assert.equal(g.timers.size,0);
});
test('project changes cancel a pending file load even if an unrelated editor becomes ready',async()=>{
 const f=fixture();let sameProject=true,ready=false;const result=Ready.wait({...f,check:()=>ready,alive:()=>sameProject,timeoutMs:4000});sameProject=false;ready=true;f.changed();assert.equal(await result,false);assert.equal(f.timers.size,0);
});
