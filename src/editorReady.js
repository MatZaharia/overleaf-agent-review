'use strict';
// Read readiness immediately, then on DOM changes. The short fallback catches
// store updates that do not mutate DOM; all observers/timers are bounded.
function wait({window,document,check,alive=()=>true,timeoutMs}){
 if(!alive())return Promise.resolve(false);
 if(check())return Promise.resolve(true);
 return new Promise(resolve=>{
  let done=false,observer,interval,timeout;
  function finish(value){if(done)return;done=true;observer?.disconnect();window.clearInterval(interval);window.clearTimeout(timeout);resolve(value)}
  function inspect(){if(!alive())finish(false);else if(check())finish(true)}
  if(window.MutationObserver&&document.body){observer=new window.MutationObserver(inspect);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected','data-file-id','data-path']})}
  interval=window.setInterval(inspect,50);
  timeout=window.setTimeout(()=>finish(alive()&&check()),timeoutMs);
  inspect();
 });
}
module.exports={wait};
