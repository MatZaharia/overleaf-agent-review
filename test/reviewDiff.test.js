const test=require('node:test'),assert=require('node:assert/strict');
const Diff=require('../src/reviewDiff'),{characterEdits}=require('../src/characterEdits');
function diff(original,replacement,from=7){const source='prefix '+original,patch={from,to:from+original.length,expected:original,insert:replacement};return Diff.parts(patch,characterEdits(patch,source))}
const text=list=>list.map(p=>p.text).join('');
test('display highlights only actual suffix deletions and keeps both full texts exact',()=>{
 const original='The models predicts outcomes and produces plans.',replacement='The models predict outcomes and produce plans.',d=diff(original,replacement);
 assert.equal(text(d.before),original);assert.equal(text(d.after),replacement);
 assert.deepEqual(d.before.filter(p=>p.kind==='removed').map(p=>p.text),['s','s']);
 assert.deepEqual(d.inline.filter(p=>p.kind==='deletion').map(p=>p.text),['s','s']);
 assert.equal(text(d.inline.filter(p=>p.kind!=='deletion')),replacement);
});
test('replacements and insertions mark only changed characters; Unicode and CRLF remain intact',()=>{
 const original='甲中间😀\r\n\\title{old}',replacement='乙中间😃\n\\title{new!}',d=diff(original,replacement);
 assert.equal(text(d.before),original);assert.equal(text(d.after),'乙中间😃\r\n\\title{new!}');
 assert.equal(d.after.filter(p=>p.kind==='added').map(p=>p.text).join(''),'乙😃new!');
 assert.equal(d.inline.some(p=>p.kind==='deletion'),false);
});
test('whole deletion, leading/trailing insertions and escaping characters are literal display content',()=>{
 assert.deepEqual(diff('all','').after,[]);
 assert.equal(text(diff('all','').inline),'all');
 const d=diff('old','<script>old</script>');assert.equal(text(d.after),'<script>old</script>');assert.equal(text(d.before),'old');
 assert.throws(()=>Diff.parts({from:0,expected:'abc'},[{from:1,to:3,expected:'WRONG',insert:'x'}]),/invalid_display_diff/);
});
