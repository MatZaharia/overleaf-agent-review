import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
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
let current='main.tex',view;
const state = () => EditorState.create({doc:docs[current],extensions:[lineNumbers(),EditorView.lineWrapping,EditorView.theme({'&':{height:'100%'},'.cm-scroller':{fontFamily:'ui-monospace,monospace',fontSize:'14px',overflow:'auto'},'.cm-content':{padding:'20px 0'}}),EditorView.updateListener.of(update=>{if(update.docChanged){const ranges=[]; update.changes.iterChanges((from,to,_a,_b,insert)=>ranges.push({from,to,insert:insert.toString()})); document.querySelector('#last-changes').textContent=JSON.stringify(ranges); docs[current]=update.state.doc.toString();document.querySelector('#editor-writes').textContent=Number(document.querySelector('#editor-writes').textContent)+1;}})]});
function open(file){if(view){docs[current]=view.state.doc.toString();view.destroy();}current=file;view=new EditorView({state:state(),parent:document.querySelector('#editor')});window.overleaf.unstable.editorView=view;document.querySelector('#filename').textContent=current;document.querySelectorAll('[data-path]').forEach(node=>node.setAttribute('aria-selected',String(node.dataset.path===current)));}
window.overleaf={unstable:{store:{get(path){return {'editor.view':view,'editor.open_doc_name':current,'editor.open_doc_id':current==='main.tex'?'0123456789abcdef01234568':'0123456789abcdef01234569'}[path];}},editorView:null}};
window._ide={project:{_id:'0123456789abcdef01234567'}};
open(current);
document.querySelectorAll('[data-path]').forEach(node=>node.addEventListener('click',()=>open(node.dataset.path)));
document.querySelector('#load-sample').addEventListener('click',()=>{
 const importer=document.querySelector('[data-suggestion-importer]').shadowRoot;
 importer.querySelector('.drawer').hidden=false;
 importer.querySelector('textarea').value=JSON.stringify({format:'codex-overleaf-suggestions',version:1,projectId:'0123456789abcdef01234567',suggestions:[
 {id:'title',file:'main.tex',original:String.raw`\title{Your Paper}`,replacement:String.raw`\title{Review Test}`,reason:'测试标题修改'},
 {id:'author',file:'main.tex',original:String.raw`\author{You}`,replacement:String.raw`\author{Alice}`,reason:'测试拒绝后保留作者'},
 {id:'abstract',file:'main.tex',original:'Your abstract.',replacement:'This is a test of sequential review.',scope:{start:String.raw`\begin{abstract}`,end:String.raw`\end{abstract}`},reason:'只搜索摘要板块'},
 {id:'results',file:'sections/results.tex',original:'The result is old.',replacement:'The result is new.',reason:'测试自动打开嵌套文件'}]},null,2);
});
document.querySelector('#shift').addEventListener('click',()=>view.dispatch({changes:{from:0,insert:'% inserted by coauthor\n\n'}}));
document.querySelector('#stale').addEventListener('click',()=>{const text=view.state.doc.toString(),target=String.raw`\title{Your Paper}`,from=text.indexOf(target);if(from>=0)view.dispatch({changes:{from,to:from+target.length,insert:String.raw`\title{Changed by coauthor}`}})});
