'use strict';
const Core = require('./suggestions');
function halt(code) { return ['project_changed', 'cancelled', 'write_unconfirmed', 'bridge_failed', 'bridge_timeout'].includes(code); }
async function run(pack, deps) {
  const results = [];
  for (let index = 0; index < pack.suggestions.length; index++) {
    deps.assertCurrent();
    const item = pack.suggestions[index];
    let prepared;
    try { prepared = await deps.call('prepare', { item, projectId: deps.projectId }); }
    catch (_) { throw Object.assign(new Error('连接中断，没有自动重试'), { code: 'bridge_timeout', results }); }
    deps.assertCurrent();
    if (!prepared.ok) {
      const result = { item, state: 'skipped', code: prepared.code };
      results.push(result); deps.record(result);
      if (halt(prepared.code)) throw Object.assign(new Error('审阅已停止'), { code: prepared.code, results });
      continue;
    }
    const decision = await deps.review(item, prepared, { index, total: pack.suggestions.length });
    deps.assertCurrent();
    if (decision.skipped) {
      const result = { item, state: 'skipped', code: decision.skipped };
      results.push(result); deps.record(result);
      if (halt(decision.skipped)) throw Object.assign(new Error('审阅已停止'), { code: decision.skipped, results });
      continue;
    }
    if (decision.accepted !== true) {
      await deps.call('cancel', {});
      const result = { item, state: 'rejected' }; results.push(result); deps.record(result); continue;
    }
    let applied;
    try { applied = await deps.call('apply', { token: decision.token, projectId: deps.projectId }); }
    catch (_) { throw Object.assign(new Error('写入状态未确认，检查当前文件；不要重复接受'), { code: 'write_unconfirmed', results }); }
    const verified = applied.ok === true && applied.verified === true;
    const code = applied.code || (verified ? '' : 'write_unconfirmed');
    const result = { item, state: verified ? 'written' : applied.changedDocument ? 'unknown' : 'skipped', code };
    results.push(result); deps.record(result);
    if (!verified && halt(code)) throw Object.assign(new Error('写入未确认，停止后续项'), { code, results });
  }
  return results;
}
module.exports = { run, halt };
