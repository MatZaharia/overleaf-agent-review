// Fixture messaging only; no extension installation or live Overleaf access.
if(new URL(location.href).searchParams.has('persistent')){
 const worker=new Worker('/fixture-worker.js'),waiting=new Map();let sequence=0;
 worker.onmessage=event=>{waiting.get(event.data.id)?.(event.data.result);waiting.delete(event.data.id)};
 window.chrome ||= {};
 window.chrome.runtime={id:'fixture-only',sendMessage(message){const id=++sequence;return new Promise(resolve=>{waiting.set(id,resolve);worker.postMessage({id,message})})}};
}
