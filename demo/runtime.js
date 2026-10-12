// Fixture messaging only; no extension installation or live Overleaf access.
if(new URL(location.href).searchParams.has('persistent')){
 const worker=new Worker('/fixture-worker.js'),waiting=new Map();let sequence=0,invalid=false,loseNext=false;
 const controls=document.createElement('div');controls.innerHTML='<button id="invalidate-extension">模拟扩展失效</button> <button id="invalidate-next-message">下次扩展消息失效</button> <button id="stale-tracking">模拟过期定位记录</button><span id="tracking-fixture-status"></span> 未捕获异常：<span id="unhandled-errors">0</span>';document.querySelector('footer').append(controls);
 controls.querySelector('#invalidate-extension').onclick=()=>{invalid=true;delete window.chrome.runtime.id};
 controls.querySelector('#invalidate-next-message').onclick=()=>{loseNext=true};
 controls.querySelector('#stale-tracking').onclick=async()=>{await window.chrome.runtime.sendMessage({type:'fixture-stale-tracking'});document.querySelector('#tracking-fixture-status').textContent='过期定位已保存，请停止并恢复审阅'};
 window.addEventListener('unhandledrejection',()=>{const node=document.querySelector('#unhandled-errors');node.textContent=Number(node.textContent)+1});
 worker.onmessage=event=>{waiting.get(event.data.id)?.(event.data.result);waiting.delete(event.data.id)};
 window.chrome ||= {};
 window.chrome.storage={local:{async get(key){return {[key]:localStorage.getItem('fixture-ui-'+key)}},async set(values){for(const [key,value] of Object.entries(values))localStorage.setItem('fixture-ui-'+key,value)}}};
 window.chrome.runtime={id:'fixture-only',sendMessage(message){if(loseNext||invalid){invalid=true;delete window.chrome.runtime.id;throw new Error('Extension context invalidated.')}const id=++sequence;return new Promise(resolve=>{waiting.set(id,resolve);worker.postMessage({id,message})})}};
}
