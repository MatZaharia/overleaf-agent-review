'use strict';
const css = `.panel-drag{cursor:grab;touch-action:none;user-select:none}.panel-drag:active{cursor:grabbing}.panel-drag:focus-visible,.panel-resize:focus-visible{outline:3px solid #8aafe3;outline-offset:-3px}.panel-resize{position:absolute;right:2px;bottom:2px;width:20px;height:20px;cursor:nwse-resize;touch-action:none;z-index:2;border:0!important;padding:0!important;background:linear-gradient(135deg,transparent 50%,#8c9aa6 51%,#8c9aa6 57%,transparent 58%,transparent 68%,#8c9aa6 69%,#8c9aa6 75%,transparent 76%)!important;border-radius:0!important}`;
function clamp(rect, bounds, minimum = {width:280,height:160}) {
  const width = Math.min(Math.max(minimum.width, rect.width), bounds.width);
  const height = Math.min(Math.max(minimum.height, rect.height), bounds.height);
  return {left:Math.min(Math.max(bounds.left,rect.left),bounds.left+bounds.width-width),top:Math.min(Math.max(bounds.top,rect.top),bounds.top+bounds.height-height),width,height};
}
function attach({panel,drag,resize,window,state={},minimum,defaultRect}) {
  let gesture=null, disposed=false;
  const bounds=()=>({left:8,top:8,width:Math.max(1,window.innerWidth-16),height:Math.max(1,window.innerHeight-16)});
  function layout() {
    if(disposed)return;
    const rect=clamp(state.rect || defaultRect(),bounds(),minimum);
    if(state.rect)state.rect=rect;
    Object.assign(panel.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    return rect;
  }
  function start(event,kind,handle) {
    if(event.button!==0 || event.target.closest?.('button,input,select,textarea,a') && event.target!==resize)return;
    const rect=layout();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,rect,kind,handle};
    handle.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function move(event){
    if(!gesture || event.pointerId!==gesture.id)return;
    const {rect,x,y,kind}=gesture,dx=event.clientX-x,dy=event.clientY-y;
    state.rect=kind==='move'?{...rect,left:rect.left+dx,top:rect.top+dy}:{...rect,width:rect.width+dx,height:rect.height+dy};
    layout();event.preventDefault();
  }
  function end(event){if(!gesture || event.pointerId!==gesture.id)return;const old=gesture;gesture=null;if(old.handle.hasPointerCapture(old.id))old.handle.releasePointerCapture(old.id);}
  const onDrag=e=>start(e,'move',drag),onResize=e=>start(e,'resize',resize);
  function keys(event,kind){
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!delta || event.target!==event.currentTarget)return;
    const rect=layout(),step=event.shiftKey?20:5;
    state.rect=kind==='move'?{...rect,left:rect.left+delta[0]*step,top:rect.top+delta[1]*step}:{...rect,width:rect.width+delta[0]*step,height:rect.height+delta[1]*step};
    layout();event.preventDefault();
  }
  const dragKeys=e=>keys(e,'move'),resizeKeys=e=>keys(e,'resize');
  drag.classList.add('panel-drag');drag.tabIndex=0;resize.classList.add('panel-resize');
  drag.addEventListener('pointerdown',onDrag);resize.addEventListener('pointerdown',onResize);
  drag.addEventListener('keydown',dragKeys);resize.addEventListener('keydown',resizeKeys);
  for(const handle of [drag,resize])for(const [name,fn] of [['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]])handle.addEventListener(name,fn);
  window.addEventListener('resize',layout);
  return {layout,dispose(){disposed=true;if(gesture){const old=gesture;gesture=null;if(old.handle.hasPointerCapture(old.id))old.handle.releasePointerCapture(old.id)}drag.removeEventListener('pointerdown',onDrag);resize.removeEventListener('pointerdown',onResize);drag.removeEventListener('keydown',dragKeys);resize.removeEventListener('keydown',resizeKeys);for(const handle of [drag,resize])for(const [name,fn] of [['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]])handle.removeEventListener(name,fn);window.removeEventListener('resize',layout)}};
}
module.exports={attach,clamp,css};
