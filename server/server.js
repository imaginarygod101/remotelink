// RemoteLink signaling server: short-lived session codes, host approval relay, tokens, rate limiting.
'use strict';
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 8443;
const HOST = process.env.HOST || '0.0.0.0';
// When running behind a TLS-terminating proxy/tunnel (Cloudflare, nginx, Caddy), trust its client-IP headers.
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const STATIC_DIR = process.env.STATIC_DIR ? require('path').resolve(process.env.STATIC_DIR) : null;
const HEARTBEAT_MS = 25_000; // keeps idle WebSockets alive through proxies that drop idle connections
const CODE_TTL_MS = +process.env.CODE_TTL_MS || 10 * 60 * 1000;
const MAX_MSG = 64 * 1024;
const RATE = { windowMs: 10_000, max: 60 };      // per-connection messages
const JOIN_FAILS = { windowMs: 60_000, max: 5 }; // per-IP bad code attempts
const ICE = JSON.parse(process.env.ICE_SERVERS || '[{"urls":"stun:stun.l.google.com:19302"}]');

const sessions = new Map(); // code -> {host, viewer, token, expires, approved}
const ipFails = new Map();

const newCode = () => { let c; do { c = String(crypto.randomInt(0, 1e9)).padStart(9, '0'); } while (sessions.has(c)); return c; };
const send = (ws, m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));

function tooManyFails(ip) {
  const now = Date.now(); const a = (ipFails.get(ip) || []).filter(t => now - t < JOIN_FAILS.windowMs);
  ipFails.set(ip, a); return a.length >= JOIN_FAILS.max;
}

function endSession(code, reason) {
  const s = sessions.get(code); if (!s) return;
  send(s.host, { type: 'ended', reason }); send(s.viewer, { type: 'ended', reason });
  if (s.host) s.host.code = null; if (s.viewer) s.viewer.code = null;
  sessions.delete(code);
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const h = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (h) return String(h).slice(0, 64);
  }
  const a = req.socket.remoteAddress;
  // Behind a tunnel that doesn't pass the client address, don't show the host a misleading loopback IP.
  if (TRUST_PROXY && /^(::ffff:)?127\.|^::1$/.test(a || '')) return 'unknown (via tunnel)';
  return a;
}

function create(server) {
  const wss = new WebSocketServer({ server, maxPayload: MAX_MSG });
  wss.on('connection', (ws, req) => {
    const ip = clientIp(req); ws.msgs = []; ws.alive = true; ws.on('pong', () => { ws.alive = true; });
    ws.on('message', raw => {
      const now = Date.now(); ws.msgs = ws.msgs.filter(t => now - t < RATE.windowMs); ws.msgs.push(now);
      if (ws.msgs.length > RATE.max) { send(ws, { type: 'error', error: 'rate_limited' }); return ws.close(1008); }
      let m; try { m = JSON.parse(raw); } catch { return send(ws, { type: 'error', error: 'bad_json' }); }
      const s = ws.code && sessions.get(ws.code);
      switch (m.type) {
        case 'host': {
          if (ws.code) endSession(ws.code, 'rehost');
          const code = newCode(); ws.role = 'host'; ws.code = code;
          sessions.set(code, { host: ws, viewer: null, token: null, approved: false, expires: Date.now() + CODE_TTL_MS, name: String(m.name || 'Host').slice(0, 64) });
          return send(ws, { type: 'hosted', code, expiresInMs: CODE_TTL_MS, iceServers: ICE });
        }
        case 'join': {
          if (tooManyFails(ip)) return send(ws, { type: 'error', error: 'too_many_attempts' });
          const t = sessions.get(String(m.code || ''));
          if (!t || t.expires < Date.now() || t.viewer) {
            ipFails.get(ip).push(Date.now()); return send(ws, { type: 'error', error: 'invalid_code' });
          }
          t.viewer = ws; ws.role = 'viewer'; ws.code = String(m.code);
          send(ws, { type: 'waiting_approval', iceServers: ICE });
          return send(t.host, { type: 'consent_request', viewerName: String(m.name || 'Viewer').slice(0, 64), viewerIp: ip });
        }
        case 'consent': {
          if (!s || ws.role !== 'host' || !s.viewer) return;
          if (!m.approve) { send(s.viewer, { type: 'error', error: 'denied' }); s.viewer.code = null; s.viewer = null; return; }
          s.approved = true; s.token = crypto.randomBytes(24).toString('base64url');
          s.allowInput = !!m.allowInput;
          send(s.host, { type: 'approved', token: s.token, allowInput: s.allowInput });
          return send(s.viewer, { type: 'approved', token: s.token, allowInput: s.allowInput });
        }
        case 'signal': {
          if (!s || !s.approved || m.token !== s.token) return send(ws, { type: 'error', error: 'unauthorized' });
          return send(ws.role === 'host' ? s.viewer : s.host, { type: 'signal', data: m.data });
        }
        case 'end': return s && endSession(ws.code, `${ws.role}_ended`);
        default: return send(ws, { type: 'error', error: 'unknown_type' });
      }
    });
    ws.on('close', () => ws.code && endSession(ws.code, `${ws.role}_disconnected`));
  });
  setInterval(() => { for (const [c, s] of sessions) if (!s.approved && s.expires < Date.now()) endSession(c, 'expired'); }, 30_000).unref();
  setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, HEARTBEAT_MS).unref();
  return wss;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.AppImage': 'application/octet-stream', '.deb': 'application/vnd.debian.binary-package',
  '.zip': 'application/zip', '.exe': 'application/vnd.microsoft.portable-executable', '.apk': 'application/vnd.android.package-archive' };

