# RemoteLink 0.2.0 test results (2026-11-25, times WAT/UTC+1)
Machine: Debian 13 box, Xvfb 1280×800, Electron 39 (bundled), Android 14 emulator (x86_64, KVM). Public signaling: `wss://znvjbtih…` then, for the final release build, `wss://nfu3r8pw.workslocal.exposed` (separate tunnel from the download page, so downloads can't take signaling down).

| # | Test | Result |
|---|---|---|
| 1 | Server unit tests (`node server/test.js`) | 9/9 pass |
| 2 | Dev E2E through public wss (`SERVER=wss://… tests/e2e.sh`) | 7/7 pass. 29.2 fps, DC RTT p50 0.8 / p95 1.3 ms, input inject 1–4 ms, approve→connected 150 ms |
| 3 | Packaged AppImage host + `RL_E2E=1` | "RL_E2E ignored" logged; consent modal stayed up 20 s+ without approval; no session code in log |
| 4 | Packaged host (baked default URL, no env) ← dev viewer, human clicks Allow + control | 28.5 fps, DC RTT p50 1.0 ms, 3/3 moves injected, cursor at 960,480 |
| 5 | Packaged host, view-only Allow | 29.4 fps; viewer sent 3 moves, **0 injected** (correct) |
| 6 | Settings: invalid `http://` URL | Rejected, nothing saved |
| 7 | Settings: save `wss://example.org/rl`, restart | Persisted in `~/.config/RemoteLink/settings.json`; Reset restores the default |
| 8 | Control checkbox on 2nd request | Bug found (carried over checked); fixed; re-verified unticked |
| 9 | Android APK viewer (emulator) → packaged Linux host via public URL | 28.9 fps 1280×800, 2 dropped / 605 frames, jitter 14 ms, ICE RTT 3 ms, tap→click injected, End by host shown on phone |
| 10 | Public signaling RTT (30 msgs) | connect 146–457 ms, RTT p50 29–32 ms, p95 33–41 ms (vs 0.7 ms on localhost) |
| 11 | Download page in headless Chrome (chunked + SHA-256 in browser) | APK and AppImage saved, hashes verified |
| 12 | curl chunked download of every artifact from the public URL | see `tests/results/release/public-download-verify.txt`. The download tunnel dropped after ~100 MB, the watchdog moved it to a new URL, and the retry passed |
| 13 | .deb install (`apt install ./RemoteLink-0.2.0-linux-amd64.deb`) | Installed to /opt/RemoteLink with a .desktop entry (not launched from the deb) |
| 15 | **Final release build** (AppImage, baked default `wss://nfu3r8pw…`, `RL_E2E=1` set) | E2E ignored; view-only Allow → 28.2 fps, 3 moves sent / 0 injected; 2nd request opened **unticked**; control Allow → 28.9 fps, DC RTT p50 1.0 ms, 3/3 moves injected, cursor 960,480, approve→connected 117 ms |
| 16 | **Final release APK** (Android 14 emulator) → final AppImage host | request showed control unticked; with control: 29.4 fps, 0 dropped / 607, jitter 3 ms, ICE RTT 4 ms, tap→click injected (~23 ms after −225 ms clock-skew correction), End from phone ended host session |
| 14 | Windows build under Wine 10 | Silent NSIS install returned 2; portable exe started but drew no window. **Inconclusive, needs real Windows** |

STUN: Google STUN is configured, but the box's network blocks outbound UDP to the internet (0 srflx candidates), so NAT traversal across real networks is **unverified**.
Evidence: `tests/results/final/*.png|*.log|*.json`, `tests/results/packaged/`, `tests/results/android/`.
