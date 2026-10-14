'use strict';
const Core = require('./suggestions');
const Runner = require('./runner');
const Navigation = require('./navigation');
const SuggestionSearch = require('./suggestionSearch');
const Floating = require('./floatingPanel');
const I18n = require('./i18n');
const Diff = require('./reviewDiff');
const Keyboard = require('./reviewKeyboard');
const Scroll = require('./reviewScroll');
const ExtensionRuntime = require('./extensionRuntime');
const PageModal = require('./pageModal');
const PanelStyles = require('./panelStyles');
const BulkAcceptance = require('./bulkAcceptance');
if (!document.querySelector('[data-suggestion-importer]')) mount();
function mount() {
  const host = document.createElement('div'); host.dataset.suggestionImporter = '';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483100;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${PanelStyles.css}${Floating.css}${Keyboard.css}${Diff.css}</style>
<section class="drawer" data-screen="setup" hidden>
 <div class="head"><strong>审阅管理</strong><div class="session-toolbar" hidden><button class="compact">精简 ↙</button><button class="back">管理</button><button class="continue" hidden>继续审阅</button><button class="stop" hidden>停止</button></div><select class="language" aria-label="语言"><option value="zh-CN">中文</option><option value="en">English</option></select><button class="close" aria-label="收起">×</button></div>
 <div class="body"><div class="setup-view">
  <section class="setup-section"><div class="section-heading"><h2>Agent 连接</h2><span class="bridge-status" role="status">未连接</span></div><div class="connection-row"><input class="bridge-token" aria-label="本地连接配对令牌" type="password" placeholder="本地连接配对令牌" autocomplete="off"><button class="connect">连接</button><button class="disconnect" hidden>断开</button></div></section>
  <section class="setup-section"><div class="section-heading"><h2>建议包</h2></div><div class="setup-message message" role="status" aria-live="polite">等待导入建议包</div><p class="shared-summary muted" hidden></p><label class="label" for="review-scope">审阅范围</label><select id="review-scope"><option value="current">当前文件（多标签页）</option><option value="all">全部文件（单标签页）</option></select><div class="setup-actions"><button class="primary start">开始审阅</button><button class="resume">恢复上次审阅</button></div></section>
  <details class="json-import"><summary>用 JSON 导入</summary><p class="muted">粘贴建议包，或选择 JSON 文件；导入后点击开始审阅。</p><label class="label" for="pack">建议包 JSON</label><textarea id="pack" spellcheck="false" placeholder="粘贴 Agent 生成的建议包"></textarea><input type="file" accept=".json,application/json" hidden><div class="toolbar"><button class="file">选择 JSON 文件</button></div></details>
  <details class="history-details"><summary>最近处理记录</summary><div class="history-list"></div></details><button class="reset text-button">清除进度</button><p class="footer">逐项确认后写入，可在 Overleaf 撤销。</p>
 </div><div class="review-view" hidden><div class="message review-message" role="status" aria-live="polite">等待导入建议包</div><button class="repair" hidden>重新建立定位（保留决定）</button><div class="pending"></div></div></div>
 <button class="resize" aria-label="拖动右下角调整大小；方向键微调" title="拖动右下角调整大小；方向键微调"></button>
</section><button class="launch">导入修改建议</button><dialog class="bulk-confirm" aria-labelledby="bulk-title"><h2 id="bulk-title">全部接受剩余建议？</h2><p class="bulk-summary"></p><p class="muted">每项仍会核对最新原文；过时或不唯一的建议会跳过。执行中可以点击停止。</p><div class="dialog-actions"><button class="bulk-cancel" autofocus>取消</button><button class="primary bulk-confirm-accept">确认全部接受</button></div></dialog>`;
  document.body.append(host);
  PageModal.watch({document,window,onChange:blocked=>{host.hidden=blocked}});
  const $ = selector => shadow.querySelector(selector);
  const capability = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const persistent=typeof chrome!=='undefined' && !!chrome.runtime?.id;
  let contextLost=false, trackingFile=null, stopReason=null, reviewMode='compact',presentCurrent=null, fullContext=false, searchQuery='';
  const extension=ExtensionRuntime.create(()=>typeof chrome==='undefined'?null:chrome,onContextInvalidated);
  const runtime={check:extension.check,storage:extension.storage,message:body=>extension.message({...body,clientId:capability})};
  let reviewLease=null,reviewFile='',lastRenew=0,sharedSummary=null,pendingBridgeStart=false;
  function showShared(value){if(value)sharedSummary=value;if(!sharedSummary)return;for(const node of shadow.querySelectorAll('.shared-summary')){node.hidden=false;setUI(node,'项目已确认 '+sharedSummary.confirmed+' / '+sharedSummary.total)}}
  async function renew(force=false){
    if(!persistent||!reviewLease)return null;
    if(!force&&Date.now()-lastRenew<5000)return null;
    const response=await runtime.message({type:'reviewRenew',lease:reviewLease});
    if(!response.ok)throw Object.assign(new Error(response.error),{code:response.code||'review_lease_lost'});
    lastRenew=Date.now();showShared(response.summary);return response;
  }
  if(persistent)chrome.runtime.onMessage.addListener((event,sender)=>{
    if(sender.id!==chrome.runtime.id||event.type!=='reviewShared'||event.clientId!==capability||event.projectId!==location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1])return;
    showShared(event.summary);
  });
  let language='zh-CN', languageTouched=false, packLabel=null, reviewLanguageRefresh=null;
  function setPackLabel(text){packLabel=text;$('#pack').value=t(text);}
  const uiText=new Map(),uiAttributes=new Map();
  const t=text=>I18n.translate(text,language);
  function setUI(node,text){uiText.set(node,text);node.textContent=t(text);}
  function rememberUI(root){
    for(const [node] of uiText)if(!node.isConnected)uiText.delete(node);
    const walk=node=>{if(node.nodeType===3 && /[\u3400-\u9fff]/.test(node.textContent))setUI(node,node.textContent);else for(const child of node.childNodes)walk(child)};
    walk(root);
    for(const node of root.querySelectorAll('[placeholder],[aria-label],[title]')){
      const attributes={};for(const name of ['placeholder','aria-label','title'])if(node.hasAttribute(name))attributes[name]=node.getAttribute(name);
      uiAttributes.set(node,attributes);
    }
    refreshUI();
  }
  function refreshUI(){
    for(const [node,text] of uiText){if(node.isConnected)node.textContent=t(text);else uiText.delete(node)}
    for(const [node,attributes] of uiAttributes){if(!node.isConnected){uiAttributes.delete(node);continue}for(const [name,text] of Object.entries(attributes))node.setAttribute(name,t(text))}
    shadow.host.lang=language;if(packLabel)$('#pack').value=t(packLabel);
  }
  rememberUI(shadow);
  $('.head').setAttribute('aria-label','拖动标题移动面板；方向键微调');$('.head').title='拖动标题移动面板；方向键微调';
  uiAttributes.set($('.head'),{'aria-label':$('.head').getAttribute('aria-label'),title:$('.head').title});
  const floating=Floating.attach({panel:$('.drawer'),drag:$('.head'),resize:$('.resize'),window,minimum:{width:300,height:220},defaultRect:()=>({left:window.innerWidth-406,top:Math.max(16,window.innerHeight-Math.min(600,window.innerHeight*.85)-60),width:390,height:Math.min(600,window.innerHeight*.85)})});
  floating.layout();
  const batch=BulkAcceptance.create();
  let cancelBulkConfirmation=null;
  let screen='setup';
  function showScreen(next){
    const changed=screen!==next;screen=next;$('.drawer').dataset.screen=screen;$('.setup-view').hidden=screen!=='setup';$('.review-view').hidden=screen!=='review';
    $('.session-toolbar').hidden=screen==='setup'&&!running;$('.back').hidden=screen!=='review';$('.compact').hidden=screen!=='review'||!running||batch.active;$('.continue').hidden=screen!=='setup'||!running||batch.active;$('.back').hidden=screen!=='review'||batch.active;
    setUI($('.head strong'),screen==='review'?'建议详情':'审阅管理');if(changed)$('.body').scrollTop=0;
    if(presentCurrent&&screen==='setup')presentCurrent('setup').catch(error=>status(error.message));
  }
  let startEpoch = 0, sessionActive=false, reconcileReview=null, decisionUpdates=[];
  let bridgeRevision=0, bridgeEnabled=false, bridgeBusy=false, bridgeResults=[];
  let importedPack = null, initialized = null, running = false, starting = false, owner = '', cancelled = false, pendingAbort = null;
  function send(method, params) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const handler = event => {
        if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'codex-suggestions:response'
          || event.data.id !== id || event.data.capability !== capability) return;
        cleanup(); resolve(event.data.result);
      };
      const timer = setTimeout(() => { cleanup(); reject(Object.assign(new Error(t('页面连接超时')), { code: 'bridge_timeout' })); }, method === 'prepare' ? 25000 : 8000);
      function cleanup() { clearTimeout(timer); window.removeEventListener('message', handler); }
      window.addEventListener('message', handler);
      window.postMessage({ channel: 'codex-suggestions:request', id, capability, method, params }, location.origin);
    });
  }
  async function call(method, params) {
    if(persistent&&method!=='cancel'){runtime.check();if(sessionActive){const ready=await renew(method==='apply');if(method==='apply')params={...params,notAfter:ready?.notAfter};}if(method==='apply'){const ready=await runtime.message({type:'ping'});if(!ready?.ok)throw new Error('无法连接扩展');runtime.check()}}
    if (!initialized) initialized = send('hello', {});
    const handshake = await initialized;
    if (!handshake.ok) throw new Error('无法连接页面');
    if(persistent&&method!=='cancel')runtime.check();
    const result=await send(method, params);
    if(persistent && sessionActive && result.journal?.length){const saved=await runtime.message({type:'progress',journal:result.journal,lease:reviewLease});if(!saved.ok)throw Object.assign(new Error('保存定位记录失败：'+saved.error),{code:saved.code||'review_lease_lost'});showShared(saved.summary)}
    const updates=(result.journal||[]).flatMap(entry=>entry.decisions||[]);
    if(updates.length){if(reconcileReview)reconcileReview(updates);else decisionUpdates.push(...updates)}
    return result;
  }
  const assertCurrent = () => {
    const current = location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1];
    if (cancelled || current !== owner) throw Object.assign(new Error('已停止'), { code: cancelled ? 'cancelled' : 'project_changed' });
  };
  const status = text => {const value=contextLost?ExtensionRuntime.message:text;$('.review-message').hidden=!contextLost&&['原文已在源码中高亮，等待确认','正文有变化，已重新定位这一项，等待确认','当前项已写入编辑器，继续核对下一项','正在准备审阅…'].includes(value);setUI($('.setup-message'),value);setUI($('.review-message'),value)};
  function lockInvalidContext(){
    $('.drawer').hidden=false;floating.layout();
    shadow.querySelectorAll('.setup-view button,.pending button,.stop,.continue,.compact,.language,.repair').forEach(node=>{node.disabled=true});
    $('#pack').disabled=true;status(ExtensionRuntime.message);setUI($('.bridge-status'),ExtensionRuntime.message);
  }
  function onContextInvalidated(){
    cancelBulkConfirmation?.();batch.stop();contextLost=true;++startEpoch;cancelled=true;bridgeEnabled=false;sessionActive=false;
    pendingAbort?.();
    if(initialized)send('cancel',{}).catch(()=>{});
    lockInvalidContext();
  }
  async function changeLanguage(value){language=I18n.normalize(value);$('.language').value=language;refreshUI();reviewLanguageRefresh?.();await call('language',{language}).catch(()=>{});}
  $('.language').addEventListener('change',()=>{languageTouched=true;changeLanguage($('.language').value);if(persistent)runtime.storage('set',{reviewLanguage:language}).catch(error=>status(error.message));});
  if(persistent)runtime.storage('get','reviewLanguage').then(saved=>{if(!languageTouched)changeLanguage(saved.reviewLanguage || 'zh-CN')}).catch(()=>{});
  function review(item, prepared, options, itemAt, catalogId, searchIndex) {
    return new Promise((resolve, reject) => {
      let token = prepared.token, settled = false, timer = null, navigating=false,staleCode=null,statusRequest=null,suspended=Boolean(prepared.suspended);
      async function check(){
        if(statusRequest)return statusRequest;
        statusRequest=call('status',{token,projectId:owner});
        try{return await statusRequest}finally{statusRequest=null}
      }
      const card = document.createElement('section'); card.className = 'card';card.setAttribute('aria-label','建议详情');
      card.innerHTML = `<div class="review-content"><div class="suggestion-meta"><strong></strong><p class="shared-summary muted" hidden></p></div><div class="path"></div><div class="comparison-label">修改理由</div><p class="reason"></p><div class="perspective" role="group" aria-label="对比视角"><button class="perspective-button concise">简洁对比</button><button class="perspective-button full">完整上下文</button></div><pre class="source combined"></pre><div class="context" hidden><div class="context-panes"><section class="code-pane"><div class="pane-heading">原文 · 标出删除</div><pre class="source old"></pre></section><section class="code-pane"><div class="pane-heading">修改后 · 标出新增</div><pre class="source new"></pre></section></div></div></div><div class="search-bar"><span class="search-icon" aria-hidden="true">⌕</span><input id="suggestion-search" class="suggestion-search" type="search" placeholder="搜索原文或修改后" aria-label="搜索建议" spellcheck="false"><span class="search-status" role="status" aria-live="polite"></span><button class="search-previous search-navigation" aria-label="上一个搜索项" title="上一个搜索项" disabled>↑</button><button class="search-next search-navigation" aria-label="下一个搜索项" title="下一个搜索项" disabled>↓</button></div><div class="review-footer"><div class="footer-controls"><div class="navigation"><div class="nav-group"><button class="previous">上一项</button><button class="next">下一项</button></div><div class="nav-group cursor-group"><button class="cursor-previous">光标上一处</button><button class="cursor-next">光标下一处</button></div></div><div class="actions"><button class="bulk">全部接受</button><button class="reject">拒绝</button><button class="primary accept">接受 ↵</button></div></div></div>`;
      $('.pending').replaceChildren(card);
      rememberUI(card);showShared();
      const searchInput=card.querySelector('.suggestion-search'),searchStatus=card.querySelector('.search-status');
      const searchButtons=[card.querySelector('.search-previous'),card.querySelector('.search-next')];
      let searchTimer=null,searchEpoch=0,searchMatches=null,searchError=null;
      searchInput.value=searchQuery;
      function renderSearch(){
        if(settled)return;
        const matches=SuggestionSearch.pending(searchMatches||[],options.isPending);
        const canNavigate=matches.some(index=>index!==options.index);
        searchButtons.forEach(button=>{button.disabled=navigating||!canNavigate});
        const label=!searchQuery?'搜索原文或修改后':searchError?'搜索失败，请重新输入':searchMatches===null?'正在搜索建议…':matches.length?'搜索结果 '+(matches.indexOf(options.index)+1)+' / '+matches.length:'没有匹配的待处理建议';
        const count=searchQuery&&searchMatches!==null&&!searchError?(matches.indexOf(options.index)+1)+' / '+matches.length:'0 / 0';
        searchStatus.textContent=count;searchStatus.setAttribute('aria-label',t(label));searchStatus.title=t(label);
        searchStatus.classList.toggle('search-error',Boolean(searchError));
      }
      async function findSuggestions(){
        const own=++searchEpoch,query=searchQuery;searchMatches=null;searchError=null;renderSearch();
        try{const matches=await searchIndex.search(query);if(settled||own!==searchEpoch||query!==searchQuery||matches===null)return;searchMatches=matches;renderSearch()}
        catch(error){if(!settled&&own===searchEpoch){searchError=error;renderSearch()}}
      }
      searchInput.addEventListener('input',()=>{searchQuery=searchInput.value;searchEpoch++;searchMatches=null;searchError=null;clearTimeout(searchTimer);renderSearch();searchTimer=setTimeout(findSuggestions,250)});
      async function navigateSearch(direction){
        if(settled||navigating||searchMatches===null)return;
        const matches=SuggestionSearch.pending(searchMatches,options.isPending),target=SuggestionSearch.adjacent(matches,options.index,direction);
        if(target===null||target===options.index)return;
        await navigate(direction,false,target);
      }
      searchButtons[0].addEventListener('click',()=>navigateSearch(-1));searchButtons[1].addEventListener('click',()=>navigateSearch(1));
      searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&!event.repeat&&!event.ctrlKey&&!event.altKey&&!event.metaKey){event.preventDefault();event.stopPropagation();navigateSearch(event.shiftKey?-1:1)}});
      findSuggestions();
      const context=card.querySelector('.context'),comparison=card.querySelector('.combined');
      const conciseButton=card.querySelector('.concise'),fullButton=card.querySelector('.full');
      function contextPerspective(){if(!card.isConnected)return;context.hidden=!fullContext;comparison.hidden=fullContext;conciseButton.setAttribute('aria-pressed',String(!fullContext));fullButton.setAttribute('aria-pressed',String(fullContext))}
      contextPerspective();
      conciseButton.addEventListener('click',()=>{fullContext=false;contextPerspective()});fullButton.addEventListener('click',()=>{fullContext=true;contextPerspective()});
      const locate=document.createElement('button');locate.className='locate';locate.hidden=!suspended;setUI(locate,'定位当前项');card.querySelector('.navigation').prepend(locate);
      locate.addEventListener('click',()=>{if(!settled&&!navigating){assertCurrent();finish(undefined,undefined,options.index)}});
      const renderCount=()=>{const node=card.querySelector('strong'),text='建议 '+options.position+' / '+options.remaining;if(node.textContent!==t(text))setUI(node,text)};renderCount();
      card.querySelector('.path').textContent = item.file + ' · L' + prepared.line+' · #'+((item.sourceIndex??options.index)+1);
      card.querySelector('.reason').textContent = item.reason;
      let displayed=prepared, lastPresentation=null;
      function renderDiff(){
        const labels={added:t('新增'),removed:t('删除'),replaced:t('替换原文'),empty:t('（删除此段）')};
        if(displayed.diff){Diff.render(card.querySelector('.combined'),Diff.compact(displayed.diff.combined||displayed.diff.inline,80),labels);Diff.render(card.querySelector('.old'),displayed.diff.before,labels);Diff.render(card.querySelector('.new'),displayed.diff.after,labels)}
        else {card.querySelector('.combined').textContent=displayed.item?.replacement ?? item.replacement;card.querySelector('.old').textContent=displayed.item?.original || item.original;card.querySelector('.new').textContent=displayed.item?.replacement ?? item.replacement}
      }
      renderDiff();
      const help=document.createElement('p');help.className='muted keyboard-help';setUI(help,'↑ 上一项 · ↓ 下一项 · Enter 接受（审阅卡片内）');card.querySelector('.review-footer').append(help);
      const refresh=()=>{renderDiff();renderSearch();card.setAttribute('aria-label',t('建议详情'))};reviewLanguageRefresh=refresh;
      status(prepared.inline ? '原文已在源码中高亮，等待确认' : '高亮暂不可用，请在此核对原文与建议');
      async function present(mode,focus=false){
        if(settled)return;
        if(mode!== 'setup'){const current=await check();if(settled)return;update(current)}
        if(mode!=='setup'){reviewMode=mode==='compact'&&displayed.inline&&!staleCode?'compact':'details';mode=reviewMode;showScreen('review')}
        const state={mode,position:options.position,remaining:options.remaining};
        const response=await call('presentation',{...state,token,projectId:owner,focus});
        if(settled)return;
        if(!response.ok){lastPresentation=null;return}
        lastPresentation=JSON.stringify({...state,token});
        $('.drawer').hidden=mode==='compact';
        if(mode==='details'){floating.layout();if(focus)card.focus({preventScroll:true})}
        $('.compact').disabled=suspended||!displayed.inline||Boolean(staleCode);
        setUI($('.launch'),mode==='compact'?'详情 ↗':'导入修改建议');
      }
      presentCurrent=present;
      function finish(accepted, skipped, navigate) {
        if (settled) return;
        cancelBulkConfirmation?.();settled = true; clearTimeout(timer); clearTimeout(searchTimer); pendingAbort = null;if(presentCurrent===present)presentCurrent=null;if(reviewLanguageRefresh===refresh)reviewLanguageRefresh=null;
        card.querySelectorAll('button').forEach(button => { button.disabled = true; });
        resolve({ accepted, skipped, token, navigate });
      }
      async function navigate(direction,fromCursor,searchTarget){
        if(settled||navigating)return;
        navigating=true;clearTimeout(timer);card.querySelectorAll('button').forEach(button=>{button.disabled=true});
        try{
          assertCurrent();
          // Sync undo before selecting a target, including clicks that occur
          // before the next status poll. This does not reveal or focus source.
          const current=await check();
          if(settled)return;
          if(!current.ok&&!['original_missing','already_applied','ambiguous_match','scope_missing','ambiguous_scope','overlapping_change','position_mismatch','no_change','diff_too_complex'].includes(current.code)){finish(false,current.code);return}
          update(current);let target;
          if(searchTarget!==undefined){target=options.isPending(searchTarget)?searchTarget:null}
          else if(!fromCursor){
            const checked=new Set([options.index]);target=options.index;
            do{
              target=Navigation.adjacent(target,options.total,direction,index=>options.isPending(index)&&!checked.has(index));
              if(target===null)break;
              checked.add(target);
            }while(options.isDecided(await itemAt(target)));
          }
          else{
            status('正在按当前光标查找建议…');
            const excludedIndexes=[];for(let i=0;i<options.total;i++)if(!options.isPending(i))excludedIndexes.push(i);
            const scan=await call('navigation',{projectId:owner,catalogId,direction,currentIndex:options.index,excludedIndexes});
            if(!scan.ok)throw new Error(scan.code);
            let best=null;
            for(let index=0;!scan.cached && index<options.total;){
              if(settled)return;assertCurrent();
              const items=[];let bytes=0;
              while(index<options.total && items.length<128){const position=index++;if(!options.isPending(position))continue;const candidate=await itemAt(position);if(candidate.file===scan.file && !options.isDecided(candidate)){items.push({index:position,item:candidate});bytes+=JSON.stringify(candidate).length;if(bytes>=131072)break}}
              let offset=0;
              while(offset<items.length){
                if(settled)return;assertCurrent();
                const response=await call('navigation',{projectId:owner,scanId:scan.scanId,items:items.slice(offset)});
                if(!response.ok)throw new Error(response.code);
                offset+=response.processed;
                const candidates=best?[best,...response.matches]:response.matches;
                const nearest=Navigation.nearest(candidates,scan.cursor,direction,options.index);
                best=candidates.find(match=>match.index===nearest) || null;
                // Each RPC crosses a window message task boundary; matching is time-bounded in the page service.
              }
            }
            // Recheck file, source and cursor after the final batch.
            const check=await call('navigation',{projectId:owner,scanId:scan.scanId,items:[],complete:!scan.cached});
            if(!check.ok)throw new Error(check.code);
            target=scan.cached?scan.target:best?.index ?? null;
          }
          if(settled)return;
          if(target!==null){finish(undefined,staleCode,target);return}
          status(fromCursor?'当前文件的光标这一侧没有可定位的待处理建议':'没有其他待处理建议；当前项仍等待确认');
        }catch(error){if(!settled)status(error.message==='review_file_mismatch'?'本页只审阅开始时的文件；请定位当前项，或停止后在新文件开始审阅':error.message==='navigation_changed'?'正文、文件或光标有变化，请重新点击导航':'导航未完成：'+error.message)}
        finally{navigating=false;if(!settled){card.querySelectorAll('button').forEach(button=>{button.disabled=Boolean((suspended||staleCode) && button.classList.contains('accept'))});renderSearch();timer=setTimeout(poll,300)}}
      }
      card.querySelector('.previous').addEventListener('click',()=>navigate(-1,false));
      card.querySelector('.next').addEventListener('click',()=>navigate(1,false));
      card.querySelector('.cursor-previous').addEventListener('click',()=>navigate(-1,true));
      card.querySelector('.cursor-next').addEventListener('click',()=>navigate(1,true));
      async function accept(){
        if(settled||navigating)return;
        try{const response=await check();if(settled||navigating)return;update(response);if(response.ok&&!suspended)finish(true)}
        catch(error){if(!settled)finish(false,error.code||'bridge_failed')}
      }
      async function acceptRemaining(){
        if(settled||navigating||cancelBulkConfirmation)return;
        const indexes=BulkAcceptance.plan(options.total,options.isPending),scope=reviewFile||t('全部文件（单标签页）');
        setUI($('.bulk-summary'),'将接受 '+indexes.length+' 项剩余建议。');
        const file=document.createElement('span');file.className='bulk-scope';file.textContent=scope;$('.bulk-summary').append(document.createElement('br'),file);
        const confirmed=await confirmBulk();
        if(!confirmed||settled||navigating)return;
        navigating=true;clearTimeout(timer);card.querySelectorAll('button').forEach(button=>button.disabled=true);let rechecked=displayed;
        try{
          assertCurrent();const response=await check();rechecked=response;if(settled)return;update(response);
          if(!response.ok||response.suspended)return;
          // Remove the old interactive preview before using this approval.
          const hidden=await call('presentation',{token,projectId:owner,mode:'setup'});
          if(settled)return;if(!hidden.ok)throw new Error('无法连接页面');
          assertCurrent();batch.start(indexes,options.index);$('.drawer').hidden=false;showScreen('review');floating.layout();
          status('正在全部接受：已处理 0 / '+batch.total+' 项');finish(true);
        }catch(error){if(!settled)status(error.message)}
        finally{navigating=false;if(!settled){card.querySelectorAll('button').forEach(button=>button.disabled=false);update(rechecked);renderSearch();timer=setTimeout(poll,300)}}
      }
      card.querySelector('.bulk').addEventListener('click',acceptRemaining);
      card.querySelector('.accept').addEventListener('click',accept);
      card.querySelector('.reject').addEventListener('click', () => finish(false,staleCode));
      Keyboard.attach(card,choice=>{if(settled || navigating)return;if(choice==='accept'){if(!staleCode&&!suspended)accept()}else navigate(choice==='previous'?-1:1,false)});
      if(reviewMode==='details')Scroll.panel($('.body'),card);
      pendingAbort = () => { if (!settled) { cancelBulkConfirmation?.();settled = true; clearTimeout(timer);clearTimeout(searchTimer);if(presentCurrent===present)presentCurrent=null; reject(Object.assign(new Error('已停止'), { code: 'cancelled' })); } };
      function update(response){
        renderCount();renderSearch();
        suspended=response.suspended===true;locate.hidden=!suspended;
        card.querySelector('.accept').disabled=suspended||Boolean(!response.ok);card.querySelector('.bulk').disabled=suspended||Boolean(!response.ok);
        $('.compact').disabled=suspended||!displayed.inline||Boolean(staleCode);
        if(suspended){status('已切换文件，当前建议与进度保留。可自由编辑，点击定位当前项或审阅导航继续。');return}
        if(response.refreshed){displayed=response;renderDiff();token=response.token;staleCode=null;card.querySelector('.accept').disabled=false;card.querySelector('.path').textContent=item.file+' · L'+response.line+' · #'+((item.sourceIndex??options.index)+1);status('正文有变化，已重新定位这一项，等待确认')}
        else if(!response.ok)staleCode=response.code;
      }
      async function poll() {
        if (settled) return;
        try {
          assertCurrent();
          const response = await check();
          if (settled || navigating) return;
          update(response);
          if(response.suspended){timer=setTimeout(poll,300);return;}
          if (!response.ok) {
            if(['original_missing','already_applied','ambiguous_match','scope_missing','ambiguous_scope','overlapping_change','position_mismatch','no_change','diff_too_complex'].includes(response.code)){
              staleCode=response.code;card.querySelector('.accept').disabled=true;card.querySelector('.bulk').disabled=true;await present('details');status('当前原文已变化，此项已失效；可继续编辑，点击导航后跳过');timer=setTimeout(poll,300);return;
            }
            finish(false,response.code);return;
          }
          const displayMode=screen==='setup'?'setup':reviewMode;
          const signature=JSON.stringify({mode:displayMode,position:options.position,remaining:options.remaining,token});
          if(response.presentation==='details')await present('details',true);
          else if(signature!==lastPresentation)await present(displayMode);
          if(settled)return;
          if (response.navigation===-1 || response.navigation===1){await navigate(response.navigation,false);return;}
          else if (typeof response.decision === 'boolean') { finish(response.decision); return; }
          timer = setTimeout(poll, 300);
        } catch (error) { finish(false, error.code || 'bridge_failed'); }
      }
      poll();
    });
  }
  let historyMessages=[],historyFrame=null;
  function renderHistory(){if(historyFrame!==null)return;historyFrame=requestAnimationFrame(()=>{historyFrame=null;$('.history-list').replaceChildren(...historyMessages.map(text=>{const row=document.createElement('div');row.className='history';setUI(row,text);return row}));refreshUI()})}
  async function record(result) {
    if(persistent && ['written','rejected','unknown'].includes(result.state)){const saved=await runtime.message({type:'progress',lease:reviewLease,decision:{reviewKey:result.item.reviewKey,state:result.state,code:result.code}});if(!saved.ok)throw Object.assign(new Error('保存审阅决定失败：'+saved.error),{code:saved.code||'review_lease_lost'});showShared(saved.summary)}
    if(bridgeRevision) bridgeResults.push({revision:bridgeRevision,id:result.item.id,state:result.state,code:result.code});
    if($('.pending').firstChild)$('.pending').replaceChildren();
    const word = result.state === 'written' ? '已写入' : result.state === 'rejected' ? '已拒绝' : result.state === 'unknown' ? '写入未确认' : Core.skipped[result.code] || '已跳过：' + result.code;
    historyMessages.push(result.item.file + ' · 修改 ' + result.item.id + '：' + word);
    if(historyMessages.length>100)historyMessages.shift();renderHistory();
    if(batch.active){batch.record();status('正在全部接受：已处理 '+batch.processed+' / '+batch.total+' 项')}
    else if (result.state === 'written') status('当前项已写入编辑器，继续核对下一项');
  }
  async function parseInput(input){
    if(!persistent)return Core.parsePack(input);
    let response;
    if(input?.ref)return input;
    if(typeof input==='string'&&input.length>262144){const uploadId=crypto.randomUUID();let index=0;for(let from=0;from<input.length;from+=262144){response=await runtime.message({type:'parseChunk',uploadId,index:index++,chunk:input.slice(from,from+262144),last:from+262144>=input.length});if(!response.ok)throw new Error(response.error)}}
    else response=await runtime.message({type:'parse',input});
    if(!response.ok)throw new Error(response.error);return response.pack;
  }
  async function start() {
    if (contextLost || running || starting) return;
    const epoch = ++startEpoch;
    starting = true; $('.start').disabled = true;trackingFile=null;$('.repair').hidden=true;status('正在准备审阅…');
    let pack, searchIndex, batchCompleted=false, session={decisions:{},ledgers:{}};
    try {
      pack = await parseInput(importedPack || $('#pack').value);
      const current = await call('project', {});
      if (!current.ok || !current.projectId) throw new Error('请先打开 Overleaf 项目');
      if (pack.projectId && pack.projectId !== current.projectId) throw new Error('建议包属于其他项目，没有写入');
      if (epoch !== startEpoch) throw new Error('建议已更新或审阅已停止');
      reviewFile=$('#review-scope').value==='current'?current.file:'';
      if($('#review-scope').value==='current'&&!reviewFile)throw new Error('源码编辑器未就绪');
      if(persistent){session=await runtime.message({type:'session',pack,acquire:true,file:reviewFile});if(!session.ok)throw Object.assign(new Error(session.error),{code:session.code});reviewLease=session.lease;lastRenew=Date.now();showShared(session.summary);pack=session.reviewPack||session.pack}
      else if(reviewFile){pack={...pack,suggestions:pack.suggestions.flatMap((item,index)=>item.file===reviewFile?[{...item,sourceIndex:index}]:[])};if(!pack.suggestions.length)throw new Error('当前文件没有审阅建议，请切换文件或选择全部文件')}
      if(epoch!==startEpoch)throw new Error('建议已更新或审阅已停止');
      owner = current.projectId;sessionActive=true;
    } catch (error) { if(error.code==='review_pack_busy'&&bridgeEnabled)pendingBridgeStart=true;if(reviewLease){await runtime.message({type:'reviewRelease',lease:reviewLease}).catch(()=>{});reviewLease=null}status(error.message); starting = false; $('.start').disabled = contextLost; return; }
    running = true; starting = false; cancelled = false;stopReason=null;pendingBridgeStart=false;
    $('#review-scope').disabled=true;$('.start').disabled = true; $('.resume').disabled=true;$('.reset').disabled=true; $('.file').disabled = true; $('#pack').disabled = true; $('.stop').hidden = false;
    historyMessages=[];$('.history-list').replaceChildren();$('.history-details').open=false;showScreen('review');$('.drawer').hidden=reviewMode==='compact';
    try {
      decisionUpdates=[];await call('begin', {ledgers:session.ledgers,mode:reviewMode,file:reviewFile});
      const catalogId=crypto.randomUUID();
      let itemBuffer=[],bufferStart=-1;
      const itemAt=persistent?async index=>{if(index<bufferStart||index>=bufferStart+itemBuffer.length){const fetched=await runtime.message({type:'items',ref:pack.ref,index});if(!fetched.ok)throw new Error(fetched.error);bufferStart=index;itemBuffer=fetched.items}return itemBuffer[index-bufferStart]}:async index=>pack.suggestions[index];
      searchIndex=SuggestionSearch.create({total:pack.count??pack.suggestions.length,readPage:persistent?async index=>{const fetched=await runtime.message({type:'items',ref:pack.ref,index});if(!fetched.ok)throw new Error(fetched.error);return fetched.items}:async index=>pack.suggestions.slice(index,index+32)});
      const results = await Runner.run(pack, { projectId: owner, assertCurrent, call, presentation:state=>({mode:batch.active?'setup':reviewMode,...state}), observe:fn=>{reconcileReview=fn;if(fn&&decisionUpdates.length){const updates=decisionUpdates;decisionUpdates=[];fn(updates)}}, review:(item,prepared,options)=>{const approval=batch.decision(options.index,prepared);if(approval)return Promise.resolve(approval);showScreen(screen);return review(item,prepared,options,itemAt,catalogId,searchIndex)}, record, initialCounts:session.initialCounts, decidedIndexes:session.decidedIndexes, decisionIndexes:session.decisionIndexes, decisions:session.decisions, itemAt, retained:result=>{if(bridgeRevision)bridgeResults.push({revision:bridgeRevision,id:result.item.id,state:result.state,code:'retained_decision'})} });
      batchCompleted=batch.active;const count = state => results.filter(result => result.state === state).length;
      $('.drawer').hidden=false;floating.layout();status('审阅结束：写入 ' + count('written') + ' 项，拒绝 ' + count('rejected') + ' 项，跳过 ' + count('skipped') + ' 项，保留先前决定 ' + count('retained') + ' 项。');
    } catch (error) {
      $('.drawer').hidden=false;floating.layout();
      if(error.code==='tracking_out_of_sync'){trackingFile=error.file;$('.repair').hidden=false;status('定位记录与当前正文不一致，审阅已暂停。可重新建立定位，保留接受／拒绝决定。')}
      else if(error.code==='review_file_mismatch')status('文件已切换，全部接受已停止；剩余建议保留');
      else if(error.code==='review_lease_lost')status('标签页审阅权限已失效，请重新开始审阅');
      else if(error.code==='cancelled')status(stopReason==='update'?'正在载入新版本建议…':'审阅已停止，可重新开始或恢复上次审阅');
      else status(error.code === 'write_unconfirmed' ? '写入结果未确认，已停止。请检查当前正文，不要重复接受。' : '审阅已停止：' + (error.code || error.message));
    } finally {
      cancelBulkConfirmation?.();batch.stop();searchIndex?.cancel();pendingAbort?.(); pendingAbort = null;
      await call('cancel', {}).catch(() => {});
      sessionActive=false;if(reviewLease){await runtime.message({type:'reviewRelease',lease:reviewLease}).catch(()=>{});reviewLease=null}
      $('#review-scope').disabled=false;
      $('.pending').replaceChildren();reviewLanguageRefresh=null;presentCurrent=null; running = false;setUI($('.launch'),'导入修改建议');
      $('.start').disabled = false;$('.resume').disabled=false;$('.reset').disabled=false; $('.file').disabled = false; $('#pack').disabled = false; $('.stop').hidden = true;showScreen(stopReason==='user'||batchCompleted?'setup':screen);if(contextLost)lockInvalidContext();
    }
  }

  function confirmBulk(){
    const dialog=$('.bulk-confirm');
    return new Promise(resolve=>{
      function finish(value){dialog.close();dialog.removeEventListener('cancel',cancel);$('.bulk-cancel').removeEventListener('click',cancel);$('.bulk-confirm-accept').removeEventListener('click',accept);cancelBulkConfirmation=null;resolve(value)}
      function cancel(event){event?.preventDefault();finish(false)}function accept(){finish(true)}
      cancelBulkConfirmation=cancel;dialog.addEventListener('cancel',cancel);$('.bulk-cancel').addEventListener('click',cancel);$('.bulk-confirm-accept').addEventListener('click',accept);dialog.showModal();
    });
  }
  const bridgeMessage=message=>runtime.message(message);
  $('.connect').addEventListener('click',async()=>{
    if(!persistent){status('本地连接需要在 Chrome 扩展中使用');return;}
    const result=await bridgeMessage({type:'connect',token:$('.bridge-token').value}).catch(e=>({error:e.message}));
    if(!result.ok){setUI($('.bridge-status'),result.error);return;}
    $('.bridge-token').value=''; bridgeEnabled=true;$('.connect').hidden=true;$('.disconnect').hidden=false; setUI($('.bridge-status'),'已连接：Agent 请求时才读取源码；新建议等待逐项确认'); pollBridge();
  });
  $('.disconnect').addEventListener('click',async()=>{bridgeEnabled=false;$('.connect').hidden=false;$('.disconnect').hidden=true;try{if(persistent)await bridgeMessage({type:'disconnect'});setUI($('.bridge-status'),'已断开本地连接')}catch(error){status(error.message)}});
  async function pollBridge(){
    if(!bridgeEnabled||bridgeBusy)return;bridgeBusy=true;
    try {
      const batch=bridgeResults.slice(0,500);
      const result=await bridgeMessage({type:'sync',revision:bridgeRevision,results:batch});
      if(!bridgeEnabled)return;
      if(result.ok)bridgeResults.splice(0,batch.length);
      if(result.disconnected){bridgeEnabled=false;$('.connect').hidden=false;$('.disconnect').hidden=true;setUI($('.bridge-status'),'已断开本地连接');return;}
      if(!result.ok)throw new Error(result.error);
      if(result.snapshotRequest && document.visibilityState==='visible'){
        const snapshot=await call('snapshot',{});
        if(!snapshot.ok)throw new Error('源码编辑器未就绪');
        if(!bridgeEnabled)return;
        const uploaded=await bridgeMessage({type:'sync',snapshot,requestId:result.snapshotRequest.id,revision:bridgeRevision,results:[]});
        if(!uploaded.ok)throw new Error(uploaded.error);
      }
      if(result.pack && result.revision!==bridgeRevision){
        // Invalidate the old preview before showing an updated pack. Never
        // retain an acceptance button across a producer revision change.
        ++startEpoch; stopReason='update';cancelled=true; pendingAbort?.(); await call('cancel',{});
        while(running||starting)await new Promise(r=>setTimeout(r,30));
        if(!bridgeEnabled)return;
        bridgeRevision=result.revision; bridgeResults=[]; importedPack=result.pack;
        setPackLabel('Agent 建议版本 '+bridgeRevision+'，共 '+(result.pack.count ?? result.pack.suggestions.length)+' 项');
        $('.drawer').hidden=false; floating.layout(); start();
      }
      if(pendingBridgeStart&&!running&&!starting){pendingBridgeStart=false;start();}
      setUI($('.bridge-status'),'已连接 · 源码按需读取 · 建议版本 '+bridgeRevision);
    }catch(error){setUI($('.bridge-status'),contextLost?ExtensionRuntime.message:'本地连接暂不可用：'+error.message);}
    finally{bridgeBusy=false;if(bridgeEnabled)setTimeout(pollBridge,2000);}
  }

  $('.back').addEventListener('click',()=>showScreen('setup'));
  $('.compact').addEventListener('click',()=>presentCurrent?.('compact',true).catch(error=>status(error.message)));
  $('.continue').addEventListener('click',()=>presentCurrent?.(reviewMode,true).catch(error=>status(error.message)));
  $('.launch').addEventListener('click', () => {if(running&&presentCurrent){presentCurrent('details',true).catch(error=>status(error.message));return} $('.drawer').hidden = !$('.drawer').hidden;floating.layout(); });
  $('.close').addEventListener('click', () => {if(running&&presentCurrent&&screen==='review'){presentCurrent('compact',true).catch(error=>status(error.message));return} $('.drawer').hidden = true; });
  $('.file').addEventListener('click', () => $('input[type=file]').click());
  $('input[type=file]').addEventListener('change', async event => {
    const input = event.currentTarget;const file = input.files?.[0]; if (!file) return;
    if (file.size > Core.MAX_PACK_BYTES) { status('建议包不能超过 64 MiB'); return; }
    try { importedPack = await file.text(); setPackLabel('已载入文件：'+file.name+'（正文不在输入框展开）'); status('已读取建议包，点击开始审阅'); } catch (_) { status('无法读取文件'); }
    input.value = '';
  });
  $('#pack').addEventListener('input',()=>{importedPack=null;packLabel=null;});
  $('.resume').addEventListener('click',async()=>{
    if(!persistent){status('恢复进度需要 Chrome 扩展');return}
    try{const session=await runtime.message({type:'session'});if(!session.ok)throw new Error(session.error);if(!session.pack)throw new Error('当前项目没有保存的建议包');importedPack=session.pack;setPackLabel('已恢复 '+(session.pack.count ?? session.pack.suggestions.length)+' 项建议');start()}catch(error){status(error.message)}
  });
  $('.repair').addEventListener('click',async()=>{
    if(contextLost||running||starting||!trackingFile)return;
    const file=trackingFile;$('.repair').disabled=true;
    try{
      if(persistent){const saved=await runtime.message({type:'clearTracking',file,projectId:owner});if(!saved.ok)throw new Error(saved.error)}
      await start();
    }catch(error){status(error.message)}finally{$('.repair').disabled=contextLost}
  });
  $('.reset').addEventListener('click',async()=>{
    if(running||starting)return;
    try{if(persistent){const saved=await runtime.message({type:'clearProgress'});if(!saved.ok){status(saved.error);return}}}catch(error){status(error.message);return}
    sessionActive=false;sharedSummary=null;shadow.querySelectorAll('.shared-summary').forEach(node=>{node.hidden=true});$('.history-list').replaceChildren();status('已清除当前项目的审阅进度；正文不变，可重新导入审阅');
  });
  $('.start').addEventListener('click', start);
  $('.stop').addEventListener('click', () => { cancelBulkConfirmation?.();batch.stop();++startEpoch; stopReason='user';pendingBridgeStart=false;cancelled = true; pendingAbort?.(); call('cancel', {}).catch(() => {}); showScreen('setup');$('.drawer').hidden=false;floating.layout();status('正在停止；已派发的项需核验实际结果。'); });
}