// Minimal static file server for the RemoteLink download page (optional, STATIC_DIR).
function httpHandler(q, r) {
  const sec = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' };
  let url; try { url = decodeURIComponent(new URL(q.url, 'http://x').pathname); } catch { r.writeHead(400, sec); return r.end(); }
  if (url === '/healthz') { r.writeHead(200, { ...sec, 'content-type': 'application/json' }); return r.end(JSON.stringify({ ok: true, service: 'RemoteLink signaling', sessions: sessions.size })); }
  if (!STATIC_DIR || (q.method !== 'GET' && q.method !== 'HEAD')) { r.writeHead(200, { ...sec, 'content-type': 'text/plain' }); return r.end('RemoteLink signaling server\n'); }
  const path = require('path'), fs = require('fs');
  let f = path.resolve(STATIC_DIR, '.' + (url.endsWith('/') ? url + 'index.html' : url));
  if (!f.startsWith(STATIC_DIR + path.sep) && f !== STATIC_DIR) { r.writeHead(403, sec); return r.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { r.writeHead(404, { ...sec, 'content-type': 'text/plain' }); return r.end('Not found\n'); }
    const ext = path.extname(f), isDl = f.includes(path.sep + 'downloads' + path.sep);
    const h = { ...sec, 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-cache' };
    if (isDl) h['content-disposition'] = `attachment; filename="${path.basename(f)}"`;
    if (ext === '.html') h['content-security-policy'] = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws:";
    h['accept-ranges'] = 'bytes';
    // Range support: lets the download page fetch large builds in chunks (some tunnels cap response size).
    const m = /^bytes=(\d*)-(\d*)$/.exec(q.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? +m[1] : st.size - +m[2], end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (start < 0) start = 0;
      if (start > end || start >= st.size) { r.writeHead(416, { ...sec, 'content-range': `bytes */${st.size}` }); return r.end(); }
      r.writeHead(206, { ...h, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${st.size}` });
      if (q.method === 'HEAD') return r.end(); return fs.createReadStream(f, { start, end }).pipe(r);
    }
    r.writeHead(200, h); if (q.method === 'HEAD') return r.end(); fs.createReadStream(f).pipe(r);
  });
}

if (require.main === module) {
  const server = http.createServer(httpHandler);
  create(server);
  server.listen(PORT, HOST, () => console.log(`RemoteLink signaling on ${HOST}:${PORT}${TRUST_PROXY ? ' (trusting proxy headers)' : ''}${STATIC_DIR ? ' static=' + STATIC_DIR : ''}`));
}
module.exports = { create };
