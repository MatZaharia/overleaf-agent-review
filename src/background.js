'use strict';
const Core=require('./suggestions');
const Counts=require('./reviewCounts');
const Progress=require('./progress');
const progress=Progress.create(indexedDB,crypto);
const catalog=require('./catalog').create(crypto);
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.id!==chrome.runtime.id)return;
 (async()=>{
  if(!/^https:\/\/(www\.)?overleaf\.com\/project\/([a-f\d]{24})(?:\/|$)/i.test(sender.url||''))throw new Error('Overleaf project required');
  const projectId=sender.url.match(/\/project\/([a-f\d]{24})/i)[1];
  const name='bridge-'+projectId;
  if(message.type==='parse')return {ok:true,pack:catalog.parse(projectId,message.input)};
  if(message.type==='parseChunk')return {ok:true,pack:catalog.chunk(projectId,message)};
  if(message.type==='items')return {ok:true,items:catalog.items(projectId,message.ref,message.index)};
  if(message.type==='session'){if(message.pack){const pack=message.pack.ref?catalog.get(projectId,message.pack.ref):Core.parsePack(message.pack);if(pack.projectId&&pack.projectId!==projectId)throw new Error('Project mismatch');await progress.savePack(projectId,pack)}const state=await progress.load(projectId),restored=Counts.restore(state.pack,state.decisions);return {ok:true,...state,initialCounts:restored.counts,decidedIndexes:restored.indexes,decisionIndexes:restored.decisionIndexes,pack:state.pack?catalog.put(projectId,state.pack):null}}
  if(message.type==='progress'){await progress.save(projectId,message);return {ok:true}}
  if(message.type==='clearProgress'){await progress.clear(projectId);return {ok:true}}
  if(message.type==='disconnect'){await chrome.storage.local.remove(name);return{ok:true}}
  if(message.type==='connect'){
   if(!/^[a-f\d]{64}$/i.test(message.token||''))throw new Error('配对令牌格式不正确');
   await request('state',projectId,message.token);await chrome.storage.local.set({[name]:message.token});return{ok:true};
  }
  const token=(await chrome.storage.local.get(name))[name];if(!token)return{ok:false,disconnected:true};
  if(message.type==='sync'){
   const data=await request('sync',projectId,token,{snapshot:message.snapshot,requestId:message.requestId,results:message.results});
   if(data.revision!==message.revision){const next=await request('pack',projectId,token);return{...data,ok:true,...next,pack:next.pack?catalog.parse(projectId,next.pack):null}}
   return {ok:true,...data};
  }
  throw new Error('Unknown bridge operation');
 })().then(reply,error=>reply({ok:false,error:error.message}));return true;
});
async function request(endpoint,projectId,token,body){
 const response=await fetch('http://127.0.0.1:43127/'+endpoint+'?projectId='+projectId,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error);return data;
}
