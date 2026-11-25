#!/usr/bin/env python3
"""Generates site/index.html + site/manifest.json for the RemoteLink download page.
Hashes/sizes come from artifacts-<VERSION>/ (the exact files uploaded to the GitHub Release);
download links point at the GitHub Release assets."""
import hashlib, json, os, html, datetime
VERSION = '0.2.1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, f'artifacts-{VERSION}')
REL = f'https://github.com/imaginarygod101/remotelink/releases/download/v{VERSION}/'
REPO = 'https://github.com/imaginarygod101/remotelink'
SIGNAL = 'wss://remotelink-signal.onrender.com'
V = VERSION
INFO = {
 f'RemoteLink-Setup-{V}-win-x64.exe': ('Windows 10/11 (64-bit)', 'Installer: choose a folder; adds Start-menu and desktop shortcuts and an uninstaller in Apps & features', 'untested', 'Built on Linux with electron-builder + NSIS. Not yet run on a real Windows PC (Wine could not render Electron). Unsigned, so SmartScreen will warn.'),
 f'RemoteLink-{V}-win-x64.zip': ('Windows 10/11 (64-bit)', 'Portable: unzip and run RemoteLink.exe. Nothing is installed.', 'untested', 'Same app as the installer. Not yet run on real Windows. Unsigned.'),
 f'RemoteLink-{V}-linux-x86_64.AppImage': ('Linux x86_64 (X11)', 'chmod +x, then run it', 'tested', 'Tested on Debian 13 (Xvfb/X11) as host through the public Render server: consent prompt, SESSION ACTIVE banner, control and view-only sessions. Wayland untested.'),
 f'RemoteLink-{V}-linux-amd64.deb': ('Debian/Ubuntu x86_64', 'sudo apt install ./RemoteLink-' + V + '-linux-amd64.deb', 'tested', 'Installed with apt on Debian 13, launched from /opt/RemoteLink and used as host through the Render server (view-only session); removed cleanly with apt remove.'),
 f'RemoteLink-Viewer-{V}-android-debug.apk': ('Android 7+ (viewer only)', 'Allow "install unknown apps" for your browser, then open the APK', 'not re-tested', f'Debug-signed test build. {V} is not re-tested: the emulator would not boot on the rebuilt test machine. The same viewer code (0.2.0) was tested on an Android 14 emulator: live screen and tap-to-click. Never tested on a physical phone. It cannot share or control the phone itself.'),
 f'RemoteLink-{V}-source.tar.gz': ('Any', 'Full source: server, desktop, mobile, tests', 'n/a', 'Build macOS/iOS from this on a Mac (see DEPLOY.md).'),
}
files = []
for f in INFO:
    p = os.path.join(D, f); h = hashlib.sha256(open(p, 'rb').read()).hexdigest(); s = os.path.getsize(p)
    os_, how, status, note = INFO[f]
    files.append(dict(name=f, url=REL + f, size=s, sha256=h, os=os_, how=how, status=status, note=note))
