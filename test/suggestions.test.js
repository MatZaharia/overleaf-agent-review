const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/suggestions');
const item = { id: 'one', file: 'main.tex', original: 'old', replacement: 'new' };
test('relocates an exact original after unrelated text and line changes', () => {
 const result = Core.locate('added\nparagraph\nold\nend', item);
 assert.equal(result.ok, true); assert.equal(result.line, 3); assert.equal(result.patch.from, 16);
});
test('changed original is skipped; no fuzzy replacement', () => { assert.equal(Core.locate('oLd', item).code, 'original_missing'); });
test('an already-applied item is skipped on import', () => { assert.equal(Core.locate('new', item).code, 'already_applied'); });
test('same original appearing twice is skipped', () => { assert.equal(Core.locate('old old', item).code, 'ambiguous_match'); });
test('immediate context disambiguates and must remain unchanged', () => {
 const scoped = { ...item, before: 'A ', after: ' Z' };
 assert.equal(Core.locate('B old Q\nA old Z', scoped).patch.from, 10);
 assert.equal(Core.locate('A old changed', scoped).code, 'original_missing');
});
test('section range locates repeated text only within its exact markers', () => {
 const scoped = { ...item, scope: { start: '\\section{B}', end: '\\section{C}' } };
 const text = '\\section{A}\nold\n\\section{B}\nold\n\\section{C}\nold';
 const result = Core.locate(text, scoped);
 assert.equal(result.ok, true); assert.equal(result.patch.from, text.indexOf('old', text.indexOf('\\section{B}')));
 assert.equal(Core.locate('\\section{Changed}\nold', scoped).code, 'scope_missing');
 assert.equal(Core.locate('\\section{B}\nold\n\\section{B}\nold', scoped).code, 'ambiguous_scope');
});
test('does not apply an original embedded inside an already-applied expansion', () => {
 assert.equal(Core.locate('old expanded', { ...item, replacement: 'old expanded' }).code, 'already_applied');
 const result = Core.locate('old expanded\nold', { ...item, replacement: 'old expanded' });
 assert.equal(result.patch.from, 13);
});
test('CRLF/LF and UTF-16 emoji ranges map to exact source offsets', () => {
 const text = 'line\r\n😀 old\r\nend';
 const result = Core.locate(text, { ...item, original: '😀 old\nend', replacement: '😀 new\nend' });
 assert.equal(result.patch.from, 6); assert.equal(result.patch.to, text.length);
 assert.equal(result.patch.expected, '😀 old\r\nend');
});
test('deletion uses a nonempty exact original and empty replacement', () => {
 const result = Core.locate('old tail', { ...item, replacement: '' }); assert.equal(result.ok, true); assert.equal(result.patch.insert, '');
 assert.throws(() => Core.locate('', { ...item, original: '' }));
});
test('pack rejects arbitrary paths, invalid field types and duplicate IDs before review', () => {
 const make = suggestions => ({ format: 'codex-overleaf-suggestions', version: 1, suggestions });
 for (const file of ['/main.tex', '../main.tex', 'sub/../main.tex', 'C:/main.tex', 'image.png', 'sub\\main.tex']) assert.throws(() => Core.parsePack(make([{ ...item, file }])));
 assert.throws(() => Core.parsePack(make([{ ...item, replacement: null }])));
 assert.throws(() => Core.parsePack(make([item, item])));
 assert.equal(Core.parsePack(JSON.stringify(make([item]))).suggestions[0].replacement, 'new');
});
test('whitespace is not silently rewritten while locating', () => {
 assert.equal(Core.locate('old  words', { ...item, original: 'old words' }).code, 'original_missing');
});
