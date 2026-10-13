'use strict';
const Counts = require('./reviewCounts');
function halt(code) { return ['project_changed', 'cancelled', 'write_unconfirmed', 'bridge_failed', 'bridge_timeout', 'tracking_out_of_sync'].includes(code); }
async function run(pack, deps) {
  const results = new Map(), settled = new Set();
  const list = () => [...results.entries()].sort((a,b)=>a[0]-b[0]).map(([,result])=>result);
  const restored=deps.initialCounts?{counts:deps.initialCounts,indexes:deps.decidedIndexes || []}:Counts.restore(pack,deps.decisions);
  const counts={...restored.counts},finished=new Set(restored.indexes);
  const indexes=new Map(Object.entries(deps.decisionIndexes||restored.decisionIndexes||{}));
  const initial=new Set(restored.indexes),states=new Map();
  for(const [key,index] of indexes)states.set(index,deps.decisions?.[key]?.state);
  const notify=()=>deps.progress?.({...counts,total,completed:Counts.completed(counts),pending:total-Counts.completed(counts)});
  const save = (index,result) => {
    results.set(index,compact(result));settled.add(index);finished.add(index);
    if(result.state!=='retained')counts[result.state]++;
    states.set(index,result.state==='retained'?result.previous:result.state);
    notify();
  };
  const compact=result=>({...result,item:{id:result.item.id,file:result.item.file,reviewKey:result.item.reviewKey}});
  const total=pack.count ?? pack.suggestions.length;
  let index=0;notify();
  function reconcile(updates){
    for(const update of updates){
      if(update.state!=='pending')continue;
      const position=indexes.get(update.reviewKey),state=states.get(position)||deps.decisions?.[update.reviewKey]?.state;
      // Rejected suggestions remain a human decision, independent of undo.
      if(state==='rejected'||state==='unknown')continue;
      if(deps.decisions)delete deps.decisions[update.reviewKey];
      if(position===undefined||!finished.has(position))continue;
      finished.delete(position);settled.delete(position);results.delete(position);states.delete(position);
      if(state&&counts[state]>0)counts[state]--;
      if(initial.delete(position))counts.retained--;
    }
    notify();
  }
  deps.observe?.(reconcile);
  try{
  while(settled.size<total){
    if(index>=total){index=0;while(settled.has(index))index++}
    if(settled.has(index)){index++;continue}
    deps.assertCurrent();
    const item = deps.itemAt ? await deps.itemAt(index) : pack.suggestions[index];
    if(item.reviewKey)indexes.set(item.reviewKey,index);
    const retained=deps.decisions?.[item.reviewKey];
    if(retained?.state==='unknown')throw Object.assign(new Error('先核对上次未确认的写入'),{code:'write_unconfirmed',results:list()});
    if(retained && ['written','rejected'].includes(retained.state)){save(index,{item,state:'retained',previous:retained.state});await deps.retained?.({item,state:retained.state});if(index%100===0)await new Promise(resolve=>setTimeout(resolve,0));index++;continue}
    let prepared;
    try { prepared = await deps.call('prepare', { item, projectId: deps.projectId, presentation:deps.presentation?.({index,total,remaining:total-finished.size,position:Counts.position(index,finished)}) }); }
    catch (_) { throw Object.assign(new Error('连接中断，没有自动重试'), { code: 'bridge_timeout', results:list() }); }
    deps.assertCurrent();
    if (!prepared.ok) {
      if(prepared.code==='tracking_out_of_sync')throw Object.assign(new Error('定位记录已失效'),{code:prepared.code,file:item.file,results:list()});
      const result = { item, state: 'skipped', code: prepared.code };
      save(index,result); await deps.record(result);
      if (halt(prepared.code)) throw Object.assign(new Error('审阅已停止'), { code: prepared.code, results:list() });
      index++;continue;
    }
    const decision = await deps.review(item, prepared, { index, total, get remaining(){return total-finished.size}, get position(){return Counts.position(index,finished)}, isPending:i=>!finished.has(i), isDecided:item=>['written','rejected'].includes(deps.decisions?.[item.reviewKey]?.state) });
    deps.assertCurrent();
    if(Number.isInteger(decision.navigate)){
      if(decision.navigate<0||decision.navigate>=total||finished.has(decision.navigate))throw new Error('无效的审阅导航目标');
      if(decision.skipped){const result={item,state:'skipped',code:decision.skipped};save(index,result);await deps.record(result)}
      await deps.call('cancel',{});deps.assertCurrent();index=decision.navigate;continue;
    }
    if (decision.skipped) {
      if(decision.skipped==='tracking_out_of_sync')throw Object.assign(new Error('定位记录已失效'),{code:decision.skipped,file:item.file,results:list()});
      const result = { item, state: 'skipped', code: decision.skipped };
      save(index,result); await deps.record(result);
      if (halt(decision.skipped)) throw Object.assign(new Error('审阅已停止'), { code: decision.skipped, results:list() });
      index++;continue;
    }
    if (decision.accepted !== true) {
      await deps.call('cancel', {});
      const result = { item, state: 'rejected' }; save(index,result); await deps.record(result); index++;continue;
    }
    let applied;
    try { applied = await deps.call('apply', { token: decision.token, projectId: deps.projectId }); }
    catch (_) { throw Object.assign(new Error('写入状态未确认，检查当前文件；不要重复接受'), { code: 'write_unconfirmed', results:list() }); }
    if(applied.code==='tracking_out_of_sync')throw Object.assign(new Error('定位记录已失效'),{code:applied.code,file:item.file,results:list()});
    const verified = applied.ok === true && applied.verified === true;
    const code = applied.code || (verified ? '' : 'write_unconfirmed');
    const result = { item, state: verified ? 'written' : applied.changedDocument ? 'unknown' : 'skipped', code };
    save(index,result); await deps.record(result);
    if (!verified && halt(code)) throw Object.assign(new Error('写入未确认，停止后续项'), { code, results:list() });
    index++;
  }
  return list();
  }finally{deps.observe?.(null)}
}
module.exports = { run, halt };
