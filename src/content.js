'use strict';
const Core = require('./suggestions');
const Runner = require('./runner');
if (!document.querySelector('[data-suggestion-importer]')) mount();
function mount() {
  const host = document.createElement('div'); host.dataset.suggestionImporter = '';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483100;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
:host{font:13px/1.5 system-ui;color:#273342}*{box-sizing:border-box}button,textarea,input{font:inherit}button{border:1px solid #cdd6df;border-radius:6px;background:#fff;color:#273342;padding:7px 11px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,textarea:focus-visible{outline:3px solid #8aafe3;outline-offset:2px}.primary,.launch{background:#176347;color:#fff;border-color:#176347}.launch{box-shadow:0 4px 18px #18352925}.drawer{width:390px;max-width:calc(100vw - 32px);max-height:85vh;overflow:auto;background:#fff;border:1px solid #cbd5de;border-radius:10px;box-shadow:0 10px 40px #14253630;margin-bottom:10px}.head{padding:14px 16px;border-bottom:1px solid #e0e6ec;display:flex;align-items:center;justify-content:space-between}.head strong{font-size:15px}.head button{padding:3px 8px}.body{padding:16px}.muted{color:#657687;font-size:12px;margin:0 0 12px}.label{display:block;margin-bottom:6px;font-weight:600}textarea{display:block;width:100%;height:130px;padding:10px;border:1px solid #ccd7e0;border-radius:6px;resize:vertical;font:12px/1.45 ui-monospace,monospace}.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.message{font-size:12px;padding:10px;background:#f0f5f4;border-radius:5px}.card{border:1px solid #d2dce4;border-radius:7px;padding:12px;margin-top:12px}.card strong{display:block}.path{font:11px/1.5 ui-monospace,monospace;color:#687888}.reason{font-size:12px;margin:8px 0}.source{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;margin:6px 0 10px;padding:8px;max-height:180px;overflow:auto;border-radius:4px}.old{background:#fff1e5;color:#74451f}.new{background:#eef8ee;color:#23572c}.actions{display:flex;gap:8px}.history{padding:8px 0;border-bottom:1px solid #e3e9ed;font-size:12px}.history b{color:#176347}.unknown{color:#9a452c}.footer{margin-top:14px;font-size:11px;color:#6b7b88}[hidden]{display:none!important}
</style><section class="drawer" hidden><div class="head"><strong>导入修改建议</strong><button class="close" aria-label="收起">×</button></div><div class="body"><p class="muted">先导入建议包，再逐项确认。每次接受都会搜索当前原文；过时或不唯一的项自动跳过。</p><label class="label" for="pack">建议包 JSON</label><textarea id="pack" spellcheck="false" placeholder="粘贴 Codex 生成的建议包"></textarea><input type="file" accept=".json,application/json" hidden><div class="toolbar"><button class="connect">连接 Codex</button><button class="disconnect">断开</button></div><div class="bridge-status" role="status"></div><input class="bridge-token" type="password" placeholder="本地连接配对令牌" autocomplete="off"><div class="toolbar"><button class="file">选择 JSON 文件</button><button class="primary start">开始审阅</button><button class="resume">恢复上次审阅</button><button class="reset">清除进度</button><button class="stop" hidden>停止</button></div><div class="message" role="status" aria-live="polite">等待导入建议包</div><div class="pending"></div><div class="history-list"></div><p class="footer">已写入表示编辑器内容已核验，服务器保存需在 Overleaf 检查。可使用 Overleaf 的撤销按钮。</p></div></section><button class="launch">导入修改建议</button>`;
  document.body.append(host);
  const $ = selector => shadow.querySelector(selector);
  const capability = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const persistent=typeof chrome!=='undefined' && !!chrome.runtime?.id;
  let startEpoch = 0, sessionActive=false;
  let importedPack = null, initialized = null, running = false, starting = false, owner = '', cancelled = false, pendingAbort = null;
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
    const result=await send(method, params);
    if(persistent && sessionActive && result.journal?.length){const saved=await chrome.runtime.sendMessage({type:'progress',journal:result.journal});if(!saved.ok)throw new Error('保存定位记录失败：'+saved.error)}
    return result;
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
      card.querySelector('.old').textContent = prepared.item?.original || item.original;
      card.querySelector('.new').textContent = (prepared.item?.replacement ?? item.replacement) || '（删除此段）';
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
          if (response.refreshed) { if(response.item){card.querySelector('.old').textContent=response.item.original;card.querySelector('.new').textContent=response.item.replacement || '（删除此段）';} token = response.token; card.querySelector('.path').textContent = item.file + ' · L' + response.line; status('正文有变化，已重新定位这一项，等待确认'); }
          else if (typeof response.decision === 'boolean') { finish(response.decision); return; }
          timer = setTimeout(poll, 300);
        } catch (error) { finish(false, error.code || 'bridge_failed'); }
      }
      poll();
    });
  }
  let historyMessages=[],historyFrame=null;
  function renderHistory(){if(historyFrame!==null)return;historyFrame=requestAnimationFrame(()=>{historyFrame=null;$('.history-list').replaceChildren(...historyMessages.map(text=>{const row=document.createElement('div');row.className='history';row.textContent=text;return row}))})}
  async function record(result) {
    if(persistent && ['written','rejected','unknown'].includes(result.state)){const saved=await chrome.runtime.sendMessage({type:'progress',decision:{reviewKey:result.item.reviewKey,state:result.state,code:result.code}});if(!saved.ok)throw new Error('保存审阅决定失败：'+saved.error)}
    if(bridgeRevision) bridgeResults.push({revision:bridgeRevision,id:result.item.id,state:result.state,code:result.code});
    if($('.pending').firstChild)$('.pending').replaceChildren();
    const word = result.state === 'written' ? '已写入' : result.state === 'rejected' ? '已拒绝' : result.state === 'unknown' ? '写入未确认' : Core.skipped[result.code] || '已跳过：' + result.code;
    historyMessages.push(result.item.file + ' · 修改 ' + result.item.id + '：' + word);
    if(historyMessages.length>100)historyMessages.shift();renderHistory();
    if (result.state === 'written') status('当前项已写入编辑器，继续核对下一项');
  }
  async function parseInput(input){
    if(!persistent)return Core.parsePack(input);
    let response;
    if(input?.ref)return input;
    if(typeof input==='string'&&input.length>262144){const uploadId=crypto.randomUUID();let index=0;for(let from=0;from<input.length;from+=262144){response=await chrome.runtime.sendMessage({type:'parseChunk',uploadId,index:index++,chunk:input.slice(from,from+262144),last:from+262144>=input.length});if(!response.ok)throw new Error(response.error)}}
    else response=await chrome.runtime.sendMessage({type:'parse',input});
    if(!response.ok)throw new Error(response.error);return response.pack;
  }
  async function start() {
    if (running || starting) return;
    const epoch = ++startEpoch;
    starting = true; $('.start').disabled = true;
    let pack, session={decisions:{},ledgers:{}};
    try {
      pack = await parseInput(importedPack || $('#pack').value);
      const current = await call('project', {});
      if (!current.ok || !current.projectId) throw new Error('请先打开 Overleaf 项目');
      if (pack.projectId && pack.projectId !== current.projectId) throw new Error('建议包属于其他项目，没有写入');
      if (epoch !== startEpoch) throw new Error('建议已更新或审阅已停止');
      if(persistent){session=await chrome.runtime.sendMessage({type:'session',pack});if(!session.ok)throw new Error(session.error);pack=session.pack}
      if(epoch!==startEpoch)throw new Error('建议已更新或审阅已停止');
      owner = current.projectId;sessionActive=true;
    } catch (error) { status(error.message); starting = false; $('.start').disabled = false; return; }
    running = true; starting = false; cancelled = false;
    $('.start').disabled = true; $('.resume').disabled=true;$('.reset').disabled=true; $('.file').disabled = true; $('#pack').disabled = true; $('.stop').hidden = false;
    historyMessages=[];$('.history-list').replaceChildren();
    try {
      await call('begin', {ledgers:session.ledgers});
      let itemBuffer=[],bufferStart=-1;
      const itemAt=persistent?async index=>{if(index<bufferStart||index>=bufferStart+itemBuffer.length){const fetched=await chrome.runtime.sendMessage({type:'items',ref:pack.ref,index});if(!fetched.ok)throw new Error(fetched.error);bufferStart=index;itemBuffer=fetched.items}return itemBuffer[index-bufferStart]}:null;
      const results = await Runner.run(pack, { projectId: owner, assertCurrent, call, review, record, decisions:session.decisions, itemAt, retained:result=>{if(bridgeRevision)bridgeResults.push({revision:bridgeRevision,id:result.item.id,state:result.state,code:'retained_decision'})} });
      const count = state => results.filter(result => result.state === state).length;
      status('审阅结束：写入 ' + count('written') + ' 项，拒绝 ' + count('rejected') + ' 项，跳过 ' + count('skipped') + ' 项，保留先前决定 ' + count('retained') + ' 项。');
    } catch (error) {
      status(error.code === 'write_unconfirmed' ? '写入结果未确认，已停止。请检查当前正文，不要重复接受。' : '审阅已停止：' + (error.code || error.message));
    } finally {
      pendingAbort?.(); pendingAbort = null;
      await call('cancel', {}).catch(() => {});
      $('.pending').replaceChildren(); running = false;
      $('.start').disabled = false;$('.resume').disabled=false;$('.reset').disabled=false; $('.file').disabled = false; $('#pack').disabled = false; $('.stop').hidden = true;
    }
  }

  let bridgeRevision=0, bridgeEnabled=false, bridgeBusy=false, bridgeResults=[];
  const bridgeMessage=message=>chrome.runtime.sendMessage(message);
  $('.connect').addEventListener('click',async()=>{
    if(typeof chrome==='undefined'||!chrome.runtime?.id){status('本地连接需要在 Chrome 扩展中使用');return;}
    const result=await bridgeMessage({type:'connect',token:$('.bridge-token').value}).catch(e=>({error:e.message}));
    if(!result.ok){$('.bridge-status').textContent=result.error;return;}
    $('.bridge-token').value=''; bridgeEnabled=true; $('.bridge-status').textContent='已连接：Codex 请求时才读取源码；新建议等待逐项确认'; pollBridge();
  });
  $('.disconnect').addEventListener('click',async()=>{bridgeEnabled=false;if(typeof chrome!=='undefined')await bridgeMessage({type:'disconnect'});$('.bridge-status').textContent='已断开本地连接';});
  async function pollBridge(){
    if(!bridgeEnabled||bridgeBusy)return;bridgeBusy=true;
    try {
      const batch=bridgeResults.slice(0,500);
      const result=await bridgeMessage({type:'sync',revision:bridgeRevision,results:batch});
      if(!bridgeEnabled)return;
      if(result.ok)bridgeResults.splice(0,batch.length);
      if(result.disconnected){bridgeEnabled=false;return;}
      if(!result.ok)throw new Error(result.error);
      if(result.snapshotRequest){
        const snapshot=await call('snapshot',{});
        if(!snapshot.ok)throw new Error('源码编辑器未就绪');
        if(!bridgeEnabled)return;
        const uploaded=await bridgeMessage({type:'sync',snapshot,requestId:result.snapshotRequest.id,revision:bridgeRevision,results:[]});
        if(!uploaded.ok)throw new Error(uploaded.error);
      }
      if(result.pack && result.revision!==bridgeRevision){
        // Invalidate the old preview before showing an updated pack. Never
        // retain an acceptance button across a producer revision change.
        ++startEpoch; cancelled=true; pendingAbort?.(); await call('cancel',{});
        while(running||starting)await new Promise(r=>setTimeout(r,30));
        if(!bridgeEnabled)return;
        bridgeRevision=result.revision; bridgeResults=[]; importedPack=result.pack;
        $('#pack').value='Codex 建议版本 '+bridgeRevision+'，共 '+(result.pack.count ?? result.pack.suggestions.length)+' 项';
        $('.drawer').hidden=false; start();
      }
      $('.bridge-status').textContent='已连接 · 源码按需读取 · 建议版本 '+bridgeRevision;
    }catch(error){$('.bridge-status').textContent='本地连接暂不可用：'+error.message;}
    finally{bridgeBusy=false;if(bridgeEnabled)setTimeout(pollBridge,2000);}
  }

  $('.launch').addEventListener('click', () => { $('.drawer').hidden = !$('.drawer').hidden; });
  $('.close').addEventListener('click', () => { $('.drawer').hidden = true; });
  $('.file').addEventListener('click', () => $('input[type=file]').click());
  $('input[type=file]').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > Core.MAX_PACK_BYTES) { status('建议包不能超过 64 MiB'); return; }
    try { importedPack = await file.text(); $('#pack').value = '已载入文件：'+file.name+'（正文不在输入框展开）'; status('已读取建议包，点击开始审阅'); } catch (_) { status('无法读取文件'); }
    event.target.value = '';
  });
  $('#pack').addEventListener('input',()=>{importedPack=null;});
  $('.resume').addEventListener('click',async()=>{
    if(!persistent){status('恢复进度需要 Chrome 扩展');return}
    try{const session=await chrome.runtime.sendMessage({type:'session'});if(!session.ok)throw new Error(session.error);if(!session.pack)throw new Error('当前项目没有保存的建议包');importedPack=session.pack;$('#pack').value='已恢复 '+(session.pack.count ?? session.pack.suggestions.length)+' 项建议';start()}catch(error){status(error.message)}
  });
  $('.reset').addEventListener('click',async()=>{
    if(running||starting)return;
    if(persistent){const saved=await chrome.runtime.sendMessage({type:'clearProgress'});if(!saved.ok){status(saved.error);return}}
    sessionActive=false;status('已清除当前项目的审阅进度；正文不变，可重新导入审阅');
  });
  $('.start').addEventListener('click', start);
  $('.stop').addEventListener('click', () => { ++startEpoch; cancelled = true; pendingAbort?.(); call('cancel', {}).catch(() => {}); status('正在停止；已派发的项需核验实际结果。'); });
}
