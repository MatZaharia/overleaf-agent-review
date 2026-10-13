'use strict';
// Cache only the last query's indices. Source is paged, never read from Overleaf.
function create({total,readPage,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}){
 let generation=0,cached=null;
 const normalize=value=>value.toLowerCase();
 function cancel(){generation++;cached=null}
 function search(query){
  const term=normalize(query);
  if(cached?.term===term)return cached.promise;
  const own=++generation;
  const promise=(async()=>{
   if(!term)return [];
   const matches=[];
   for(let offset=0;offset<total;){
    if(own!==generation)return null;
    const items=await readPage(offset);
    if(own!==generation)return null;
    if(!Array.isArray(items)||!items.length)throw new Error('Suggestion search page is empty');
    for(let i=0;i<items.length&&offset+i<total;i++){
     const item=items[i];
     if(normalize(item.original).includes(term)||normalize(item.replacement).includes(term))matches.push(offset+i);
    }
    offset+=items.length;
    await yieldTask();
   }
   return own===generation?matches:null;
  })();
  cached={term,promise};promise.catch(()=>{if(cached?.promise===promise)cached=null});
  return promise;
 }
 return {search,cancel};
}
function pending(matches,isPending){return matches.filter(isPending)}
function adjacent(matches,current,direction){
 if(!matches.length)return null;
 if(direction>0)return matches.find(index=>index>current)??matches[0];
 for(let i=matches.length-1;i>=0;i--)if(matches[i]<current)return matches[i];
 return matches[matches.length-1];
}
module.exports={create,pending,adjacent};
