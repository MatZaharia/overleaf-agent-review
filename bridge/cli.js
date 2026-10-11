#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('./server');
const args=process.argv.slice(2),command=args.shift();
const flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1]};
const configPath=path.resolve(flag('config','work/bridge.json'));
(async()=>{
 if(command==='start'){
  await fs.mkdir(path.dirname(configPath),{recursive:true});
  let config;try{config=JSON.parse(await fs.readFile(configPath,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error;config={token:crypto.randomBytes(32).toString('hex')};await fs.writeFile(configPath,JSON.stringify(config,null,2),{mode:0o600})}
  const server=createServer(config.token);server.listen(43127,'127.0.0.1',()=>console.log('Bridge running on 127.0.0.1:43127. Pairing token is in '+configPath));return;
 }
 const config=JSON.parse(await fs.readFile(configPath,'utf8')),projectId=flag('project');
 if(!/^[a-f\d]{24}$/i.test(projectId||''))throw new Error('--project requires an Overleaf project ID');
 const request=async(endpoint,body)=>{const r=await fetch('http://127.0.0.1:43127/'+endpoint+'?projectId='+projectId,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error);return data};
 if(command==='publish'){const pack=JSON.parse(await fs.readFile(flag('file'),'utf8'));console.log(JSON.stringify(await request('publish',pack)));return}
 if(command==='status'){const data=await request('state');delete data.snapshot?.source;console.log(JSON.stringify(data,null,2));return}
 if(command==='read'){
  const data=await request('state'),snapshot=data.snapshot;
  if(!snapshot)throw new Error('No snapshot: connect the extension in the target project first');
  const maxAge=Number(flag('max-age','10'))*1000;
  if(!Number.isFinite(maxAge)||maxAge<0||Date.now()-snapshot.capturedAt>maxAge)throw new Error('Snapshot is stale; keep the connected project tab open');
  if(flag('file')&&snapshot.file!==flag('file'))throw new Error('Different file active: open '+flag('file')+' in Overleaf');
  const output=flag('output');if(output){await fs.writeFile(output,snapshot.source);console.log(JSON.stringify({...snapshot,source:undefined,output:path.resolve(output)}))}else process.stdout.write(snapshot.source);return;
 }
 throw new Error('Commands: start | publish --project ID --file pack.json | read --project ID [--file main.tex] [--output file.tex] | status --project ID');
})().catch(error=>{console.error(error.message);process.exitCode=1});
