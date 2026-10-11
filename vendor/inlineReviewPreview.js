(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CodexOverleafInlineReviewPreview = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function create(deps) {
    const { document, window, staleGuard } = deps;
    let active = null, generation = 0;
    const cancelledTokens = new Set();
    const fail = code => ({ ok: false, code, changedDocument: false });
    function dispose() {
      if (active?.timer) window.clearInterval(active.timer);
      active?.host.remove();
      active = null;
    }
    function isCurrent(item) {
      return deps.getProjectId() === item.projectId && deps.getActiveFilePath() === item.path
        && deps.getEditorView() === item.view && item.view.dom.isConnected
        && item.view.state.doc.toString() === item.text;
    }
    function validate() {
      if (!active) return false;
      if (active.failure) return false;
      if (isCurrent(active)) return true;
      active.failure = 'review_context_changed';
      active.host.remove();
      if (active.timer) window.clearInterval(active.timer);
      return false;
    }
    function read(params) {
      if (!active || active.token !== params.token) return fail('review_preview_expired');
      validate();
      return active.failure ? fail(active.failure) : { ok: true, decision: active.decision, token: active.token };
    }
    function clear(params = {}) {
      if (params.token) {
        cancelledTokens.add(params.token);
        if (cancelledTokens.size > 64) cancelledTokens.delete(cancelledTokens.values().next().value);
      }
      if (!params.token || active?.token === params.token) { generation++; dispose(); }
      return { ok: true, changedDocument: false };
    }
    async function show(params) {
      const owner = ++generation;
      dispose();
      if (!params.token || typeof params.base !== 'string' || !params.patch
        || params.runProjectId !== deps.getProjectId()) return fail('review_preview_invalid');
      const opened = await deps.navigate({ path: params.path, from: 0, to: 0, runProjectId: params.runProjectId });
      if (owner !== generation || cancelledTokens.has(params.token)) return fail('review_preview_expired');
      if (!opened.ok) return opened;
      const view = deps.getEditorView();
      if (!view?.domAtPos || !view?.coordsAtPos || !view?.scrollDOM || !view.dom?.isConnected) return fail('review_preview_unsupported');
      const text = view.state.doc.toString();
      const operation = { type: 'edit', path: params.path, patches: [params.patch], reviewBaselineStrict: true };
      const bases = staleGuard.buildBaseFileLookup([{ path: params.path, content: params.base }]);
      if (!staleGuard.checkOperationFreshness(operation, text, bases).ok) return fail('stale_snapshot');
      const prepared = staleGuard.prepareOperationPatches(operation, text, bases);
      const patch = prepared.patches?.[0];
      if (!prepared.ok || prepared.patches.length !== 1 || !patch
        || !Number.isInteger(patch.from) || !Number.isInteger(patch.to) || patch.from < 0 || patch.to < patch.from
        || patch.to > text.length || text.slice(patch.from, patch.to) !== patch.expected) return fail('review_preview_invalid');
      if (params.runProjectId !== deps.getProjectId() || params.path !== deps.getActiveFilePath()) return fail('review_context_changed');
      const highlights = params.highlightPatches || [patch];
      if (!highlights.length || highlights.some(p => !Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < patch.from || p.to > patch.to || p.from > p.to || text.slice(p.from, p.to) !== p.expected)) return fail('review_preview_invalid');
      // Selection/scroll only: no changes transaction, no document mutation.
      view.dispatch({ selection: { anchor: highlights[0].from, head: highlights[0].to }, scrollIntoView: true });
      const host = document.createElement('div');
      host.dataset.codexInlineReview = '';
      host.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;overflow:hidden;';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host{font:13px/1.45 system-ui;color:#202833}*{box-sizing:border-box}.mark{position:absolute;background:rgba(255,176,104,.30);border-bottom:2px solid #c76827;pointer-events:none}.card{position:absolute;pointer-events:auto;background:#fff;border:1px solid #d4dce5;border-radius:9px;padding:12px;box-shadow:0 8px 28px #14233325;max-height:75%;overflow:auto}.title{font-weight:650;margin-bottom:8px}.text{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;background:#eef9f0;color:#165d2a;padding:8px;margin:0 0 10px;max-height:160px;overflow:auto}.hint{font-size:11px;color:#697383;margin:0 0 8px}.actions{display:flex;gap:8px}button{font:inherit;padding:6px 10px;border:1px solid #c8d0da;border-radius:6px;background:#fff;color:#263140;cursor:pointer}button.accept{background:#16764b;border-color:#16764b;color:#fff}button:focus-visible{outline:3px solid #78a9e6}button:disabled{opacity:.5;cursor:default}';
      const marks = document.createElement('div');
      const card = document.createElement('section'); card.className = 'card'; card.setAttribute('aria-label', params.labels?.title || 'Review one change');
      const title = document.createElement('div'); title.className = 'title'; title.textContent = params.labels?.title || 'Review one change';
      const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = params.labels?.hint || 'Original highlighted. Source is unchanged until accepted.';
      const proposed = document.createElement('pre'); proposed.className = 'text'; proposed.textContent = patch.insert || params.labels?.empty || '(empty)';
      const actions = document.createElement('div'); actions.className = 'actions';
      for (const [choice, label] of [[false, params.labels?.reject || 'Reject this change'], [true, params.labels?.accept || 'Accept this change']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.className = choice ? 'accept' : 'reject'; button.dataset.reviewChoice = String(choice);
        button.addEventListener('click', () => {
          if (!validate() || active.decision !== null) return;
          active.decision = choice;
          actions.querySelectorAll('button').forEach(element => { element.disabled = true; });
        });
        actions.append(button);
      }
      card.append(title, hint, proposed, actions); shadow.append(style, marks, card); document.body.append(host);
      active = { token: params.token, projectId: params.runProjectId, path: params.path, view, text, patch, highlights, host, marks, card, decision: null, failure: '', timer: null };
      render();
      active.timer = window.setInterval(render, 250);
      return { ok: true, token: params.token, changedDocument: false };
    }
    function render() {
      if (!validate()) return;
      const item = active, { view, patch, host, marks, card } = item;
      const raw = view.scrollDOM.getBoundingClientRect();
      const bounds = { left: Math.max(0, raw.left), top: Math.max(0, raw.top), right: Math.min(window.innerWidth, raw.right), bottom: Math.min(window.innerHeight, raw.bottom) };
      const width = Math.max(0, bounds.right - bounds.left), height = Math.max(0, bounds.bottom - bounds.top);
      Object.assign(host.style, { left: bounds.left + 'px', top: bounds.top + 'px', width: width + 'px', height: height + 'px' });
      const rects = [];
      try {
        for (const changed of item.highlights) {
        for (const range of view.visibleRanges || []) {
          const from = Math.max(range.from, changed.from), to = Math.min(range.to, changed.to);
          if (from >= to) continue;
          const start = view.domAtPos(from, 1), end = view.domAtPos(to, -1), domRange = document.createRange();
          domRange.setStart(start.node, start.offset); domRange.setEnd(end.node, end.offset);
          rects.push(...domRange.getClientRects());
        }
        if (changed.from === changed.to) {
          const at = view.coordsAtPos(changed.from, 1);
          if (at) rects.push({ ...at, left: at.left, top: at.top, right: at.left + 3, bottom: at.bottom });
        }
        }
      } catch (_) { /* CodeMirror may be between layout passes; render again. */ }
      const visible = rects.filter(rect => rect.bottom > bounds.top && rect.top < bounds.bottom && rect.right >= bounds.left && rect.left < bounds.right);
      marks.replaceChildren(...visible.map(rect => {
        const mark = document.createElement('div'); mark.className = 'mark';
        Object.assign(mark.style, { left: Math.max(0, rect.left - bounds.left) + 'px', top: Math.max(0, rect.top - bounds.top) + 'px', width: Math.max(3, Math.min(bounds.right, rect.right) - Math.max(bounds.left, rect.left)) + 'px', height: Math.max(2, Math.min(bounds.bottom, rect.bottom) - Math.max(bounds.top, rect.top)) + 'px' });
        return mark;
      }));
      // Hide the suggestion when its range is outside the viewport; no floating
      // accept button detached from its original text. Sidebar remains available.
      card.hidden = !visible.length || width < 160 || height < 100;
      if (card.hidden) return;
      const first = visible[0];
      card.style.width = Math.min(370, width - 16) + 'px';
      card.style.left = Math.max(8, Math.min(first.left - bounds.left, width - Math.min(370, width - 16) - 8)) + 'px';
      const below = first.bottom - bounds.top + 8;
      card.style.top = Math.max(8, Math.min(below, height - card.offsetHeight - 8)) + 'px';
    }
    return { show, read, clear, dispose: () => { generation++; dispose(); } };
  }
  return { create };
});
