# Deploy & build
## Signaling server
    cd server && npm ci && PORT=8443 ICE_SERVERS='[{"urls":"stun:turn.example.com:3478"},{"urls":"turn:turn.example.com:3478","username":"rl","credential":"SECRET"}]' node server.js
Put behind nginx/Caddy with TLS (wss://) and set `TRUST_PROXY=1 HOST=127.0.0.1`. Example systemd unit: `ExecStart=/usr/bin/node /opt/remotelink/server/server.js`.
Caddy example (auto TLS): `remotelink.example.com { reverse_proxy 127.0.0.1:8787 }` with `STATIC_DIR=/opt/remotelink/site` to serve the download page from the same host.
Then set `desktop/src/defaults.json` → `{"server":"wss://remotelink.example.com"}` and `DEFAULT_SERVER` in `mobile/www/index.html`, and rebuild.

## Temporary public URL (what 0.2.0 uses — no account)
The box's outbound network allows only HTTPS/WSS on 443, so `cloudflared` quick tunnels (need port 7844), localtunnel (raw TCP), ssh tunnels (localhost.run, pinggy, serveo) and tunnelmole (port 8083) all failed. `workslocal` works (WSS on 443, no account):
    HOST=127.0.0.1 PORT=8787 TRUST_PROXY=1 STATIC_DIR=site node server/server.js &
    tools-scripts/public-tunnel-watchdog.sh &      # runs `workslocal http 8787`, restarts it, logs to run-logs/
Limits seen: anonymous tunnels expire after ~2 h; single responses over ~20–30 MB fail (so the page downloads in 8 MB Range chunks and verifies SHA-256 in the browser); heavy sustained transfer once dropped the tunnel and the old subdomain could not be reclaimed. Not suitable for real users — use a VPS.
## TURN (coturn) — needed when peers are behind symmetric NAT / different networks
    apt install coturn
    # /etc/turnserver.conf
    listening-port=3478
    fingerprint
    lt-cred-mech
    user=rl:SECRET
    realm=remotelink.example.com
    external-ip=<PUBLIC_IP>
Open UDP/TCP 3478 and UDP 49152-65535. Prefer time-limited REST credentials (`use-auth-secret`) in production.
## Desktop builds
- **Linux (built here)**: `cd desktop && npx electron-builder --linux AppImage deb`
- **Windows (built here with wine)**: `npx electron-builder --win nsis zip --x64` → `release/RemoteLink-Setup-0.2.0-win-x64.exe` + portable zip. `npmRebuild` is off; nut-js ships prebuilt win32 binaries. Gives an installer with install-dir choice, Start menu/desktop shortcut and uninstaller named RemoteLink. Sign with `CSC_LINK=cert.pfx CSC_KEY_PASSWORD=… ` (EV/OV cert recommended to avoid SmartScreen warnings). Windows Firewall will prompt on first run.
- **macOS DMG**: on a Mac with Xcode CLT: `npx electron-builder --mac dmg`. Sign + notarize: `CSC_LINK=DeveloperID.p12 CSC_KEY_PASSWORD=… APPLE_ID=… APPLE_APP_SPECIFIC_PASSWORD=… APPLE_TEAM_ID=… npx electron-builder --mac` (set `"notarize": true` under `build.mac`). Users must grant **Screen Recording** (host) and **Accessibility** (host, for control) in System Settings › Privacy & Security.
- **Mobile**: see `mobile/README.md`.
- Output goes to `desktop/release/`; build resources (icon, entitlements) live in `desktop/assets/`.
- Publish: copy artifacts to `site/downloads/`, `cd site/downloads && sha256sum RemoteLink-* > SHA256SUMS.txt`, `python3 tools-scripts/make-site.py`.

## Render (permanent URL) — checked 2026-11-25, not deployed
A Render connector is available (workspace "My Workspace"), but `create_web_service` / `create_static_site` only deploy from a **public Git URL**. GitHub isn't connected, and Cursor Origin repos can only be internal/private, so Render can't clone them. The builds (105–158 MB) also exceed GitHub's 100 MB per-file limit for a repo, so they'd need GitHub Releases (≤2 GB/file).
Once GitHub is connected: push `server/` + `site/` to a public repo, upload the builds as a GitHub Release, then create a Render **free** web service with root dir `server`, build `npm ci`, start `node server.js`, env `HOST=0.0.0.0 TRUST_PROXY=1 STATIC_DIR=../site` (Render sets `PORT`). URL: `wss://<name>.onrender.com`. Free instances sleep after 15 min idle (~1 min cold start) and allow WebSockets.
