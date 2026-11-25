// Measures WebSocket round-trip time to a RemoteLink signaling URL (sends 30 unknown-type messages; server replies with an error frame).
const WS = require('ws'); const url = process.argv[2]; const t0 = Date.now(); const w = new WS(url); const rtts = [];
w.on('open', async () => { const open = Date.now() - t0;
  for (let i = 0; i < 30; i++) { const s = process.hrtime.bigint(); await new Promise(r => { w.once('message', r); w.send('{"type":"rtt-probe"}'); }); rtts.push(Number(process.hrtime.bigint() - s) / 1e6); await new Promise(r => setTimeout(r, 200)); }
  rtts.sort((a, b) => a - b); console.log(JSON.stringify({ url, connect_ms: open, rtt_ms: { min: +rtts[0].toFixed(1), p50: +rtts[15].toFixed(1), p95: +rtts[28].toFixed(1), max: +rtts[29].toFixed(1) } })); process.exit(); });
w.on('error', e => { console.log('error', e.message); process.exit(1); });
