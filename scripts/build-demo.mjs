import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
await mkdir('work', {recursive:true});
await build({entryPoints:['demo/editor.js'],bundle:true,format:'iife',outfile:'work/editor.bundle.js'});
let html = await readFile('demo/template.html','utf8');
for (const [marker,file] of [['FIXTURE','work/editor.bundle.js'],['MAIN','main.bundle.js'],['CONTENT','content.bundle.js']]) {
 html = html.replace('__'+marker+'__', (await readFile(file,'utf8')).replaceAll('</script','<\\/script'));
}
await writeFile('work/demo.html',html);
