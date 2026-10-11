'use strict';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
function create(indexedDB,crypto){
 let opening;
 function db(){return opening ||= new Promise((resolve,reject)=>{const r=indexedDB.open('codex-overleaf-review',1);r.onupgradeneeded=()=>{for(const name of ['packs','decisions','bases','edits']){const store=r.result.createObjectStore(name,{keyPath:'key'});store.createIndex('project','project')}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 const complete=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Progress transaction aborted'))});
 async function keys(pack){
  const suggestions=[];
  for(let offset=0;offset<pack.suggestions.length;offset+=64){
   suggestions.push(...await Promise.all(pack.suggestions.slice(offset,offset+64).map(async item=>{
    const fields=[item.id,item.file,item.original,item.replacement,item.before,item.after,item.scope||null];
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(fields)));
    return {...item,reviewKey:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
   })));
  }return {...pack,suggestions};
 }
 async function load(project){
  const database=await db(),tx=database.transaction(['packs','decisions','bases','edits'],'readonly'),done=complete(tx);
  const reads=['packs','decisions','bases','edits'].map(name=>request(tx.objectStore(name).index('project').getAll(project)));
  const [packs,records,bases,chunks]=await Promise.all(reads);await done;
  const ledgers={};for(const base of bases)ledgers[base.file]={base:base.base,edits:chunks.filter(c=>c.file===base.file&&c.generation===base.generation).sort((a,b)=>a.sequence-b.sequence).flatMap(c=>c.edits)};
  return {pack:packs[0]?.pack||null,decisions:Object.fromEntries(records.map(r=>[r.key[1],{state:r.state,code:r.code}])),ledgers};
 }
 async function savePack(project,pack){
  const prepared=await keys(pack),database=await db(),tx=database.transaction('packs','readwrite'),done=complete(tx);
  tx.objectStore('packs').put({key:project,project,pack:prepared});await done;
 }
 async function save(project,{decision,journal=[]}){
  const database=await db(),tx=database.transaction(['decisions','bases','edits'],'readwrite'),done=complete(tx);
  if(decision)tx.objectStore('decisions').put({key:[project,decision.reviewKey],project,state:decision.state,code:decision.code||''});
  for(const entry of journal){
   const chunksStore=tx.objectStore('edits');
   if(entry.id && await request(chunksStore.get([project,'receipt',entry.id])))continue;
   const store=tx.objectStore('bases'),key=[project,entry.file];
   const existing=await request(store.get(key));
   let base=existing;
   if(typeof entry.base==='string'){
    base={key,project,file:entry.file,base:entry.base,generation:crypto.randomUUID(),sequence:0};store.put(base);
    // Delete obsolete chunks when resetting a baseline, keeping storage bounded.
    const chunks=await request(tx.objectStore('edits').index('project').getAll(project));
    for(const chunk of chunks)if(chunk.file===entry.file)tx.objectStore('edits').delete(chunk.key);
   }
   if(entry.replace){const chunks=await request(chunksStore.index('project').getAll(project));for(const chunk of chunks)if(chunk.file===entry.file)chunksStore.delete(chunk.key)}
   if(entry.id)chunksStore.put({key:[project,'receipt',entry.id],project,file:'',edits:[]});
   if(base&&entry.edits?.length){base.sequence++;store.put(base);tx.objectStore('edits').put({key:crypto.randomUUID(),project,file:entry.file,generation:base.generation,sequence:base.sequence,edits:entry.edits})}
  }await done;
 }
 async function clear(project){const database=await db(),tx=database.transaction(['packs','decisions','bases','edits'],'readwrite'),done=complete(tx);for(const name of ['packs','decisions','bases','edits']){const store=tx.objectStore(name),rows=await request(store.index('project').getAll(project));for(const row of rows)store.delete(row.key)}await done;}
 return {load,savePack,save,clear,keys};
}
module.exports={create};
