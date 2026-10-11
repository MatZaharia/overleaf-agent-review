const test=require('node:test'),assert=require('node:assert/strict'),Scroll=require('../src/reviewScroll');
test('a new source preview requests CodeMirror centering with no source transaction',()=>{
 let transaction,request;
 const view={constructor:{scrollIntoView(from,options){request={from,options};return 'center-effect'}},dispatch:value=>transaction=value};
 Scroll.reveal(view,{from:1500,to:1501});assert.deepEqual(request,{from:1500,options:{y:'center',x:'nearest'}});assert.deepEqual(transaction,{selection:{anchor:1500,head:1501},effects:'center-effect'});assert.equal('changes' in transaction,false);
});
test('sidebar reveal scrolls its own body and focuses without browser scrolling',()=>{
 const body={scrollTop:400,getBoundingClientRect:()=>({top:100,bottom:600})};let focused;
 const card={getBoundingClientRect:()=>({top:550,bottom:900}),focus:options=>focused=options};
 Scroll.panel(body,card);assert.equal(body.scrollTop,838);assert.deepEqual(focused,{preventScroll:true});
 body.scrollTop=50;card.getBoundingClientRect=()=>({top:120,bottom:500});Scroll.panel(body,card);assert.equal(body.scrollTop,50);
});
test('automatic inline placement keeps the highlighted line unobscured near the middle or bottom',()=>{
 const bounds={left:250,right:1000,top:121,bottom:665};
 for(const target of [{left:382,top:383,bottom:403},{left:300,top:610,bottom:630},{left:300,top:145,bottom:165}]){
  const card=Scroll.previewRect(bounds,target);
  assert.ok(card.top+card.height<=target.top || card.top>=target.bottom);
  assert.ok(card.top>=bounds.top && card.top+card.height<=bounds.bottom);
 }
});
