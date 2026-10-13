'use strict';
const Core = require('./suggestions');
const Tree = require('../vendor/treeOperations');
const ProjectFiles = require('../vendor/projectFiles');
const Ready = require('./editorReady');
function create(window, document) {
  const store = () => window.overleaf?.unstable?.store || window.Overleaf?.unstable?.store;
  function read(path) { try { return store()?.get(path); } catch (_) { return undefined; } }
  function view() {
    const candidates = [read('editor.view'), read('editor.view.camel'), read('editor')?.view,
      window.overleaf?.unstable?.editorView, window.Overleaf?.editorView, window._ide?.editorView];
    for (const node of document.querySelectorAll('.cm-content')) candidates.push(node.cmView?.view);
    return candidates.find(v => v?.state?.doc && typeof v.dispatch === 'function' && typeof v.state.doc.toString === 'function'
      && v.dom?.isConnected && v.dom.querySelector('.cm-content') && !v.dom.closest('[data-suggestion-importer]')) || null;
  }
  function storePath() {
    const name = read('editor.open_doc_name') || read('editor.openDocName') || window._ide?.editor?.open_doc_name;
    try { return typeof name === 'string' ? Core.normalizePath(name) : ''; } catch (_) { return ''; }
  }
  const tree = Tree.create({ window, document, projectFiles: ProjectFiles, normalizePath: value => { try { return Core.normalizePath(value); } catch (_) { return ''; } },
    readActiveEditorText: () => view()?.state.doc.toString() ?? '', getActiveEditorIdentity: view,
    activeEditorIdentityChanged: (before, after) => before !== after, getActiveFilePathFromEditorStore: storePath });
  const projectId = () => window.location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1] || '';
  const path = () => tree.getActiveFilePath();
  async function open(file, owner) {
    if (projectId() !== owner) return false;
    const previous = view(), navigating = path() !== file;
    if (navigating) {
      const opened = await tree.openFileByPath(file, { activeWaitMs: 1200, retryWaitMs: 1200,settleDelayMs:0,shouldContinue:()=>projectId()===owner,
        waitForActive:(target,timeoutMs)=>Ready.wait({window,document,timeoutMs,alive:()=>projectId()===owner,check:()=>path()===target}) });
      if (!opened.ok) return false;
    }
    // On file switches, wait for a new source EditorView. If Overleaf starts
    // reusing views without a readable document identity, fail closed.
    return Ready.wait({window,document,timeoutMs:4000,alive:()=>projectId()===owner,check:()=>{
      const active=view();return path()===file&&Boolean(active)&&(!navigating||active!==previous);
    }});
  }
  return { projectId, path, view, open };
}
module.exports = { create };
