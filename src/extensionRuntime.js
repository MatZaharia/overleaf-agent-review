'use strict';
const message='扩展已更新或重新加载，审阅已停止。请刷新 Overleaf 页面后继续；刚接受的修改请先核对正文。';
function create(getChrome,onInvalid=()=>{}){
 let invalid=false;
 const error=()=>Object.assign(new Error(message),{code:'extension_invalidated'});
 function invalidate(){if(!invalid){invalid=true;onInvalid()}return error()}
 function check(){
  if(invalid)throw error();
  try{if(getChrome()?.runtime?.id)return}catch{}
  throw invalidate();
 }
 async function run(operation){
  check();
  try{const result=await operation(getChrome());check();return result}
  catch(cause){
   if(cause?.code==='extension_invalidated'||/extension context invalidated/i.test(cause?.message||''))throw invalidate();
   check();throw cause;
  }
 }
 return {check,message:body=>run(chrome=>chrome.runtime.sendMessage(body)),storage:(method,value)=>run(chrome=>chrome.storage.local[method](value)),get invalid(){return invalid}};
}
module.exports={create,message};
