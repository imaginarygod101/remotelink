# Deploy & build
## Signaling server
    cd server && npm ci && PORT=8443 ICE_SERVERS='[{"urls":"stun:turn.example.com:3478"},{"urls":"turn:turn.example.com:3478","username":"rl","credential":"SECRET"}]' node server.js
Put behind nginx/Caddy with TLS (wss://) and set `TRUST_PROXY=1 HOST=127.0.0.1`. Example systemd unit: `ExecStart=/usr/bin/node /opt/remotelink/server/server.js`.
Caddy example (auto TLS): `remotelink.example.com { reverse_proxy 127.0.0.1:8787 }` with `STATIC_DIR=/opt/remotelink/site` to serve the download page from the same host.
Then set `desktop/src/defaults.json` → `{"server":"wss://remotelink.example.com"}` and `DEFAULT_SERVER` in `mobile/www/index.html`, and rebuild.

## Render (what 0.2.1 uses) — deployed 2026-11-25, free plan
- Repo: https://github.com/imaginarygod101/remotelink (public). Both Render services auto-deploy on push to `main`.
- Web service `remotelink-signal` (free, Frankfurt): build `cd server && npm ci`, start `node server/server.js`, env `HOST=0.0.0.0 TRUST_PROXY=1` (Render sets `PORT`). URL `https://remotelink-signal.onrender.com` → clients use `wss://remotelink-signal.onrender.com`. `/healthz` returns JSON. Render passes `X-Forwarded-For`, so the host sees the viewer's real IP and the bad-code limit is per IP.
- Static site `remotelink` (free): publish path `site`, no build. URL https://remotelink-0s35.onrender.com.
- `render.yaml` describes the same two services as a blueprint.
- Free plan limits: the web service sleeps after ~15 min without traffic, and the first request then takes ~1 min. WebSockets are supported.
- Release flow: bump versions → build → copy to `artifacts-<ver>/` (gitignored) → `sha256sum RemoteLink-* > SHA256SUMS.txt` → `gh release create v<ver> artifacts-<ver>/*` → set `VERSION` in `tools-scripts/make-site.py` and run it → commit + push (Render redeploys the page).

## Temporary public URL (what 0.2.0 used — superseded by Render)
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
- Publish: see the release flow in the Render section above.
