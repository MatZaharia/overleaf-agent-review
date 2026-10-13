import './runtime';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
const docs = {
 'main.tex': String.raw`\documentclass{article}
\title{Your Paper}
\author{You}

\begin{document}
\maketitle

\begin{abstract}
Your abstract.
\end{abstract}

\section{Introduction}
This is the introduction.

\end{document}
`,
 'sections/results.tex': String.raw`\section{Results}
The result is old.
`};
const persistent=new URL(location.href).searchParams.has('persistent');
if(persistent){try{Object.assign(docs,JSON.parse(localStorage.getItem('fixture-docs')||'{}'))}catch{}}
let current='main.tex',view;
const state = () => EditorState.create({doc:docs[current],extensions:[history(),keymap.of(historyKeymap),lineNumbers(),EditorView.lineWrapping,EditorView.theme({'&':{height:'100%'},'.cm-scroller':{fontFamily:'ui-monospace,monospace',fontSize:'14px',overflow:'auto'},'.cm-content':{padding:'20px 0'}}),EditorView.updateListener.of(update=>{document.querySelector('#source-cursor').textContent=update.state.doc.lineAt(update.state.selection.main.head).number;if(update.docChanged){const ranges=[]; update.changes.iterChanges((from,to,_a,_b,insert)=>ranges.push({from,to,insert:insert.toString()})); document.querySelector('#last-changes').textContent=JSON.stringify(ranges.map(p=>({...p,insert:p.insert.length>500?p.insert.slice(0,100)+'… ('+p.insert.length+' characters)':p.insert}))); docs[current]=update.state.doc.toString();if(persistent)localStorage.setItem('fixture-docs',JSON.stringify(docs));document.querySelector('#editor-writes').textContent=Number(document.querySelector('#editor-writes').textContent)+1;}})]});
function open(file){if(view){docs[current]=view.state.doc.toString();view.destroy();}current=file;view=new EditorView({state:state(),parent:document.querySelector('#editor')});window.overleaf.unstable.editorView=view;document.querySelector('#filename').textContent=current;document.querySelectorAll('[data-path]').forEach(node=>node.setAttribute('aria-selected',String(node.dataset.path===current)));}
window.overleaf={unstable:{store:{get(path){return {'editor.view':view,'editor.open_doc_name':current,'editor.open_doc_id':current==='main.tex'?'0123456789abcdef01234568':'0123456789abcdef01234569'}[path];}},editorView:null}};
window._ide={project:{_id:'0123456789abcdef01234567'}};
open(current);
document.querySelector('#page-modal').addEventListener('click',()=>{document.querySelector('#fixture-modal').hidden=false;document.querySelector('#close-page-modal').focus()});
document.querySelector('#close-page-modal').addEventListener('click',()=>{document.querySelector('#fixture-modal').hidden=true});
document.querySelectorAll('[data-path]').forEach(node=>node.addEventListener('click',()=>open(node.dataset.path)));
document.querySelector('#load-sample').addEventListener('click',()=>{
 const importer=document.querySelector('[data-suggestion-importer]').shadowRoot;
 importer.querySelector('.drawer').hidden=false;
 importer.querySelector('textarea').value=JSON.stringify({format:'codex-overleaf-suggestions',version:1,projectId:'0123456789abcdef01234567',suggestions:[
 {id:'title',file:'main.tex',original:String.raw`\title{Your Paper}`,replacement:String.raw`\title{Review Test}`,reason:'测试标题修改'},
 {id:'author',file:'main.tex',original:String.raw`\author{You}`,replacement:String.raw`\author{Alice}`,reason:'测试拒绝后保留作者'},
 {id:'abstract',file:'main.tex',original:'Your abstract.',replacement:'This is a test of sequential review.',scope:{start:String.raw`\begin{abstract}`,end:String.raw`\end{abstract}`},reason:'只搜索摘要板块'},
 {id:'results',file:'sections/results.tex',original:'The result is old.',replacement:'The result is new.',reason:'测试自动打开嵌套文件'}]},null,2);
 importer.querySelector('textarea').dispatchEvent(new Event('input',{bubbles:true}));
});
document.querySelector('#shift').addEventListener('click',()=>view.dispatch({changes:{from:0,insert:'% inserted by coauthor\n\n'}}));
document.querySelector('#stale').addEventListener('click',()=>{const text=view.state.doc.toString(),target=String.raw`\title{Your Paper}`,from=text.indexOf(target);if(from>=0)view.dispatch({changes:{from,to:from+target.length,insert:String.raw`\title{Changed by coauthor}`}})});

