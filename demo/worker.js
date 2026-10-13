import Progress from '../src/progress';
import Catalog from '../src/catalog';
import TabReview from '../src/tabReview';
// Test fixture only: browser-native IndexedDB with a Chrome messaging shim.
// This does not install an extension or connect to the user's Overleaf project.
{
 const catalog=Catalog.create(crypto);
 const progress=Progress.create(indexedDB,crypto),project='0123456789abcdef01234567';
 const ports=new Map(),store={};let nextTab=0;
 const review=TabReview.create({progress,catalog,crypto,storage:{async get(key){return {[key]:structuredClone(store[key])}},async set(value){Object.assign(store,structuredClone(value))}},broadcast:async(owners,event)=>{for(const owner of owners)ports.get(owner.tabId)?.postMessage({event:{...event,clientId:owner.clientId}})}});
 self.onconnect=event=>{const port=event.ports[0],tabId=++nextTab;ports.set(tabId,port);port.start();
 port.onmessage=async event=>{const {id,message}=event.data;let result;try{
 result=await (async()=>{
  if(message.type==='fixture-stale-tracking'){await progress.save(project,{journal:[{file:'main.tex',base:'x'.repeat(10000),edits:[]}]});return {ok:true}}
  if(message.type==='fixture-close'){await review.forget(tabId);ports.delete(tabId);return {ok:true}}
  if(message.type==='ping')return {ok:true};
  if(message.type==='parse')return {ok:true,pack:catalog.parse(project,message.input)};
  if(message.type==='parseChunk')return{ok:true,pack:catalog.chunk(project,message)};
  if(message.type==='items')return{ok:true,items:catalog.items(project,message.ref,message.index)};
  if(['session','progress','reviewRenew','reviewRelease','clearTracking','clearProgress'].includes(message.type))return review.handle(project,{tabId,clientId:message.clientId||'fixture-setup'},message);
  if(message.type==='fixture-progress'){await progress.save(project,message);return {ok:true}}
  return {ok:false,error:'此演示使用消息模拟，不连接本机服务'};
 })();
 }catch(error){result={ok:false,error:error.message,code:error.code}}
 port.postMessage({id,result});
 };};
}
