const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const I18n=require('../src/i18n');
test('both languages cover all visible static panel labels, guards and parser errors',()=>{
 const Core=require('../src/suggestions');
 for(const text of Object.values(Core.skipped))assert.doesNotMatch(I18n.translate(text,'en'),/[\u3400-\u9fff]/);
 for(const file of ['src/suggestions.js','src/catalog.js','src/background.js']){
  const source=fs.readFileSync(file,'utf8');
  for(const [,text] of source.matchAll(/new Error\('([^']+)'\)/g))if(/[\u3400-\u9fff]/.test(text))assert.doesNotMatch(I18n.translate(text,'en'),/[\u3400-\u9fff]/,text);
 }
 const source=fs.readFileSync('src/content.js','utf8'),html=source.slice(source.indexOf('</style>'),source.indexOf('document.body.append'));
 for(const [,text] of html.matchAll(/>([^<>]*[\u3400-\u9fff][^<>]*)</g))if(text!=='中文')assert.doesNotMatch(I18n.translate(text,'en'),/[\u3400-\u9fff]/,text);
 assert.equal(I18n.normalize('en'),'en');assert.equal(I18n.normalize('invalid'),'zh-CN');
});
test('dynamic labels preserve identifiers and filenames, with no rewriting of unknown content',()=>{
 assert.equal(I18n.translate('修改 arbitrary-id · L127','en'),'Change arbitrary-id · L127');
 assert.equal(I18n.translate('main.tex · 修改 one：已经应用，跳过','en'),'main.tex · Change one: Already applied; skipped');
 assert.equal(I18n.translate('Agent 建议版本 3，共 2551 项','en'),'Agent pack revision 3, 2551 items');
 assert.equal(I18n.translate('审阅结束：写入 1 项，拒绝 2 项，跳过 3 项，保留先前决定 4 项。','en'),'Review complete: 1 written, 2 rejected, 3 skipped, 4 previous decisions retained.');
 assert.equal(I18n.translate('User supplied 私人内容','en'),'User supplied 私人内容');
 const labels=I18n.previewLabels({id:'one'},3,'en');assert.equal(labels.previous,'Previous item');assert.equal(labels.next,'Next item');assert.equal(labels.accept,'Accept this item');
});
test('review screen and pending position translate without changing numbers',()=>{
 assert.equal(I18n.translate('建议 2 / 2','en'),'Suggestion 2 / 2');
 for(const label of ['逐项审阅','← 返回导入','继续审阅','最近处理记录'])assert.doesNotMatch(I18n.translate(label,'en'),/[\u3400-\u9fff]/);
});
