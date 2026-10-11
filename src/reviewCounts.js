'use strict';
// Count saved decisions only when they still belong to this exact pack.
function restore(pack,decisions={}){
 const counts={written:0,rejected:0,skipped:0,unknown:0,retained:0},indexes=[],decisionIndexes={};
 for(const [index,item] of (pack?.suggestions || []).entries()){
  const state=decisions[item.reviewKey]?.state;
  if(state==='written'||state==='rejected'){counts[state]++;counts.retained++;indexes.push(index);decisionIndexes[item.reviewKey]=index}
 }
 return {counts,indexes,decisionIndexes};
}
function completed(counts){return counts.written+counts.rejected+counts.skipped+counts.unknown}
function retained(pack,decisions){return restore(pack,decisions).counts}
function position(index,finished){let ordinal=0;for(let i=0;i<=index;i++)if(!finished.has(i))ordinal++;return ordinal}
module.exports={restore,retained,completed,position};
