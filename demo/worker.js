import Progress from '../src/progress';
import Core from '../src/suggestions';
import Catalog from '../src/catalog';
// Test fixture only: browser-native IndexedDB with a Chrome messaging shim.
// This does not install an extension or connect to the user's Overleaf project.
{
 const catalog=Catalog.create(crypto);
 const progress=Progress.create(indexedDB,crypto),project='0123456789abcdef01234567';
 self.onmessage=async event=>{const {id,message}=event.data;let result;try{
 result=await (async()=>{
  if(message.type==='parse')return {ok:true,pack:catalog.parse(project,message.input)};
  if(message.type==='parseChunk')return{ok:true,pack:catalog.chunk(project,message)};
  if(message.type==='items')return{ok:true,items:catalog.items(project,message.ref,message.index)};
  if(message.type==='session'){if(message.pack)await progress.savePack(project,catalog.get(project,message.pack.ref));const state=await progress.load(project);return {ok:true,...state,pack:state.pack?catalog.put(project,state.pack):null}}
  if(message.type==='progress'){await progress.save(project,message);return {ok:true}}
  if(message.type==='clearProgress'){await progress.clear(project);return {ok:true}}
  return {ok:false,error:'此演示使用消息模拟，不连接本机服务'};
 })();
 }catch(error){result={ok:false,error:error.message}}
 self.postMessage({id,result});
 };
}
