'use strict';
const Core = require('./suggestions');
const { characterEdits } = require('./characterEdits');
const { diffChars } = require('diff');
function upper(array, value) { let lo=0,hi=array.length;while(lo<hi){const mid=(lo+hi)>>>1;if(array[mid]<=value)lo=mid+1;else hi=mid}return lo; }
function index(ledger) {
 if(ledger.index && ledger.index.version===ledger.version)return ledger.index;
 ledger.edits.sort((a,b)=>a.from-b.from||a.to-b.to);
 const ends=[],liveEnds=[],deltas=[];let delta=0;
 for(const edit of ledger.edits){delta+=edit.insert.length-(edit.to-edit.from);ends.push(edit.to);liveEnds.push(edit.to+delta);deltas.push(delta)}
 return ledger.index={version:ledger.version,ends,liveEnds,deltas};
}
function map(ledger,pos,inverse=false){const idx=index(ledger),n=upper(inverse?idx.liveEnds:idx.ends,pos);return pos+(inverse?-1:1)*(n?idx.deltas[n-1]:0)}
function touching(ledger,p,live=false){
 const idx=index(ledger),ends=live?idx.liveEnds:idx.ends;
 let at=Math.max(0,upper(ends,p.from)-1),found=[];
 for(;at<ledger.edits.length;at++){
  const q=ledger.edits[at],delta=at?idx.deltas[at-1]:0,from=live?q.from+delta:q.from,to=live?from+q.insert.length:q.to;
  if(from>p.to)break;
  if((p.from<p.to&&from<to&&p.from<to&&from<p.to)||(p.from===p.to&&from<p.from&&p.from<to)||(from===to&&p.from<from&&from<p.to)||(p.from===p.to&&from===to&&p.from===from))found.push(q);
 }
 return found;
}
function add(ledger,edits){ledger.edits.push(...edits);ledger.edits.sort((a,b)=>a.from-b.from||a.to-b.to);ledger.version=(ledger.version||0)+1;}
const editKey=p=>JSON.stringify([p.from,p.to,p.insert]);
function historyIndex(ledger){if(!ledger.historyIndex){ledger.historyIndex=new Map();for(const p of ledger.history||[])ledger.historyIndex.set(editKey(p),p)}return ledger.historyIndex;}
function render(base,edits){const pieces=[];let pos=0;for(const p of [...edits].sort((a,b)=>a.from-b.from||a.to-b.to)){pieces.push(base.slice(pos,p.from),p.insert);pos=p.to}pieces.push(base.slice(pos));return pieces.join('');}
function remember(ledger,edits){ledger.history ||= [];const known=historyIndex(ledger);for(const p of edits)if(!p.external&&!known.has(editKey(p))){ledger.history.push({...p});known.set(editKey(p),p)}}
// Trim unchanged edges before a bounded diff. External changes are tracked
// separately and can never masquerade as accepted suggestions.
function sync(ledger,text,recompute=true){
 if(ledger.current===text)return {ok:true,edits:[]};
 const old=ledger.current;let from=0,tail=0;
 while(from<old.length&&from<text.length&&old[from]===text[from])from++;
 while(tail<old.length-from&&tail<text.length-from&&old[old.length-1-tail]===text[text.length-1-tail])tail++;
 if(from && /[\uDC00-\uDFFF]/.test(old[from]||text[from]||''))from--;
 const parts=diffChars(old.slice(from,old.length-tail),text.slice(from,text.length-tail),{timeout:25,maxEditLength:4096});
 if(!parts)return {ok:false};
 const changes=[];let pos=from,pending=null;
 const flush=()=>{if(pending){changes.push(pending);pending=null}};
 for(const part of parts){if(!part.added&&!part.removed){flush();pos+=part.value.length}else{pending ||= {from:pos,to:pos,insert:''};if(part.removed){pos+=part.value.length;pending.to=pos}else pending.insert+=part.value}}
 flush();
 const overlaps=changes.flatMap(p=>touching(ledger,p,true));
 if(overlaps.length){
  if(!recompute)return {ok:false,overlaps};
  // Undo may touch several character edits in one transaction. Keep the
  // original baseline and unrelated accepted edits, then account for any
  // remaining manual text as external changes. Never reset every anchor.
  const affected=new Set(overlaps),removed=ledger.edits.filter(p=>!p.external&&affected.has(p));
  let own=ledger.edits.filter(p=>!p.external&&!affected.has(p)),replacement,result;
  // A repeated character can make the minimal diff pick either identical
  // occurrence (e.g. undoing the extra x in "xx"). Expand only when the
  // rebuilt document proves that another owned edit is also affected.
  for(let attempt=0;attempt<32;attempt++){
   replacement={base:ledger.base,current:render(ledger.base,own),edits:own,version:0};result=sync(replacement,text,false);
   if(result.ok)break;
   const extra=own.filter(p=>result.overlaps?.includes(p));if(!extra.length)return {ok:false};
   removed.push(...extra);own=own.filter(p=>!extra.includes(p));
  }
  if(!result.ok)return {ok:false};
  remember(ledger,removed);
  ledger.current=text;ledger.edits=replacement.edits;ledger.version=(ledger.version||0)+1;
  return {ok:true,replace:true,edits:ledger.edits,removed,decisions:[...new Set(removed.map(p=>p.reviewKey).filter(Boolean))].map(reviewKey=>({reviewKey,state:'pending'}))};
 }
 const edits=changes.map(p=>{
  const edit={from:map(ledger,p.from,true),to:map(ledger,p.to,true),insert:p.insert,external:true};
  // Only exact edits previously accepted by the human can be recognized as
  // redo. A new manual replacement remains external even if it looks similar.
  const known=historyIndex(ledger).get(editKey(edit));return known?{...known}:edit;
 });
 add(ledger,edits);ledger.current=text;return {ok:true,edits};
}
function resolve(text,item,ledger){
 if(!ledger || ledger.current!==text)return Core.locate(text,item);
 if(!ledger.edits.length){const match=Core.locate(text,item);if(!match.ok)return match;const edits=characterEdits(match.patch,ledger.base);return edits?{...match,baselineChanges:edits,characterChanges:edits}:{ok:false,code:'diff_too_complex'}}
 const base=Core.locate(ledger.base,item);
 if(!base.ok)return Core.locate(text,item);
 // Keep live ambiguity checks even when baseline coordinates are known.
 const live=Core.locate(text,item);if(live.code==='ambiguous_match'||live.code==='ambiguous_scope')return live;
 const requested=characterEdits(base.patch,ledger.base);
 if(!requested)return {ok:false,code:'diff_too_complex'};
 const remaining=[];
 for(const p of requested){
  const touches=touching(ledger,p);
  if(touches.length){
   if(touches.length===1&&!touches[0].external&&touches[0].from===p.from&&touches[0].to===p.to&&touches[0].insert===p.insert)continue;
   return {ok:false,code:touches.some(q=>q.external)?(live.ok?'overlapping_change':live.code||'original_missing'):'overlapping_change'};
  }
  remaining.push(p);
 }
 if(!remaining.length)return {ok:false,code:'already_applied'};
 // Avoid incorporating a boundary insertion into the wrong baseline range.
 const from=map(ledger,base.patch.from),to=map(ledger,base.patch.to);
 const changes=remaining.map(p=>({...p,from:map(ledger,p.from),to:map(ledger,p.to)}));
 // A mapped coordinate is never evidence that the source characters still match.
 if(from<0 || to<from || to>text.length || changes.some(p=>p.from<from || p.to>to || p.from>p.to || text.slice(p.from,p.to)!==p.expected))return {ok:false,code:'position_mismatch'};
 let insert=text.slice(from,to);
 for(const p of [...changes].reverse())insert=insert.slice(0,p.from-from)+p.insert+insert.slice(p.to-from);
 return {ok:true,line:Core.lineAtSource(text,from),patch:{from,to,expected:text.slice(from,to),insert},baselineChanges:remaining,characterChanges:changes};
}
module.exports={resolve,sync,add,map,remember,render};
