const test=require('node:test'),assert=require('node:assert/strict'),{action}=require('../src/reviewKeyboard');
const event=(key,extra={})=>({key,target:{},...extra});
test('review shortcuts provide navigation and acceptance but ignore held/composing/modifier keys',()=>{
 assert.equal(action(event('ArrowUp')),'previous');assert.equal(action(event('ArrowDown')),'next');assert.equal(action(event('Enter')),'accept');
 for(const property of ['repeat','isComposing','defaultPrevented','ctrlKey','metaKey','altKey','shiftKey'])assert.equal(action(event('Enter',{[property]:true})),null);
 assert.equal(action(event('Escape')),null);
});
test('typing fields, the LaTeX editor and panel geometry controls retain their normal keys',()=>{
 for(const name of ['input','textarea','select','[contenteditable]:not([contenteditable="false"])','.panel-drag','.panel-resize']){
  const node={matches:selector=>selector.includes(name)};
  for(const key of ['Enter','ArrowUp','ArrowDown'])assert.equal(action(event(key,{composedPath:()=>[{},node,{}]})),null);
 }
});
