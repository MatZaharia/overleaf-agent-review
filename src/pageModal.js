'use strict';
// Overleaf dialogs are outside our shadow roots. Temporarily hide the review
// surfaces without cancelling the pending token or changing editor selection.
const selector='dialog[open],[aria-modal="true"],[role="dialog"],[role="alertdialog"],.modal,.modal-backdrop';
const ownSelector='[data-suggestion-importer],[data-codex-inline-review],[data-agent-review-marks]';
function visible(node,window){
 if(!node.isConnected || node.hidden || node.getAttribute('aria-hidden')==='true' || !node.getClientRects().length)return false;
 const style=window.getComputedStyle(node);
 return style.display!=='none' && style.visibility!=='hidden' && style.visibility!=='collapse';
}
function watch({document,window,onChange}){
 let blocked=null,frame=null,disposed=false,ancestors=new Set();
 function check(){
  frame=null;if(disposed)return;
  const candidates=[...document.querySelectorAll(selector)];
  ancestors=new Set();
  for(const candidate of candidates)for(let node=candidate;node;node=node.parentElement)ancestors.add(node);
  const next=candidates.some(node=>!node.closest(ownSelector)&&visible(node,window));
  if(next!==blocked){blocked=next;onChange(next)}
 }
 function relevant(node){
  return node?.nodeType===1 && !node.closest(ownSelector)
   && (ancestors.has(node)||node.matches(selector)||Boolean(node.querySelector(selector)));
 }
 const observer=new window.MutationObserver(records=>{
  if(disposed||frame!==null)return;
  if(records.some(record=>record.type==='attributes'?relevant(record.target):[...record.addedNodes,...record.removedNodes].some(relevant)))frame=window.requestAnimationFrame(check);
 });
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open','role','aria-modal','aria-hidden']});
 check();
 return {blocked:()=>blocked,dispose(){disposed=true;observer.disconnect();if(frame!==null)window.cancelAnimationFrame(frame)}};
}
module.exports={watch,visible};
