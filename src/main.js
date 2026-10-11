'use strict';
const Service = require('./service');
const Adapter = require('./overleafAdapter');
const Preview = require('../vendor/inlineReviewPreview');
const Guard = require('../vendor/staleGuard');
const adapter = Adapter.create(window, document);
const preview = Preview.create({ document, window, staleGuard: Guard, getProjectId: adapter.projectId, getActiveFilePath: adapter.path, getEditorView: adapter.view,
  navigate: async ({ path, runProjectId }) => ({ ok: await adapter.open(path, runProjectId) }) });
const service = Service.create({ adapter, preview, crypto: window.crypto });
let capability = '';
const responses = new Map();
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== window.location.origin || event.data?.channel !== 'codex-suggestions:request') return;
  const message = event.data;
  if (typeof message.capability !== 'string' || message.capability.length !== 64 || typeof message.id !== 'string') return;
  if (message.method === 'hello' && !capability) capability = message.capability;
  if (!capability || message.capability !== capability) return;
  const reply = result => window.postMessage({ channel: 'codex-suggestions:response', id: message.id, capability, result }, window.location.origin);
  if (responses.has(message.id)) { responses.get(message.id).then(reply); return; }
  const pending = Promise.resolve().then(() => {
    if (message.method === 'hello') return { ok: true };
    if (message.method === 'begin') return service.begin(message.params);
    if (message.method === 'language') return service.setLanguage(message.params);
    if (message.method === 'snapshot') return service.snapshot();
    if (message.method === 'cancel') return service.cancel();
    if (message.method === 'project') return { ok: true, projectId: adapter.projectId(), file: adapter.path() };
    if (!['prepare', 'status', 'apply', 'navigation'].includes(message.method)) return { ok: false, code: 'unknown_method' };
    if (!message.params?.projectId || adapter.projectId() !== message.params.projectId) return { ok: false, code: 'project_changed' };
    return service[message.method](message.params);
  }).catch(error => ({ ok: false, code: 'bridge_failed', error: error.message }));
  responses.set(message.id, pending);
  if (responses.size > 64) responses.delete(responses.keys().next().value);
  pending.then(result=>{reply(result);if(message.method!=='apply')responses.delete(message.id)});
});
