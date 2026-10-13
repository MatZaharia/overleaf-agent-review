'use strict';
const Core=require('./suggestions');
function create(crypto){const packs=new Map(),uploads=new Map();
 const pins=new Map();
 function prune(project){const unused=[...packs].filter(([id,p])=>p.project===project&&!pins.get(id)?.size);for(const [id] of unused.slice(0,-2))packs.delete(id)}
 function put(project,pack,cacheKey){
  const cached=cacheKey&&[...packs].find(([,p])=>p.project===project&&p.cacheKey===cacheKey);
  const ref=cached?.[0]||crypto.randomUUID();if(cached)packs.delete(ref);packs.set(ref,{project,pack,cacheKey});prune(project);
  return{ref,count:pack.suggestions.length,projectId:pack.projectId};
 }
 function pin(project,ref,client){get(project,ref);if(!pins.has(ref))pins.set(ref,new Set());pins.get(ref).add(client)}
 function release(client){for(const [id,owners] of pins){owners.delete(client);if(!owners.size)pins.delete(id)}for(const project of new Set([...packs.values()].map(p=>p.project)))prune(project)}
 function get(project,ref){const entry=packs.get(ref);if(!entry||entry.project!==project)throw new Error('建议会话已更新，请重新载入');return entry.pack}
 function parse(project,input){return put(project,Core.parsePack(input))}
 function chunk(project,message){
  for(const [id,upload] of uploads)if(upload.expires<Date.now())uploads.delete(id);
  let upload=uploads.get(project);
  if(message.index===0){upload={id:message.uploadId,next:0,chunks:[],bytes:0,expires:Date.now()+60000};uploads.set(project,upload)}
  if(!upload||upload.id!==message.uploadId||upload.next!==message.index||typeof message.chunk!=='string'||message.chunk.length>262144)throw new Error('建议包分块顺序无效');
  upload.bytes+=new TextEncoder().encode(message.chunk).length;upload.expires=Date.now()+60000;
  if(upload.bytes>Core.MAX_PACK_BYTES){uploads.delete(project);throw new Error('建议包不能超过 64 MiB')}
  upload.chunks.push(message.chunk);upload.next++;
  if(message.last){uploads.delete(project);return parse(project,upload.chunks.join(''))}return null;
 }
 function items(project,ref,index){const pack=get(project,ref),values=[];let bytes=0;
  if(!Number.isInteger(index)||index<0||index>=pack.suggestions.length)throw new Error('建议索引无效');
  for(const item of pack.suggestions.slice(index,index+32)){const size=JSON.stringify(item).length;if(values.length&&bytes+size>131072)break;values.push(item);bytes+=size}return values;
 }
 return{put,get,parse,chunk,items,pin,release};
}
module.exports={create};
