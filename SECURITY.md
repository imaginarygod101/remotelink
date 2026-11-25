# RemoteLink security model
**Never**: hidden capture, stealth/background mode, autostart/persistence, unattended access, disguised binaries. Every build is named RemoteLink with its own icon.
- **Consent**: viewers can't receive signaling until the host clicks Allow in a visible modal. Control is a separate opt-in (unchecked by default). Capture permission is granted in `main.js` only while `sessionActive` is true.
- **Visibility**: red SESSION ACTIVE banner + window title + always-on-top during sessions; one-click End.
- **Codes**: 9 digits from `crypto.randomInt`, single viewer per code, 10-min TTL for unapproved codes, destroyed when session ends.
- **Brute force**: 5 bad codes per IP per minute → `too_many_attempts`; 60 msgs / 10 s per socket → disconnect; 64 KB max frame.
- **Tokens**: 192-bit random per-session token required on every relayed signal.
- **Transport**: run signaling behind TLS (wss://). Media/data are always DTLS-SRTP encrypted end-to-end by WebRTC; TURN relays can't decrypt.
- **Renderer hardening**: contextIsolation on, nodeIntegration off, narrow preload API, CSP. Input events are size-limited and clamped to the primary display.
- **Test hook**: `RL_E2E` auto-approval is refused when `app.isPackaged` (verified 0.2.0 AppImage: logs "RL_E2E ignored", consent modal stays up until a human clicks).
- **Session code logging**: the code is written to the log only in dev E2E mode; packaged builds never log it (verified).
- **Control opt-in per request**: the "allow control" box is reset to unchecked for every new request (bug found and fixed in 0.2.0 testing; it used to carry over).
- **Server URL**: only `wss://` accepted (ws:// only for localhost); https:// pasted from the download page is converted to wss://.
- **Behind a tunnel**: with `TRUST_PROXY=1` the client IP comes from CF-Connecting-IP / X-Forwarded-For. The workslocal tunnel passes neither, so the host sees "unknown (via tunnel)" and the bad-code limit (5/min) becomes global across all users. That's stricter, but one attacker can block code entry for everyone for a minute.
- **Downloads**: every artifact has a published SHA-256; the page verifies it in the browser before saving. Builds are unsigned (SmartScreen/Gatekeeper warn).
TODO: device registration/accounts, end-to-end fingerprint confirmation shown on both screens, audit log, code signing of all binaries.
