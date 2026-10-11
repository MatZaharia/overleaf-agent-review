'use strict';
const Core = require('./suggestions');
function halt(code) { return ['project_changed', 'cancelled', 'write_unconfirmed', 'bridge_failed', 'bridge_timeout'].includes(code); }
async function run(pack, deps) {
  const results = [];
  const compact=result=>({...result,item:{id:result.item.id,file:result.item.file,reviewKey:result.item.reviewKey}});
  const total=pack.count ?? pack.suggestions.length;
  for (let index = 0; index < total; index++) {
    deps.assertCurrent();
    const item = deps.itemAt ? await deps.itemAt(index) : pack.suggestions[index];
    const retained=deps.decisions?.[item.reviewKey];
    if(retained?.state==='unknown')throw Object.assign(new Error('先核对上次未确认的写入'),{code:'write_unconfirmed',results});
    if(retained && ['written','rejected'].includes(retained.state)){results.push(compact({item,state:'retained',previous:retained.state}));await deps.retained?.({item,state:retained.state});if(index%100===0)await new Promise(resolve=>setTimeout(resolve,0));continue}
    let prepared;
    try { prepared = await deps.call('prepare', { item, projectId: deps.projectId }); }
    catch (_) { throw Object.assign(new Error('连接中断，没有自动重试'), { code: 'bridge_timeout', results }); }
    deps.assertCurrent();
    if (!prepared.ok) {
      const result = { item, state: 'skipped', code: prepared.code };
      results.push(compact(result)); await deps.record(result);
      if (halt(prepared.code)) throw Object.assign(new Error('审阅已停止'), { code: prepared.code, results });
      continue;
    }
    const decision = await deps.review(item, prepared, { index, total });
    deps.assertCurrent();
    if (decision.skipped) {
      const result = { item, state: 'skipped', code: decision.skipped };
      results.push(compact(result)); await deps.record(result);
      if (halt(decision.skipped)) throw Object.assign(new Error('审阅已停止'), { code: decision.skipped, results });
      continue;
    }
    if (decision.accepted !== true) {
      await deps.call('cancel', {});
      const result = { item, state: 'rejected' }; results.push(compact(result)); await deps.record(result); continue;
    }
    let applied;
    try { applied = await deps.call('apply', { token: decision.token, projectId: deps.projectId }); }
    catch (_) { throw Object.assign(new Error('写入状态未确认，检查当前文件；不要重复接受'), { code: 'write_unconfirmed', results }); }
    const verified = applied.ok === true && applied.verified === true;
    const code = applied.code || (verified ? '' : 'write_unconfirmed');
    const result = { item, state: verified ? 'written' : applied.changedDocument ? 'unknown' : 'skipped', code };
    results.push(compact(result)); await deps.record(result);
    if (!verified && halt(code)) throw Object.assign(new Error('写入未确认，停止后续项'), { code, results });
  }
  return results;
}
module.exports = { run, halt };
