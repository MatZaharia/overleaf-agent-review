'use strict';
const Core=require('./suggestions');
function create(crypto){const packs=new Map(),uploads=new Map();
 function put(project,pack){const ref=crypto.randomUUID();packs.set(ref,{project,pack});const previous=[...packs].filter(([id,p])=>p.project===project&&id!==ref);for(const [id] of previous.slice(0,-1))packs.delete(id);return{ref,count:pack.suggestions.length,projectId:pack.projectId}}
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
 return{put,get,parse,chunk,items};
}
module.exports={create};
