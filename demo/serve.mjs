import http from 'node:http';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../work/demo.html', import.meta.url));
http.createServer((req,res)=>{
 if(req.url==='/project/0123456789abcdef01234567'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);}else{res.writeHead(404);res.end();}
}).listen(Number(process.env.PORT || 9041),'127.0.0.1',()=>console.log('Demo: http://127.0.0.1:'+ (process.env.PORT || 9041) +'/project/0123456789abcdef01234567'));
