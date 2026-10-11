'use strict';
function adjacent(index,total,direction,isPending){
 // Visit each other item at most once, wrapping across either end.
 for(let step=1;step<total;step++){
  const i=(index+direction*step+total)%total;
  if(isPending(i))return i;
 }
 return null;
}
function nearest(matches,cursor,direction,currentIndex){
 let best=null;
 for(const match of matches){
  if(match.index===currentIndex && cursor>=match.from && cursor<=match.to)continue;
  if(direction<0?match.from>=cursor:match.from<=cursor)continue;
  if(!best || (direction<0?match.from>best.from:match.from<best.from) || (match.from===best.from&&match.index<best.index))best=match;
 }
 return best?.index ?? null;
}
module.exports={adjacent,nearest};
