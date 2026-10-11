const test=require('node:test'),assert=require('node:assert/strict');
const Counts=require('../src/reviewCounts');
test('restored counts use current pack keys and ignore orphaned or changed suggestions',()=>{
 const counts=Counts.retained({suggestions:[{reviewKey:'valid-written'},{reviewKey:'valid-rejected'},{reviewKey:'changed'},{reviewKey:'unknown'}]},{'valid-written':{state:'written'},'valid-rejected':{state:'rejected'},orphaned:{state:'written'},old:{state:'written'},unknown:{state:'unknown'}});
 assert.deepEqual(counts,{written:1,rejected:1,skipped:0,unknown:0,retained:2});assert.equal(Counts.completed(counts),2);
});