now = datetime.datetime.now().astimezone()
json.dump({'version': V, 'release': f'{REPO}/releases/tag/v{V}', 'signaling': SIGNAL, 'generated': now.isoformat(timespec='seconds'), 'files': files}, open(os.path.join(ROOT, 'site', 'manifest.json'), 'w'), indent=2)
json.dump({'url': SIGNAL, 'since': now.isoformat(timespec='seconds')}, open(os.path.join(ROOT, 'site', 'signaling.json'), 'w'))
mb = lambda s: f'{s/1048576:.1f} MB'
e = html.escape
rows = ''.join(f'''<tr><td><b>{e(x["name"])}</b><br><small>{e(x["how"])}</small></td><td>{e(x["os"])}</td><td>{mb(x["size"])}</td>
<td><span class="st {'ok' if x['status'].startswith('tested') else 'un'}">{e(x["status"])}</span><br><small>{e(x["note"])}</small></td>
<td><a class="btn" href="{e(x["url"])}">Download</a></td></tr>
<tr class="h"><td colspan="5"><code>SHA-256 {x["sha256"]}</code></td></tr>''' for x in files)
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RemoteLink {V}: downloads</title><style>
body{{font-family:system-ui,sans-serif;margin:0;background:#0f172a;color:#e2e8f0;line-height:1.45}}header{{background:#1e40af;padding:18px 24px}}header h1{{margin:0;font-size:26px}}
main{{max-width:1100px;margin:auto;padding:16px 24px}}table{{border-collapse:collapse;width:100%}}td,th{{padding:8px;border-bottom:1px solid #334155;vertical-align:top;text-align:left}}
tr.h td{{border-bottom:2px solid #475569;padding-top:0}}code{{font-size:12px;word-break:break-all;color:#94a3b8}}small{{color:#94a3b8}}
.st{{padding:2px 8px;border-radius:10px;font-size:13px}}.ok{{background:#166534}}.un{{background:#92400e}}
.btn{{display:inline-block;padding:7px 14px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none}}
.box{{background:#1e293b;border-radius:8px;padding:12px 18px;margin:14px 0}}.warn{{border-left:4px solid #f59e0b}}a{{color:#93c5fd}}#sig{{font-size:17px;color:#fde68a}}
</style></head><body>
<header><h1>RemoteLink {V}</h1><div>Transparent, consent-based remote desktop. Open-source test release.</div></header><main>
<div class="box warn"><b>Test release: please read this first.</b> These builds are <b>unsigned</b>. Windows SmartScreen will say "Windows protected your PC". Click <i>More info → Run anyway</i> only if the file's SHA-256 matches the one below.
The signaling server runs on Render's free plan. <b>It sleeps after about 15 minutes without use, so the first connection after a quiet period can take about a minute.</b>
There is no TURN relay yet, so some networks (strict corporate or carrier NAT) will not connect.
macOS and iOS builds are not available yet; they must be built and signed on a Mac.</div>
<div class="box"><b>What RemoteLink does:</b> one computer (the <i>host</i>) shows a 9-digit code. Another device (the <i>viewer</i>) enters it. Nothing is shared until the person at the host clicks <b>Allow</b>. Control of the mouse and keyboard is a separate checkbox that starts unticked.
While a session runs, the host shows a red <b>SESSION ACTIVE</b> banner with an <b>End session</b> button. Either side can end it at any time. Nothing runs in the background or at startup.</div>
<h2>Downloads</h2><p><small>Files are served from the <a href="{REPO}/releases/tag/v{V}">GitHub Release v{V}</a>. Check them against <a href="{REL}SHA256SUMS.txt">SHA256SUMS.txt</a> (Linux/macOS: <code>sha256sum -c SHA256SUMS.txt</code>; Windows PowerShell: <code>Get-FileHash .\\file</code>). Source code: <a href="{REPO}">{REPO}</a>.</small></p>
<table><tr><th>File</th><th>System</th><th>Size</th><th>Status</th><th></th></tr>{rows}</table>
<h2>How to connect two of your own devices</h2><ol>
<li>Install RemoteLink on the computer you want to see or control (the host), and on the device you're connecting from (a computer or the Android viewer).</li>
<li>Both apps must use the same signaling server. Builds from this page already use:<br><code id="sig">{SIGNAL}</code><br>You can check or change it under <b>Settings → Signaling server</b>.</li>
<li>On the host, click <b>Share my screen (Host)</b>. A 9-digit code appears. It works once and is valid for 10 minutes.</li>
<li>On the viewer, type the code and click <b>Connect</b>.</li>
<li>On the host, a "RemoteLink connection request" appears. Click <b>Allow</b>. Tick "Also allow control of my mouse and keyboard" only if you want the viewer to control it.</li>
<li>To stop, click <b>End session</b> on either side, or close the app.</li></ol>
<p><small>Linux hosts need an X11 session for screen capture and input (Wayland is untested). macOS hosts (once built) will need Screen Recording and Accessibility permission in System Settings. Phones can be viewers only. An iPhone cannot be remote-controlled because iOS provides no API for that.</small></p>
<h2>What has been tested (2026-11-25)</h2><ul>
<li>Packaged {V} AppImage as host, Linux viewer, through the Render signaling server: consent prompt showed the viewer's real IP and was <b>not</b> auto-approved; with control allowed: 29.1 fps at 1280×800, data-channel RTT p50 1.3 ms, 3 of 3 mouse moves injected.</li>
<li>Installed {V} .deb as host, view-only: 29.1 fps, RTT p50 1.2 ms, viewer input <b>not</b> applied (correct).</li>
<li>Signaling round-trip to Render (Frankfurt) from the test machine: connect 372 ms, message RTT p50 104 ms, p95 117 ms.</li>
<li>All six release files downloaded from GitHub match SHA256SUMS.txt.</li>
<li>Android viewer: 0.2.0 tested on an Android 14 emulator (29.4 fps, tap-to-click). {V} APK not re-run.</li>
<li><b>Not yet tested:</b> two physical devices on different home/mobile networks, Windows on real hardware, a physical Android phone, macOS, iOS. In every test above, both ends ran on the same machine, so video went directly between them.</li></ul>
<p><small>Generated {now.strftime("%Y-%m-%d %H:%M")} WAT (UTC+1).</small></p>
</main></body></html>'''
open(os.path.join(ROOT, 'site', 'index.html'), 'w').write(page); print('wrote', len(files), 'files')
