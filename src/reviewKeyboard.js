'use strict';
function action(event){
 if(event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)return null;
 const path=event.composedPath?.() || [event.target];
 if(event.key==='Enter'&&path.some(node=>node?.matches?.('.locate')||node?.matches?.('.search-navigation')||node?.matches?.('.perspective-button')))return null;
 if(path.some(node=>node?.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.panel-drag,.panel-resize')))return null;
 return {ArrowUp:'previous',ArrowDown:'next',Enter:'accept'}[event.key] || null;
}
function attach(card,handler){
 card.tabIndex=0;
 card.addEventListener('keydown',event=>{const choice=action(event);if(!choice)return;event.preventDefault();event.stopPropagation();handler(choice)});
 // Activate before a button can disable itself or a drag cancels the browser's
 // default focus. Tab-focused geometry handles still keep their own keys.
 const activate=event=>{if(!event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.panel-resize'))card.focus({preventScroll:true})};
 card.addEventListener('pointerdown',event=>{if(event.button===0)activate(event)},true);
 card.addEventListener('click',activate);
}
// CodeMirror reveals distant text after a layout pass. Focus once the card is
// visible, but abandon that request if the user starts another interaction.
function deferredFocus(card,{document=card.ownerDocument,visible}){
 let pending=false;
 const inside=event=>event.composedPath?.().includes(card)||card.contains(event.target);
 const interrupt=event=>{if(!inside(event))cancel()};
 const hidden=()=>{if(document.visibilityState==='hidden')cancel()};
 function cancel(){
  pending=false;
  for(const name of ['pointerdown','focusin','keydown'])document.removeEventListener(name,interrupt,true);
  document.removeEventListener('visibilitychange',hidden);
 }
 function flush(){
  if(!pending||document.visibilityState==='hidden'||!card.isConnected||!visible())return;
  cancel();card.focus({preventScroll:true});
 }
 function request(){
  cancel();pending=true;
  for(const name of ['pointerdown','focusin','keydown'])document.addEventListener(name,interrupt,true);
  document.addEventListener('visibilitychange',hidden);
  flush();
 }
 return {request,flush,cancel,dispose:cancel};
}
const css='.card:focus{outline:none}';
module.exports={action,attach,deferredFocus,css};
