const test=require('node:test'),assert=require('node:assert/strict');
const Runtime=require('../src/extensionRuntime');
test('missing runtime stops before sending and invalidates only once',async()=>{
 let stopped=0,calls=0;const chrome={runtime:{id:'live',sendMessage(){calls++;return {ok:true}}}},runtime=Runtime.create(()=>chrome,()=>stopped++);
 assert.equal((await runtime.message({type:'ping'})).ok,true);delete chrome.runtime.id;
 await assert.rejects(runtime.message({type:'session'}),{code:'extension_invalidated'});
 chrome.runtime.id='new-context';await assert.rejects(runtime.message({type:'session'}),{code:'extension_invalidated'});
 assert.equal(calls,1);assert.equal(stopped,1);
});
test('synchronous and rejected context errors are caught without retrying',async()=>{
 for(const send of [()=>{throw new Error('Extension context invalidated.')},()=>Promise.reject(new Error('Extension context invalidated.'))]){
  let stopped=0,calls=0;const runtime=Runtime.create(()=>({runtime:{id:'old',sendMessage(){calls++;return send()}}}),()=>stopped++);
  await assert.rejects(runtime.message({type:'session'}),{code:'extension_invalidated'});
  await assert.rejects(runtime.message({type:'session'}),{code:'extension_invalidated'});
  assert.equal(stopped,1);assert.equal(calls,1);
 }
});
test('late responses cannot resume work after context invalidation',async()=>{
 let reply;const chrome={runtime:{id:'old',sendMessage:()=>new Promise(resolve=>reply=resolve)}},runtime=Runtime.create(()=>chrome);
 const response=runtime.message({type:'session'});delete chrome.runtime.id;reply({ok:true});
 await assert.rejects(response,{code:'extension_invalidated'});
});
test('storage failure shares the same terminal invalidation state',async()=>{
 let stopped=0;const runtime=Runtime.create(()=>({runtime:{id:'old'},storage:{local:{set(){throw new Error('Extension context invalidated.')}}}}),()=>stopped++);
 await assert.rejects(runtime.storage('set',{reviewLanguage:'en'}),{code:'extension_invalidated'});assert.equal(stopped,1);assert.equal(runtime.invalid,true);
});
test('ordinary transport errors do not masquerade as an extension reload',async()=>{
 const failure=new Error('Connection lost'),runtime=Runtime.create(()=>({runtime:{id:'live',sendMessage:()=>Promise.reject(failure)}}),()=>assert.fail('must not invalidate'));
 await assert.rejects(runtime.message({type:'ping'}),failure);assert.equal(runtime.invalid,false);
});
test('an invalid preflight prevents a source write and never retries acceptance',async()=>{
 let writes=0;const runtime=Runtime.create(()=>({runtime:{id:'old',sendMessage(){throw new Error('Extension context invalidated.')}}}));
 async function accept(){await runtime.message({type:'ping'});runtime.check();writes++}
 await assert.rejects(accept(),{code:'extension_invalidated'});assert.equal(writes,0);
});
