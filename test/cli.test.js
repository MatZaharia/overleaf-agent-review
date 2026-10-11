const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {promisify}=require('node:util'),exec=promisify(require('node:child_process').execFile),{createServer}=require('../bridge/server');
test('Agent CLI publishes packs, exports current source and refuses stale or wrong-file snapshots',async t=>{
 const token='d'.repeat(64),id='0123456789abcdef01234567',dir=await fs.mkdtemp(path.join(os.tmpdir(),'overleaf-bridge-test-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const config=path.join(dir,'config.json');await fs.writeFile(config,JSON.stringify({token}),{mode:0o600});
 const server=createServer(token);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(43127,'127.0.0.1',resolve)});t.after(()=>new Promise(r=>server.close(r)));
 const cli=(...args)=>exec(process.execPath,[path.resolve('bridge/cli.js'),...args,'--config',config,'--project',id]);
 const packPath=path.join(dir,'pack.json');await fs.writeFile(packPath,JSON.stringify({format:'codex-overleaf-suggestions',version:1,suggestions:[{file:'main.tex',original:'old',replacement:'new'}]}));
 assert.equal(JSON.parse((await cli('publish','--file',packPath)).stdout).revision,1);
 const source='\\title{实时正文}\n😀';let captures=0;
 let captureBusy=false;
 const timer=setInterval(async()=>{
  if(captureBusy)return;captureBusy=true;
  try{
  const headers={Authorization:'Bearer '+token};
  const pending=await(await fetch('http://127.0.0.1:43127/sync?projectId='+id,{method:'POST',headers,body:'{}'})).json();
  if(pending.snapshotRequest){captures++;await fetch('http://127.0.0.1:43127/sync?projectId='+id,{method:'POST',headers,body:JSON.stringify({requestId:pending.snapshotRequest.id,snapshot:{projectId:id,file:'main.tex',source}})})}
  }finally{captureBusy=false}
 },50);t.after(()=>clearInterval(timer));
 assert.equal((await cli('read','--file','main.tex')).stdout,source);
 assert.equal(captures,1);
 await assert.rejects(cli('read','--file','other.tex'),/Different file active/);
 await assert.rejects(cli('read','--max-age','0'),/stale/);
 assert.equal(JSON.parse((await cli('status')).stdout).snapshot.source,undefined);
});

async function offlinePack(t,pack){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'overleaf-validate-test-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'pack.json');await fs.writeFile(file,JSON.stringify(pack));
 return (...args)=>exec(process.execPath,[path.resolve('bridge/cli.js'),'validate','--file',file,...args],{cwd:dir});
}
const validPack={format:'codex-overleaf-suggestions',version:1,projectId:'0123456789abcdef01234567',suggestions:[{id:'title',file:'main.tex',original:'Old',replacement:'New'}]};
test('offline validation needs no config, bridge, or pairing and keeps legacy packs compatible',async t=>{
 const cli=await offlinePack(t,validPack);
 assert.deepEqual(JSON.parse((await cli('--project',validPack.projectId)).stdout),{ok:true,format:validPack.format,version:1,projectId:validPack.projectId,count:1});
});
test('offline validation rejects duplicate suggestion IDs',async t=>{
 const cli=await offlinePack(t,{...validPack,suggestions:[...validPack.suggestions,...validPack.suggestions]});
 await assert.rejects(cli(),/id 必须唯一/);
});
test('offline validation rejects a pack for another project',async t=>{
 const cli=await offlinePack(t,validPack);
 await assert.rejects(cli('--project','ffffffffffffffffffffffff'),/different project/);
});
