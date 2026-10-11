'use strict';
function reveal(view,change){
 const transaction={selection:{anchor:change.from,head:change.to}};
 const scroll=view.constructor?.scrollIntoView;
 if(typeof scroll==='function')transaction.effects=scroll.call(view.constructor,change.from,{y:'center',x:'nearest'});
 else transaction.scrollIntoView=true;
 // No changes field. CodeMirror schedules layout and scroll itself.
 view.dispatch(transaction);
}
function panel(body,card){
 const bounds=body.getBoundingClientRect(),rect=card.getBoundingClientRect();
 if(rect.top<bounds.top || rect.bottom>bounds.bottom)body.scrollTop+=rect.top-bounds.top-12;
 card.focus({preventScroll:true});
}
function previewRect(bounds,target){
 const width=Math.min(370,bounds.right-bounds.left-16);
 const belowRoom=bounds.bottom-target.bottom-16,aboveRoom=target.top-bounds.top-16;
 const below=belowRoom>=230 || belowRoom>=aboveRoom;
 const height=Math.min(270,Math.max(230,below?belowRoom:aboveRoom));
 const left=Math.max(bounds.left+8,Math.min(target.left,bounds.right-width-8));
 const top=below?target.bottom+8:target.top-height-8;
 return {left,top:Math.max(bounds.top+8,Math.min(top,bounds.bottom-height-8)),width,height};
}
module.exports={reveal,panel,previewRect};
