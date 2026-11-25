const WS=require('ws');const w=new WS(process.argv[2]);let id=0;
const ev=e=>new Promise(r=>{const i=++id;w.on('message',function h(d){const m=JSON.parse(d);if(m.id===i){w.off('message',h);r(m.result)}});w.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:e,awaitPromise:true,returnByValue:true}}))});
w.on('open',async()=>{const r=await ev(`(async()=>{const v=document.getElementById('v');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let f=0;const cb=()=>{f++;v.requestVideoFrameCallback(cb)};v.requestVideoFrameCallback(cb);const t0=performance.now();await sleep(10000);const fps=f/((performance.now()-t0)/1000);
const s=await pc.getStats();let inb={},pair={};s.forEach(x=>{if(x.type==='inbound-rtp'&&x.kind==='video')inb=x;if(x.type==='candidate-pair'&&x.nominated&&x.state==='succeeded')pair=x});
const lc=s.get(pair.localCandidateId)||{},rc=s.get(pair.remoteCandidateId)||{};
return {res:v.videoWidth+'x'+v.videoHeight,fps:+fps.toFixed(1),framesDecoded:inb.framesDecoded,framesDropped:inb.framesDropped,jitter_ms:inb.jitter*1000,iceRtt_ms:pair.currentRoundTripTime*1000,pair:lc.candidateType+'/'+lc.protocol+' -> '+rc.candidateType+'/'+rc.protocol,ua:navigator.userAgent}})()`);
console.log(JSON.stringify(r.result.value));process.exit()});
