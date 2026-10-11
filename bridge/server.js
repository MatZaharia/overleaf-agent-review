'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const Core=require('../src/suggestions');
function createServer(token) {
 const projects=new Map();
 const state=id=>{if(!projects.has(id))projects.set(id,{revision:0,pack:null,snapshot:null,readRequest:null,results:[]});return projects.get(id)};
 return http.createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  if(!['127.0.0.1:43127','127.0.0.1:0'].includes(req.headers.host)&&!/^127\.0\.0\.1:\d+$/.test(req.headers.host||''))return reply(403,{error:'invalid_host'});
  const actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
  if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return reply(401,{error:'unauthorized'});
  if(req.method==='OPTIONS')return reply(403,{error:'browser_origin_not_allowed'});
  try {
   const url=new URL(req.url,'http://127.0.0.1'),id=url.searchParams.get('projectId');
   if(!/^[a-f\d]{24}$/i.test(id||''))return reply(400,{error:'projectId_required'});
   const project=state(id);
   if(req.method==='GET'&&url.pathname==='/state')return reply(200,{revision:project.revision,snapshot:project.snapshot,results:project.results});
   if(req.method==='GET'&&url.pathname==='/pack')return reply(200,{revision:project.revision,pack:project.pack});
   if(req.method!=='POST'||!['/publish','/sync','/read'].includes(url.pathname))return reply(404,{error:'not_found'});
   const chunks=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>Core.MAX_PACK_BYTES+1024*1024)return reply(413,{error:'request_too_large'});chunks.push(chunk)}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(url.pathname==='/read') {
    if(!project.readRequest || project.readRequest.expiresAt<=Date.now())project.readRequest={id:crypto.randomUUID(),expiresAt:Date.now()+10000};
    return reply(200,{ok:true,requestId:project.readRequest.id});
   }
   if(url.pathname==='/publish') {
    const pack=Core.parsePack(data);
    if(pack.projectId&&pack.projectId!==id)return reply(400,{error:'project_mismatch'});
    pack.projectId=id;project.pack=pack;project.revision++;project.results=[];
    return reply(200,{ok:true,revision:project.revision,count:pack.suggestions.length});
   }
   if(data.snapshot) {
    const s=data.snapshot;
    if(!project.readRequest || project.readRequest.expiresAt<=Date.now() || data.requestId!==project.readRequest.id)return reply(409,{error:'no_pending_read'});
    if(s.projectId!==id||typeof s.source!=='string'||Buffer.byteLength(s.source)>16*1024*1024) return reply(400,{error:'invalid_snapshot'});
    Core.normalizePath(s.file);
    project.snapshot={requestId:data.requestId,projectId:id,file:s.file,source:s.source,hash:crypto.createHash('sha256').update(s.source).digest('hex'),capturedAt:Date.now()};project.readRequest=null;
   }
   if(data.results!==undefined && (!Array.isArray(data.results)||data.results.length>500))return reply(400,{error:'invalid_results'});
   for(const result of data.results||[])if(result.revision===project.revision){project.results.push({id:String(result.id),state:String(result.state),code:String(result.code||''),at:Date.now()});if(project.results.length>10000)project.results.shift()}
   return reply(200,{ok:true,revision:project.revision,snapshotRequest:project.readRequest && project.readRequest.expiresAt>Date.now()?project.readRequest:null});
  } catch(error){return reply(400,{error:error.message})}
 });
}
module.exports={createServer};
