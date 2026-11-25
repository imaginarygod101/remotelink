const http=require('http'),{create}=require('./server'),WS=require('ws'),assert=require('assert');
const srv=http.createServer();create(srv);
const open=p=>new Promise(r=>{const w=new WS('ws://127.0.0.1:'+p);w.q=[];w.on('message',d=>{const m=JSON.parse(d);(w.w?w.w(m):w.q.push(m))});w.on('open',()=>r(w))});
const next=w=>new Promise(r=>{if(w.q.length)return r(w.q.shift());w.w=m=>{w.w=null;r(m)}});
srv.listen(0,async()=>{const p=srv.address().port;
 const h=await open(p),v=await open(p),bad=await open(p);
 h.send(JSON.stringify({type:'host'}));const {code}=await next(h);assert.match(code,/^\d{9}$/);
 bad.send(JSON.stringify({type:'join',code:'000000000'}));assert.equal((await next(bad)).error,'invalid_code');
 v.send(JSON.stringify({type:'signal',data:1}));assert.equal((await next(v)).error,'unauthorized');
 v.send(JSON.stringify({type:'join',code}));assert.equal((await next(v)).type,'waiting_approval');
 assert.equal((await next(h)).type,'consent_request');
 v.send(JSON.stringify({type:'signal',data:1,token:'x'}));assert.equal((await next(v)).error,'unauthorized');
 h.send(JSON.stringify({type:'consent',approve:true,allowInput:true}));const a=await next(h);await next(v);
 v.send(JSON.stringify({type:'signal',data:42,token:a.token}));assert.equal((await next(h)).data,42);
 for(let i=0;i<5;i++){bad.send(JSON.stringify({type:'join',code:'1'}));await next(bad);}
 bad.send(JSON.stringify({type:'join',code}));assert.equal((await next(bad)).error,'too_many_attempts');
 h.send(JSON.stringify({type:'end'}));assert.equal((await next(v)).type,'ended');
 console.log('server tests: 9 assertions passed');process.exit(0);});
