'use strict';
const $ = id => document.getElementById(id);
let ws, pc, dc, token, role, cfg, stream;
const status = t => { $('status').textContent = t; rl.log('STATUS ' + t); };
const send = m => ws.send(JSON.stringify(m));
const signal = data => send({ type: 'signal', token, data });

function endLocal(reason) {
  if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  if (pc) pc.close(); pc = null; dc = null; token = null;
  $('banner').style.display = 'none'; $('modal').style.display = 'none';
  rl.state({ active: false, inputAllowed: false }); status('Session ended: ' + reason);
}
$('endBtn').onclick = () => { send({ type: 'end' }); endLocal('ended by you'); };

function connect(onOpen) {
  status('Connecting to ' + cfg.server + ' …');
  ws = new WebSocket(cfg.server);
  ws.onopen = onOpen;
  ws.onerror = () => status('Could not reach the RemoteLink server at ' + cfg.server + '. Check Settings.');
  ws.onclose = () => { if (token) endLocal('connection to server lost'); };
  ws.onmessage = async e => {
    const m = JSON.parse(e.data);
    if (m.type === 'hosted') { $('code').textContent = m.code; if (cfg.e2e) rl.log('CODE=' + m.code); /* dev-test builds only: never log the code otherwise */ status('Share this code. Nobody can connect without your approval.'); cfg.ice = m.iceServers; }
    else if (m.type === 'waiting_approval') { cfg.ice = m.iceServers; status('Waiting for the host to approve…'); }
    else if (m.type === 'consent_request') {
      $('allowInput').checked = false; // control is opt-in for every request, never carried over from a previous session
      $('reqName').textContent = m.viewerName; $('reqIp').textContent = m.viewerIp; $('modal').style.display = 'block';
      if (cfg.e2e) setTimeout(() => { $('allowInput').checked = true; $('approve').click(); }, 500); // dev-only test hook
    }
    else if (m.type === 'approved') { token = m.token; m.allowInput = !!m.allowInput; role === 'host' ? startHost(m.allowInput) : startViewer(); }
    else if (m.type === 'signal') onSignal(m.data);
    else if (m.type === 'ended') endLocal(m.reason);
    else if (m.type === 'error') status('Error: ' + m.error);
  };
}
function newPc() {
  pc = new RTCPeerConnection({ iceServers: cfg.ice || [] });
  pc.onicecandidate = e => e.candidate && signal({ ice: e.candidate });
  pc.onconnectionstatechange = () => rl.log('PC ' + pc.connectionState);
}
async function onSignal(d) {
  if (d.sdp) { await pc.setRemoteDescription(d.sdp); if (d.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); signal({ sdp: pc.localDescription }); } }
  else if (d.ice) await pc.addIceCandidate(d.ice);
}

// ---------- HOST ----------
$('approve').onclick = () => { $('modal').style.display = 'none'; send({ type: 'consent', approve: true, allowInput: $('allowInput').checked }); };
$('deny').onclick = () => { $('modal').style.display = 'none'; send({ type: 'consent', approve: false }); };
$('hostBtn').onclick = () => { role = 'host'; connect(() => send({ type: 'host', name: 'RemoteLink host' })); };

async function startHost(allowInput) {
  $('who').textContent = 'a RemoteLink viewer'; $('ctl').textContent = allowInput ? ' and CONTROL your mouse/keyboard ' : ' (view only) ';
  $('banner').style.display = 'block'; rl.state({ active: true, inputAllowed: allowInput });
  stream = await navigator.mediaDevices.getDisplayMedia({ audio: false, video: { frameRate: 30 } });
  newPc(); stream.getTracks().forEach(t => pc.addTrack(t, stream));
  dc = pc.createDataChannel('input', { ordered: true });
  dc.onmessage = e => { const ev = JSON.parse(e.data); if (ev.k === 'ping') return dc.send(JSON.stringify({ k: 'pong', t: ev.t })); if (allowInput) rl.input(ev); };
  await pc.setLocalDescription(await pc.createOffer()); signal({ sdp: pc.localDescription });
  status('Session active. Click "End session" at any time.');
}

