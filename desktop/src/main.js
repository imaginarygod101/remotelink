// RemoteLink desktop client (host + viewer). Transparent, consent-based. No hidden capture, no persistence.
'use strict';
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');
let nut = null; try { nut = require('@nut-tree-fork/nut-js'); nut.mouse.config.autoDelayMs = 0; nut.keyboard.config.autoDelayMs = 0; } catch (e) { console.error('input injection unavailable:', e.message); }

// Dev-only automation hook: simulates the host user clicking "Allow" in E2E tests. Refused in packaged builds.
const E2E = process.env.RL_E2E === '1' && !app.isPackaged;
if (process.env.RL_E2E === '1' && app.isPackaged) console.warn('RL_E2E ignored: test automation is disabled in packaged builds');

// Server URL: user setting (saved locally) > RL_SERVER env > build default (src/defaults.json).
let DEFAULTS = { server: 'ws://127.0.0.1:8443' };
try { DEFAULTS = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(path.join(__dirname, 'defaults.json'), 'utf8')) }; } catch {}
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } }
function validServer(u) {
  try { const x = new URL(u); if (x.protocol === 'wss:') return true;
    return x.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname); } catch { return false; }
}
function currentServer() {
  if (process.env.RL_SERVER && validServer(process.env.RL_SERVER)) return process.env.RL_SERVER;
  const s = loadSettings().server; return s && validServer(s) ? s : DEFAULTS.server;
}
let win, inputAllowed = false, sessionActive = false;

app.whenReady().then(() => {
  win = new BrowserWindow({ width: 900, height: 640, title: 'RemoteLink', icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  // Screen capture is only granted to our own window and only after the host approved a session (see renderer).
  // Screen capture is granted ONLY while the host has approved an active session (sessionActive), never otherwise.
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    if (!sessionActive) return cb({});
    const [src] = await desktopCapturer.getSources({ types: ['screen'] }); cb({ video: src });
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('console-message', e => console.log('[renderer]', e.message));
});
app.on('window-all-closed', () => app.quit());

ipcMain.handle('config', () => ({ server: currentServer(), defaultServer: DEFAULTS.server, version: app.getVersion(), packaged: app.isPackaged,
  role: process.env.RL_ROLE || '', code: process.env.RL_CODE || '', e2e: E2E, viewerTest: E2E && process.env.RL_ROLE === 'viewer' }));
ipcMain.handle('save-server', (_e, u) => {
  u = String(u || '').trim().replace(/^https:\/\//i, 'wss://').replace(/\/+$/, ''); // accept the download-page address too
  if (u === '') { const s = loadSettings(); delete s.server; fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)); return { ok: true, server: DEFAULTS.server }; }
  if (!validServer(u)) return { ok: false, error: 'Server must start with wss:// or https:// (ws:// is only allowed for localhost)' };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), server: u }, null, 2)); return { ok: true, server: u };
});
ipcMain.handle('screen-source', async () => {
  const [src] = await desktopCapturer.getSources({ types: ['screen'] });
  const d = screen.getPrimaryDisplay(); return { id: src.id, width: d.size.width, height: d.size.height };
});
ipcMain.on('session-state', (_e, s) => {
  inputAllowed = !!s.inputAllowed; sessionActive = !!s.active;
  // Visible indicator: title + always-on-top while a session is active so the host can always see/end it.
  win.setTitle(s.active ? 'RemoteLink — SESSION ACTIVE (viewer connected)' : 'RemoteLink');
  win.setAlwaysOnTop(!!s.active);
});
ipcMain.on('log', (_e, m) => console.log(m));

ipcMain.on('input', async (_e, ev) => {
  if (!inputAllowed || !nut) return;               // only after explicit host consent to control
  try {
    const d = screen.getPrimaryDisplay().size;
    if (ev.k === 'move' || ev.k === 'click') await nut.mouse.setPosition(new nut.Point(Math.round(ev.x * d.width), Math.round(ev.y * d.height)));
    if (ev.k === 'click') await nut.mouse.click(ev.b === 2 ? nut.Button.RIGHT : nut.Button.LEFT);
    if (ev.k === 'text' && typeof ev.text === 'string') await nut.keyboard.type(ev.text.slice(0, 256));
    if (ev.k === 'move' || ev.k === 'click') console.log(`INJECTED ${ev.k} ${Math.round(ev.x * d.width)} ${Math.round(ev.y * d.height)} lat_ms=${Date.now() - ev.ts}`);
  } catch (err) { console.error('inject failed', err.message); }
});