document.querySelector('#large').addEventListener('click',()=>view.dispatch({changes:{from:view.state.doc.length,insert:'\n'+('Long unchanged paragraph for interactive performance testing.\n'.repeat(10000))}}));
document.querySelector('#stress').addEventListener('click',()=>{
 const importer=document.querySelector('[data-suggestion-importer]').shadowRoot;
 importer.querySelector('.drawer').hidden=false;
 const textarea=importer.querySelector('textarea');
 textarea.value=JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions:Array.from({length:10000},(_,i)=>({id:'stale-'+i,file:'main.tex',original:'MISSING_SENTENCE_'+i,replacement:'replacement '+i}))});
 textarea.dispatchEvent(new Event('input',{bubbles:true}));
});
let elapsedStart=0,longest=0;
if(window.PerformanceObserver){try{new PerformanceObserver(list=>{for(const task of list.getEntries())longest=Math.max(longest,task.duration);document.querySelector('#longest').textContent=Math.round(longest)}).observe({type:'longtask',buffered:false})}catch{}}
const watch=new MutationObserver(()=>{
 const importer=document.querySelector('[data-suggestion-importer]')?.shadowRoot;if(!importer)return;
 watch.disconnect();
 let navigationStart=0;importer.addEventListener('click',event=>{if(event.target.closest('.cursor-previous,.cursor-next')){navigationStart=performance.now();document.querySelector('#navigation-requests').textContent='0'}},true);
 new MutationObserver(()=>{if(navigationStart && !importer.querySelector('.cursor-next')?.disabled){document.querySelector('#navigation-elapsed').textContent=Math.round(performance.now()-navigationStart);navigationStart=0}}).observe(importer,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
 importer.querySelector('.start').addEventListener('click',()=>{elapsedStart=performance.now();longest=0;document.querySelector('#longest').textContent='0'});
 new MutationObserver(()=>{const message=importer.querySelector('.message').textContent;if(elapsedStart&&message.startsWith('审阅结束')){document.querySelector('#elapsed').textContent=Math.round(performance.now()-elapsedStart);elapsedStart=0}}).observe(importer.querySelector('.message'),{childList:true});
});watch.observe(document.body,{childList:true});

document.querySelector('#navigation-stress').addEventListener('click',()=>{
 const importer=document.querySelector('[data-suggestion-importer]').shadowRoot;
 importer.querySelector('.drawer').hidden=false;
 const suggestions=[{id:'navigation-first',file:'main.tex',original:String.raw`\title{Your Paper}`,replacement:String.raw`\title{Your paper}`,reason:'导航压力测试起点'}];
 for(let i=1;i<9999;i++)suggestions.push({id:'missing-'+i,file:'main.tex',original:'NAV_MISSING_'+i,replacement:'new '+i});
 suggestions.push({id:'navigation-last',file:'main.tex',original:'Your abstract.',replacement:'Our abstract.',reason:'从光标查找应到达第10000项'});
 const textarea=importer.querySelector('textarea');textarea.value=JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions});textarea.dispatchEvent(new Event('input',{bubbles:true}));
});

// Synthetic text only: grammar suffixes, insertion/replacement, a distant item and deletion.
document.querySelector('#diff-demo').addEventListener('click',()=>{
 view.destroy();view=null;
 const originals=['The robots senses objects and produces maps.','A sensor is very noisy.','The measurement is useful.'];
 docs['main.tex']=String.raw`\documentclass{article}`+'\n'+originals[0]+'\n'+('Unchanged filler line for scrolling.\n'.repeat(90))+originals[1]+'\n'+('Unchanged filler line for scrolling.\n'.repeat(90))+originals[2]+'\n';open('main.tex');
 document.querySelector('#editor-writes').textContent='0';document.querySelector('#last-changes').textContent='无';
 const importer=document.querySelector('[data-suggestion-importer]').shadowRoot;importer.querySelector('.drawer').hidden=false;
 const suggestions=[{id:'suffix',file:'main.tex',original:originals[0],replacement:'The robots sense objects and produce maps.',reason:'Two independent suffix deletions.'},{id:'replacement',file:'main.tex',original:originals[1],replacement:'A sensor is slightly noisy.',reason:'Replace one word; the rest remains unchanged.'},{id:'deletion',file:'main.tex',original:originals[2],replacement:'',reason:'Delete one sentence.'}];
 const textarea=importer.querySelector('textarea');textarea.value=JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions});textarea.dispatchEvent(new Event('input',{bubbles:true}));
});

// Deliberately restore journal chunks in acceptance order, not source order.
document.querySelector('#restore-demo').addEventListener('click',async()=>{
 if(!persistent)return;
 const base='AA negative result matters: and rest',later=base.indexOf('rest');
 const edits=[{from:later,to:later+4,insert:'end'},{from:0,to:2,insert:'A'}];
 await chrome.runtime.sendMessage({type:'clearProgress'});
 view.destroy();view=null;docs['main.tex']='A negative result matters: and end';open('main.tex');
 await chrome.runtime.sendMessage({type:'progress',journal:[{file:'main.tex',base,edits}]});
 const importer=document.querySelector('[data-suggestion-importer]').shadowRoot;importer.querySelector('.drawer').hidden=false;
 const textarea=importer.querySelector('textarea');textarea.value=JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions:[{id:'restored-position',file:'main.tex',original:base,replacement:base.replace('matters:','shows how'),reason:'Change matters: to shows how after restoring out-of-order decisions.'}]});textarea.dispatchEvent(new Event('input',{bubbles:true}));
 document.querySelector('#editor-writes').textContent='0';
});

window.addEventListener('message',event=>{if(event.source===window && event.data?.channel==='codex-suggestions:request' && event.data.method==='navigation'){const node=document.querySelector('#navigation-requests');node.textContent=Number(node.textContent)+1}});
document.querySelector('#dense-navigation').addEventListener('click',()=>{
 const suggestions=Array.from({length:10000},(_,i)=>({id:'dense-'+i,file:'main.tex',original:'Unique suggestion '+String(i).padStart(5,'0')+' old.',replacement:'Unique suggestion '+String(i).padStart(5,'0')+' new.'}));
 view.destroy();view=null;docs['main.tex']='Unchanged long introductory material.\n'.repeat(10000)+suggestions.map(item=>item.original).join('\n');open('main.tex');
 const importer=document.querySelector('[data-suggestion-importer]').shadowRoot;importer.querySelector('.drawer').hidden=false;
 const textarea=importer.querySelector('textarea');textarea.value=JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions});textarea.dispatchEvent(new Event('input',{bubbles:true}));
 document.querySelector('#editor-writes').textContent='0';
});