// ---------- VIEWER ----------
$('joinBtn').onclick = () => { role = 'viewer'; const code = $('codeIn').value.trim(); connect(() => send({ type: 'join', code, name: 'RemoteLink viewer' })); };
let tApproved = 0, tConnected = 0;
function startViewer() {
  tApproved = performance.now(); newPc(); status('Approved. Connecting…');
  pc.ontrack = e => { $('v').srcObject = e.streams[0]; };
  pc.ondatachannel = e => { dc = e.channel; dc.onopen = () => { tConnected = performance.now(); status('Connected'); if (cfg.viewerTest) runViewerTest(); }; dc.onmessage = onDc; };
  const v = $('v'); const norm = e => { const r = v.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  if (cfg.viewerTest) return; // automated test sends synthetic input only (avoids feedback when host+viewer share one display)
  v.onmousemove = e => dc && dc.readyState === 'open' && dc.send(JSON.stringify({ k: 'move', ...norm(e), ts: Date.now() }));
  v.onmousedown = e => dc && dc.send(JSON.stringify({ k: 'click', b: e.button, ...norm(e), ts: Date.now() }));
  window.onkeypress = e => dc && dc.send(JSON.stringify({ k: 'text', text: e.key, ts: Date.now() }));
}
const pongs = [];
function onDc(e) { const m = JSON.parse(e.data); if (m.k === 'pong') pongs.push(performance.now() - m.t); }

async function runViewerTest() {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const v = $('v');
  while (!v.videoWidth) await sleep(100);
  let frames = 0; const cb = () => { frames++; v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb);
  // Drive on-screen motion isn't guaranteed on an idle Xvfb; the host test harness animates a window. Count 10 s.
  const f0 = frames, t0 = performance.now(); await sleep(10000); const fps = (frames - f0) / ((performance.now() - t0) / 1000);
  for (let i = 0; i < 50; i++) { dc.send(JSON.stringify({ k: 'ping', t: performance.now() })); await sleep(50); }
  await sleep(300);
  const s = [...pongs].sort((a, b) => a - b);
  const stats = await pc.getStats(); let inbound = {}; stats.forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'video') inbound = r; });
  let pair = {}; stats.forEach(r => { if (r.type === 'candidate-pair' && r.nominated) pair = r; });
  const lc = stats.get(pair.localCandidateId) || {}, rc = stats.get(pair.remoteCandidateId) || {};
  let srflx = 0; stats.forEach(r => { if (r.type === 'local-candidate' && r.candidateType === 'srflx') srflx++; });
  for (const [x, y] of [[0.25, 0.25], [0.5, 0.5], [0.75, 0.6]]) { dc.send(JSON.stringify({ k: 'move', x, y, ts: Date.now() })); await sleep(400); }
  rl.log('RESULT=' + JSON.stringify({ resolution: `${v.videoWidth}x${v.videoHeight}`, fps: +fps.toFixed(1), rtt_ms: { p50: +s[25].toFixed(2), p95: +s[47].toFixed(2), max: +s[49].toFixed(2) },
    framesDecoded: inbound.framesDecoded, codec: inbound.decoderImplementation, iceRtt_ms: pair.currentRoundTripTime * 1000,
    pair: `${lc.candidateType}/${lc.protocol} -> ${rc.candidateType}/${rc.protocol}`, stunSrflxCandidates: srflx, approvedToConnected_ms: Math.round(tConnected - tApproved) }));
  await sleep(1500); send({ type: 'end' }); endLocal('test complete');
}

// ---------- SETTINGS ----------
$('saveSrv').onclick = async () => { const r = await rl.saveServer($('srvIn').value); if (!r.ok) return status('Settings: ' + r.error); cfg.server = r.server; $('srvIn').value = r.server; status('Server saved: ' + r.server); };
$('resetSrv').onclick = async () => { const r = await rl.saveServer(''); cfg.server = r.server; $('srvIn').value = r.server; status('Server reset to default: ' + r.server); };
rl.config().then(c => { cfg = c; $('srvIn').value = c.server; $('ver').textContent = 'v' + c.version; if (c.role === 'host') $('hostBtn').click(); if (c.role === 'viewer') { $('codeIn').value = c.code; $('joinBtn').click(); } });
// Dev-only: in E2E mode the host animates a counter so the captured screen changes every frame (idle screens send few frames).
rl.config().then(c => { if (c.e2e && c.role === 'host') { const d = document.createElement('div'); d.style.cssText = 'font-size:40px'; document.body.appendChild(d); const f = () => { d.textContent = 'E2E frame ' + performance.now().toFixed(0); requestAnimationFrame(f); }; f(); } });
