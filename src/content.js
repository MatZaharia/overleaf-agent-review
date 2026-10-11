'use strict';
const Core = require('./suggestions');
const Runner = require('./runner');
if (!document.querySelector('[data-suggestion-importer]')) mount();
function mount() {
  const host = document.createElement('div'); host.dataset.suggestionImporter = '';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483100;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
:host{font:13px/1.5 system-ui;color:#273342}*{box-sizing:border-box}button,textarea,input{font:inherit}button{border:1px solid #cdd6df;border-radius:6px;background:#fff;color:#273342;padding:7px 11px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,textarea:focus-visible{outline:3px solid #8aafe3;outline-offset:2px}.primary,.launch{background:#176347;color:#fff;border-color:#176347}.launch{box-shadow:0 4px 18px #18352925}.drawer{width:390px;max-width:calc(100vw - 32px);max-height:85vh;overflow:auto;background:#fff;border:1px solid #cbd5de;border-radius:10px;box-shadow:0 10px 40px #14253630;margin-bottom:10px}.head{padding:14px 16px;border-bottom:1px solid #e0e6ec;display:flex;align-items:center;justify-content:space-between}.head strong{font-size:15px}.head button{padding:3px 8px}.body{padding:16px}.muted{color:#657687;font-size:12px;margin:0 0 12px}.label{display:block;margin-bottom:6px;font-weight:600}textarea{display:block;width:100%;height:130px;padding:10px;border:1px solid #ccd7e0;border-radius:6px;resize:vertical;font:12px/1.45 ui-monospace,monospace}.toolbar{display:flex;gap:8px;margin:12px 0}.message{font-size:12px;padding:10px;background:#f0f5f4;border-radius:5px}.card{border:1px solid #d2dce4;border-radius:7px;padding:12px;margin-top:12px}.card strong{display:block}.path{font:11px/1.5 ui-monospace,monospace;color:#687888}.reason{font-size:12px;margin:8px 0}.source{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;margin:6px 0 10px;padding:8px;max-height:180px;overflow:auto;border-radius:4px}.old{background:#fff1e5;color:#74451f}.new{background:#eef8ee;color:#23572c}.actions{display:flex;gap:8px}.history{padding:8px 0;border-bottom:1px solid #e3e9ed;font-size:12px}.history b{color:#176347}.unknown{color:#9a452c}.footer{margin-top:14px;font-size:11px;color:#6b7b88}[hidden]{display:none!important}
</style><section class="drawer" hidden><div class="head"><strong>导入修改建议</strong><button class="close" aria-label="收起">×</button></div><div class="body"><p class="muted">先导入建议包，再逐项确认。每次接受都会搜索当前原文；过时或不唯一的项自动跳过。</p><label class="label" for="pack">建议包 JSON</label><textarea id="pack" spellcheck="false" placeholder="粘贴 Codex 生成的建议包"></textarea><input type="file" accept=".json,application/json" hidden><div class="toolbar"><button class="file">选择 JSON 文件</button><button class="primary start">开始审阅</button><button class="stop" hidden>停止</button></div><div class="message" role="status" aria-live="polite">等待导入建议包</div><div class="pending"></div><div class="history-list"></div><p class="footer">已写入表示编辑器内容已核验，服务器保存需在 Overleaf 检查。可使用 Overleaf 的撤销按钮。</p></div></section><button class="launch">导入修改建议</button>`;
  document.body.append(host);
  const $ = selector => shadow.querySelector(selector);
  const capability = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  let initialized = null, running = false, starting = false, owner = '', cancelled = false, pendingAbort = null;
  function send(method, params) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const handler = event => {
        if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'codex-suggestions:response'
          || event.data.id !== id || event.data.capability !== capability) return;
        cleanup(); resolve(event.data.result);
      };
      const timer = setTimeout(() => { cleanup(); reject(Object.assign(new Error('页面连接超时'), { code: 'bridge_timeout' })); }, method === 'prepare' ? 25000 : 8000);
      function cleanup() { clearTimeout(timer); window.removeEventListener('message', handler); }
      window.addEventListener('message', handler);
      window.postMessage({ channel: 'codex-suggestions:request', id, capability, method, params }, location.origin);
    });
  }
  async function call(method, params) {
    if (!initialized) initialized = send('hello', {});
    const handshake = await initialized;
    if (!handshake.ok) throw new Error('无法连接页面');
    return send(method, params);
  }
  const assertCurrent = () => {
    const current = location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1];
    if (cancelled || current !== owner) throw Object.assign(new Error('已停止'), { code: cancelled ? 'cancelled' : 'project_changed' });
  };
  const status = text => { $('.message').textContent = text; };
  function review(item, prepared, options) {
    return new Promise((resolve, reject) => {
      let token = prepared.token, settled = false, timer = null;
      const card = document.createElement('section'); card.className = 'card';
      card.innerHTML = '<strong></strong><div class="path"></div><p class="reason"></p><div>原文</div><pre class="source old"></pre><div>建议修改</div><pre class="source new"></pre><div class="actions"><button class="reject">拒绝这一项</button><button class="primary accept">接受这一项</button></div>';
      card.querySelector('strong').textContent = '修改 ' + (options.index + 1) + ' / ' + options.total;
      card.querySelector('.path').textContent = item.file + ' · L' + prepared.line;
      card.querySelector('.reason').textContent = item.reason;
      card.querySelector('.old').textContent = item.original;
      card.querySelector('.new').textContent = item.replacement || '（删除此段）';
      $('.pending').replaceChildren(card);
      status(prepared.inline ? '原文已在源码中高亮，等待确认' : '高亮暂不可用，请在此核对原文与建议');
      function finish(accepted, skipped) {
        if (settled) return;
        settled = true; clearTimeout(timer); pendingAbort = null;
        card.querySelectorAll('button').forEach(button => { button.disabled = true; });
        resolve({ accepted, skipped, token });
      }
      card.querySelector('.accept').addEventListener('click', () => finish(true));
      card.querySelector('.reject').addEventListener('click', () => finish(false));
      card.querySelector('.reject').focus();
      pendingAbort = () => { if (!settled) { settled = true; clearTimeout(timer); reject(Object.assign(new Error('已停止'), { code: 'cancelled' })); } };
      async function poll() {
        if (settled) return;
        try {
          assertCurrent();
          const response = await call('status', { token, projectId: owner });
          if (settled) return;
          if (!response.ok) { finish(false, response.code); return; }
          if (response.refreshed) { token = response.token; card.querySelector('.path').textContent = item.file + ' · L' + response.line; status('正文有变化，已重新定位这一项，等待确认'); }
          else if (typeof response.decision === 'boolean') { finish(response.decision); return; }
          timer = setTimeout(poll, 300);
        } catch (error) { finish(false, error.code || 'bridge_failed'); }
      }
      poll();
    });
  }
  function record(result) {
    $('.pending').replaceChildren();
    const row = document.createElement('div'); row.className = 'history';
    const word = result.state === 'written' ? '已写入' : result.state === 'rejected' ? '已拒绝' : result.state === 'unknown' ? '写入未确认' : Core.skipped[result.code] || '已跳过：' + result.code;
    row.textContent = result.item.file + ' · 修改 ' + result.item.id + '：' + word;
    $('.history-list').append(row);
    if (result.state === 'written') status('当前项已写入编辑器，继续核对下一项');
  }
  async function start() {
    if (running || starting) return;
    starting = true; $('.start').disabled = true;
    let pack;
    try {
      pack = Core.parsePack($('#pack').value);
      const current = await call('project', {});
      if (!current.ok || !current.projectId) throw new Error('请先打开 Overleaf 项目');
      if (pack.projectId && pack.projectId !== current.projectId) throw new Error('建议包属于其他项目，没有写入');
      owner = current.projectId;
    } catch (error) { status(error.message); starting = false; $('.start').disabled = false; return; }
    running = true; starting = false; cancelled = false;
    $('.start').disabled = true; $('.file').disabled = true; $('#pack').disabled = true; $('.stop').hidden = false;
    $('.history-list').replaceChildren();
    try {
      const results = await Runner.run(pack, { projectId: owner, assertCurrent, call, review, record });
      const count = state => results.filter(result => result.state === state).length;
      status('审阅结束：写入 ' + count('written') + ' 项，拒绝 ' + count('rejected') + ' 项，跳过 ' + count('skipped') + ' 项。');
    } catch (error) {
      status(error.code === 'write_unconfirmed' ? '写入结果未确认，已停止。请检查当前正文，不要重复接受。' : '审阅已停止：' + (error.code || error.message));
    } finally {
      pendingAbort?.(); pendingAbort = null;
      await call('cancel', {}).catch(() => {});
      $('.pending').replaceChildren(); running = false;
      $('.start').disabled = false; $('.file').disabled = false; $('#pack').disabled = false; $('.stop').hidden = true;
    }
  }
  $('.launch').addEventListener('click', () => { $('.drawer').hidden = !$('.drawer').hidden; });
  $('.close').addEventListener('click', () => { $('.drawer').hidden = true; });
  $('.file').addEventListener('click', () => $('input').click());
  $('input').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > Core.MAX_PACK_BYTES) { status('建议包不能超过 2 MiB'); return; }
    try { $('#pack').value = await file.text(); status('已读取建议包，点击开始审阅'); } catch (_) { status('无法读取文件'); }
    event.target.value = '';
  });
  $('.start').addEventListener('click', start);
  $('.stop').addEventListener('click', () => { cancelled = true; pendingAbort?.(); call('cancel', {}).catch(() => {}); status('正在停止；已派发的项需核验实际结果。'); });
}
