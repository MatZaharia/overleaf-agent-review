const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {promisify}=require('node:util'),exec=promisify(require('node:child_process').execFile),{createServer}=require('../bridge/server');
test('Codex CLI publishes packs, exports current source and refuses stale or wrong-file snapshots',async t=>{
 const token='d'.repeat(64),id='0123456789abcdef01234567',dir=await fs.mkdtemp(path.join(os.tmpdir(),'overleaf-bridge-test-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const config=path.join(dir,'config.json');await fs.writeFile(config,JSON.stringify({token}),{mode:0o600});
 const server=createServer(token);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(43127,'127.0.0.1',resolve)});t.after(()=>new Promise(r=>server.close(r)));
 const cli=(...args)=>exec(process.execPath,[path.resolve('bridge/cli.js'),...args,'--config',config,'--project',id]);
 const packPath=path.join(dir,'pack.json');await fs.writeFile(packPath,JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions:[{file:'main.tex',original:'old',replacement:'new'}]}));
 assert.equal(JSON.parse((await cli('publish','--file',packPath)).stdout).revision,1);
 const source='\\title{实时正文}\n😀';let captures=0;
 const timer=setInterval(async()=>{
  const headers={Authorization:'Bearer '+token};
  const pending=await(await fetch('http://127.0.0.1:43127/sync?projectId='+id,{method:'POST',headers,body:'{}'})).json();
  if(pending.snapshotRequest){captures++;await fetch('http://127.0.0.1:43127/sync?projectId='+id,{method:'POST',headers,body:JSON.stringify({requestId:pending.snapshotRequest.id,snapshot:{projectId:id,file:'main.tex',source}})})}
 },50);t.after(()=>clearInterval(timer));
 assert.equal((await cli('read','--file','main.tex')).stdout,source);
 assert.equal(captures,1);
 await assert.rejects(cli('read','--file','other.tex'),/Different file active/);
 await assert.rejects(cli('read','--max-age','0'),/stale/);
 assert.equal(JSON.parse((await cli('status')).stdout).snapshot.source,undefined);
});
