'use strict';
function action(event){
 if(event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)return null;
 const path=event.composedPath?.() || [event.target];
 if(event.key==='Enter'&&path.some(node=>node?.matches?.('.locate')))return null;
 if(path.some(node=>node?.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.panel-drag,.panel-resize')))return null;
 return {ArrowUp:'previous',ArrowDown:'next',Enter:'accept'}[event.key] || null;
}
function attach(card,handler){
 card.tabIndex=0;
 card.addEventListener('keydown',event=>{const choice=action(event);if(!choice)return;event.preventDefault();event.stopPropagation();handler(choice)});
 // Clicking the review text activates shortcuts without moving browser scroll.
 card.addEventListener('click',event=>{if(!event.target.closest?.('button,input,textarea,select,.panel-drag,.panel-resize'))card.focus({preventScroll:true})});
}
module.exports={action,attach};
