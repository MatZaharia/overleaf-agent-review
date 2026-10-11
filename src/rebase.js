'use strict';
const Core = require('./suggestions');
const { characterEdits } = require('./characterEdits');
// Only our own verified edits may update later anchors. Any external change
// invalidates this ledger; exact live matching remains the fallback.
function resolve(text, item, ledger) {
  if (!ledger || ledger.current !== text) return Core.locate(text, item);
  const base = Core.locate(ledger.base, item);
  if (!base.ok) return Core.locate(text, item);
  const requested = characterEdits(base.patch, ledger.base);
  if (!requested) return {ok:false,code:'diff_too_complex'};
  const map = position => position + ledger.edits.filter(p => p.to <= position).reduce((n,p)=>n+p.insert.length-(p.to-p.from),0);
  const remaining = [];
  for (const p of requested) {
    const touches = ledger.edits.filter(q => (p.from < q.to && q.from < p.to) || (p.from===p.to && q.from<=p.from && p.from<=q.to) || (q.from===q.to && p.from<=q.from && q.from<=p.to));
    if (touches.length) {
      if (touches.length===1 && touches[0].from===p.from && touches[0].to===p.to && touches[0].insert===p.insert) continue;
      return {ok:false,code:'overlapping_change'};
    }
    remaining.push(p);
  }
  if (!remaining.length) return {ok:false,code:'already_applied'};
  const from=map(base.patch.from), to=map(base.patch.to);
  const changes=remaining.map(p=>({...p,from:map(p.from),to:map(p.to)}));
  let insert=text.slice(from,to);
  for(const p of [...changes].reverse()) insert=insert.slice(0,p.from-from)+p.insert+insert.slice(p.to-from);
  return {ok:true,line:text.slice(0,from).split('\n').length,patch:{from,to,expected:text.slice(from,to),insert},baselineChanges:remaining};
}
module.exports={resolve};
