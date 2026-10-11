'use strict';
const Core=require('./suggestions');
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.id!==chrome.runtime.id)return;
 (async()=>{
  if(message.type==='parse')return {ok:true,pack:Core.parsePack(message.input)};
  if(!/^https:\/\/(www\.)?overleaf\.com\/project\/([a-f\d]{24})(?:\/|$)/i.test(sender.url||''))throw new Error('Overleaf project required');
  const projectId=sender.url.match(/\/project\/([a-f\d]{24})/i)[1];
  const name='bridge-'+projectId;
  if(message.type==='disconnect'){await chrome.storage.local.remove(name);return{ok:true}}
  if(message.type==='connect'){
   if(!/^[a-f\d]{64}$/i.test(message.token||''))throw new Error('配对令牌格式不正确');
   await request('state',projectId,message.token);await chrome.storage.local.set({[name]:message.token});return{ok:true};
  }
  const token=(await chrome.storage.local.get(name))[name];if(!token)return{ok:false,disconnected:true};
  if(message.type==='sync'){
   const data=await request('sync',projectId,token,{snapshot:message.snapshot,requestId:message.requestId,results:message.results});
   if(data.revision!==message.revision){const next=await request('pack',projectId,token);return{...data,ok:true,...next}}
   return {ok:true,...data};
  }
  throw new Error('Unknown bridge operation');
 })().then(reply,error=>reply({ok:false,error:error.message}));return true;
});
async function request(endpoint,projectId,token,body){
 const response=await fetch('http://127.0.0.1:43127/'+endpoint+'?projectId='+projectId,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error);return data;
}
