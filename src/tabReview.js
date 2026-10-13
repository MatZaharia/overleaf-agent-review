'use strict';
const Core=require('./suggestions'),Counts=require('./reviewCounts');
// One file owner at a time. Session storage survives MV3 worker suspension;
// renewals are cheap and never read/re-hash the manuscript or suggestion pack.
function create({progress,catalog,storage,crypto,broadcast=()=>{},now=Date.now}){
 let tail=Promise.resolve();const states=new Map();
 function serial(fn){const next=tail.then(fn);tail=next.catch(()=>{});return next}
 const identity=(project,who)=>project+':'+who.tabId+':'+who.clientId;
 function validWho(who){if(!Number.isInteger(who.tabId)||typeof who.clientId!=='string'||!who.clientId)throw new Error('Tab identity required')}
 async function leases(){return (await storage.get('reviewLeases')).reviewLeases||{}}
 async function store(value){await storage.set({reviewLeases:value})}
 function active(rows,project){return Object.values(rows).filter(l=>l.project===project)}
 const conflict=(a,b)=>!a||!b||a===b;
 async function state(project){if(!states.has(project)){const s=await progress.load(project);s.signature ||= s.pack?await progress.fingerprint(s.pack):null;index(s);states.set(project,s)}return states.get(project)}
 function index(s){s.items=new Map((s.pack?.suggestions||[]).map(i=>[i.reviewKey,i]));s.confirmed=0;for(const key of s.items.keys())if(['written','rejected'].includes(s.decisions[key]?.state))s.confirmed++}
 const summary=s=>({total:s.items.size,confirmed:s.confirmed,pending:s.items.size-s.confirmed});
 async function subscribers(){return (await storage.get('reviewSubscribers')).reviewSubscribers||{}}
 async function subscribe(project,who){const rows=await subscribers();for(const [id,p] of Object.entries(rows))if(p.tabId===who.tabId)delete rows[id];rows[identity(project,who)]={project,...who};await storage.set({reviewSubscribers:rows})}
 async function emit(project,rows,s,updates=[]){await broadcast(Object.values(await subscribers()).filter(p=>p.project===project),{type:'reviewShared',projectId:project,summary:summary(s),updates})}
 function requireLease(rows,project,who,token){const l=rows[identity(project,who)];if(!l||l.token!==token)throw Object.assign(new Error('标签页审阅权限已失效，请重新开始审阅'),{code:'review_lease_lost'});return l}
 function owned(l,file){if(l.file&&l.file!==file)throw new Error('Review file mismatch')}
 function update(s,changes){for(const change of changes){if(!s.items.has(change.reviewKey))continue;const old=s.decisions[change.reviewKey]?.state;if(['written','rejected'].includes(old))s.confirmed--;if(change.state==='pending')delete s.decisions[change.reviewKey];else s.decisions[change.reviewKey]={state:change.state,code:change.code};if(['written','rejected'].includes(change.state))s.confirmed++}}
 async function handle(project,who,message){validWho(who);return serial(async()=>{
  const rows=await leases(),id=identity(project,who);
  if(message.type==='reviewRelease'){if(rows[id]?.token===message.lease){delete rows[id];await store(rows);catalog.release(id)}return {ok:true}}
  if(message.type==='reviewRenew'){
   requireLease(rows,project,who,message.lease);
   const s=await state(project);
   return {ok:true,summary:summary(s),notAfter:now()+5000};
  }
  if(message.type==='session'){
   await subscribe(project,who);let s=await state(project);
   if(message.pack){
    const pack=message.pack.ref?catalog.get(project,message.pack.ref):Core.parsePack(message.pack);
    if(pack.projectId&&pack.projectId!==project)throw new Error('Project mismatch');
    const signature=await progress.fingerprint(pack);
    if(signature!==s.signature){
     if(active(rows,project).some(l=>l.tabId!==who.tabId))throw Object.assign(new Error('其他标签页正在审阅，请先停止后再更换建议包'),{code:'review_pack_busy'});
     await progress.savePack(project,pack,signature);states.delete(project);s=await state(project);await emit(project,rows,s);
    }
   }
   // Read fresh file journals at startup, but reuse the indexed shared counts.
   const saved=await progress.load(project);
   const full=s.pack?catalog.put(project,s.pack,s.signature):null;
   if(!message.acquire){const restored=Counts.restore(s.pack,saved.decisions);return {ok:true,...saved,initialCounts:restored.counts,decidedIndexes:restored.indexes,decisionIndexes:restored.decisionIndexes,pack:full,summary:summary(s)}}
   if(!s.pack)throw new Error('当前项目没有保存的建议包');
   const file=message.file?Core.normalizePath(message.file):'';
   if(active(rows,project).some(l=>l.tabId!==who.tabId&&conflict(l.file,file)))throw new Error('此文件已在其他标签页审阅；请使用不同文件，或先停止另一页');
   const pack=file?{...s.pack,suggestions:s.pack.suggestions.flatMap((i,index)=>i.file===file?[{...i,sourceIndex:index}]:[])}:s.pack;
   if(!pack.suggestions.length)throw new Error('当前文件没有审阅建议，请切换文件或选择全部文件');
   catalog.pin(project,full.ref,id);
   const reviewPack=file?catalog.put(project,pack,s.signature+':'+file):full;catalog.pin(project,reviewPack.ref,id);
   for(const [key,l] of Object.entries(rows))if(l.tabId===who.tabId&&key!==id){delete rows[key];catalog.release(key)}
   const lease=crypto.randomUUID();rows[id]={project,tabId:who.tabId,clientId:who.clientId,file,token:lease};await store(rows);
   const restored=Counts.restore(pack,saved.decisions);
   return {ok:true,...saved,ledgers:file?(saved.ledgers[file]?{[file]:saved.ledgers[file]}:{}):saved.ledgers,pack:full,reviewPack,lease,file,summary:summary(s),initialCounts:restored.counts,decidedIndexes:restored.indexes,decisionIndexes:restored.decisionIndexes};
  }
  if(message.type==='progress'){
   const l=requireLease(rows,project,who,message.lease),s=await state(project),updates=[];
   for(const entry of message.journal||[]){owned(l,entry.file);for(const change of entry.decisions||[]){const item=s.items.get(change.reviewKey);if(item)owned(l,item.file);if(change.state==='pending'&&s.decisions[change.reviewKey]?.state==='written')updates.push({...change,file:item?.file})}}
   if(message.decision){const item=s.items.get(message.decision.reviewKey);if(!item)throw new Error('Suggestion no longer belongs to this pack');owned(l,item.file);updates.push({...message.decision,file:item.file})}
   await progress.save(project,message);update(s,updates);await emit(project,rows,s,updates);return {ok:true,summary:summary(s)};
  }
  if(message.type==='clearProgress'||message.type==='clearTracking'){
   const file=message.type==='clearTracking'?message.file:'';
   if(active(rows,project).some(l=>conflict(l.file,file)))throw new Error('请先停止相关标签页的审阅，再清除进度或重建定位');
   if(file)await progress.clearTracking(project,file);else {await progress.clear(project);states.delete(project);await emit(project,rows,await state(project))}
   return {ok:true};
  }
  throw new Error('Unknown review operation');
 })}
 async function forget(tabId){return serial(async()=>{const rows=await leases();for(const [id,l] of Object.entries(rows))if(l.tabId===tabId){delete rows[id];catalog.release(id)}await store(rows);const listeners=await subscribers();for(const [id,p] of Object.entries(listeners))if(p.tabId===tabId)delete listeners[id];await storage.set({reviewSubscribers:listeners})})}
 return {handle,forget};
}
module.exports={create};
