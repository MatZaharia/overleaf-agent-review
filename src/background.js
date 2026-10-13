'use strict';
const Core=require('./suggestions');
const Progress=require('./progress');
const progress=Progress.create(indexedDB,crypto);
const catalog=require('./catalog').create(crypto);
const review=require('./tabReview').create({progress,catalog,storage:chrome.storage.session,crypto,
 broadcast:async(owners,event)=>{await Promise.allSettled(owners.map(owner=>chrome.tabs.sendMessage(owner.tabId,{...event,clientId:owner.clientId})))}});
chrome.tabs.onRemoved.addListener(tabId=>review.forget(tabId).catch(()=>{}));
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='loading')review.forget(tabId).catch(()=>{})});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.id!==chrome.runtime.id)return;
 (async()=>{
  if(!/^https:\/\/(www\.)?overleaf\.com\/project\/([a-f\d]{24})(?:\/|$)/i.test(sender.url||''))throw new Error('Overleaf project required');
  const projectId=sender.url.match(/\/project\/([a-f\d]{24})/i)[1];
  const name='bridge-'+projectId;
  if(message.type==='ping')return {ok:true};
  if(message.type==='parse')return {ok:true,pack:catalog.parse(projectId,message.input)};
  if(message.type==='parseChunk')return {ok:true,pack:catalog.chunk(projectId,message)};
  if(message.type==='items')return {ok:true,items:catalog.items(projectId,message.ref,message.index)};
  if(['session','progress','reviewRenew','reviewRelease','clearTracking','clearProgress'].includes(message.type)){
   if(message.type==='clearTracking'&&message.projectId!==projectId)throw new Error('Project mismatch');
   return review.handle(projectId,{tabId:sender.tab?.id,clientId:message.clientId},message);
  }
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
 })().then(reply,error=>reply({ok:false,error:error.message,code:error.code}));return true;
});
async function request(endpoint,projectId,token,body){
 const response=await fetch('http://127.0.0.1:43127/'+endpoint+'?projectId='+projectId,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error);return data;
}
