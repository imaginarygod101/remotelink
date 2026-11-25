# Compatibility matrix (0.2.1, 2026-11-25)
**0.2.1 update (Render signaling `wss://remotelink-signal.onrender.com`):** Linux packaged AppImage host ← Linux viewer: connect ✅, view ✅ 1280×800 @ 29.1 fps, mouse injection ✅ (3/3, cursor 960,480), DC RTT p50 1.3 ms. Installed .deb host, view-only: ✅ 29.1 fps, input blocked ✅. Signaling RTT to Render p50 104 ms. Android 0.2.1 APK **not re-tested** (emulator would not boot on the rebuilt test machine); Android rows below come from the 0.2.0 run. Both ends still on one machine.

### 0.2.0 results (via the old tunnel)
**Actually run:** Linux→Linux (two app instances on one machine, Xvfb) and Android 14 *emulator* → Linux, both with signaling through the public wss:// tunnel. Media stayed on the local machine (host candidates). **No test between two physical devices on different networks yet.** Nothing is marked working just because code exists.

Linux (packaged AppImage host) ← Linux viewer via public signaling: connect ✅, view ✅ 1280×800 @ 28.2–29.4 fps, mouse-move injection ✅ (cursor verified at 960,480), view-only blocks input ✅, data-channel RTT p50 1.0 ms, approve→connected 107–161 ms, relay: none (host/udp pair).
Android 14 emulator (APK) → Linux packaged host via public signaling: connect ✅, view ✅ 1280×800 @ 27–29.4 fps, tap→click injected ✅ (~23–35 ms after clock-skew correction), ICE RTT 3–12 ms, End from either side ✅, relay: none (prflx/udp → host/udp).

"A → B" = A is the viewer/controller, B is the host being viewed/controlled.

| Pair | Connect | View | Mouse/Kbd | Host permissions needed | File xfer | Relay | Latency / FPS | OS restrictions |
|---|---|---|---|---|---|---|---|---|
| Windows → Windows | untested on physical devices | untested | untested | none special; UAC/secure desktop can't be controlled without elevated service (not implemented) | not implemented | TURN if symmetric NAT | not measured | UAC prompts & lock screen invisible/uncontrollable |
| Mac → Windows | untested | untested | untested | as above | n/i | maybe | n/m | as above |
| Windows → Mac | untested | untested | untested | macOS Screen Recording + Accessibility (user grants in System Settings) | n/i | maybe | n/m | TCC permissions required; no control of login window |
| iPhone → Windows | not built (needs Mac/Xcode) | untested | untested (tap → click only) | none special | n/i | maybe | n/m | iOS app must be signed/reviewed |
| Android → Windows | APK built; viewer verified only vs Linux host on emulator | untested on Windows | tap → click only; untested on Windows | none special | n/i | maybe | n/m | — |
| iPhone → Mac | untested | untested | untested | Screen Recording + Accessibility | n/i | maybe | n/m | TCC |
| Android → Mac | APK built; untested vs Mac | untested | tap → click only; untested | Screen Recording + Accessibility | n/i | maybe | n/m | TCC |
| Mac → Android | not implemented | not implemented (needs MediaProjection host) | possible only via AccessibilityService with explicit user consent — not implemented | MediaProjection consent each session + user-enabled AccessibilityService | n/i | maybe | n/m | Play Accessibility policy; Android 14+ per-session projection consent |
| Windows → Android | not implemented | not implemented | AccessibilityService only, explicit consent — not implemented | as above | n/i | maybe | n/m | as above |
| Android → Android | not implemented | not implemented | AccessibilityService only, explicit consent — not implemented | as above | n/i | maybe | n/m | as above |
| iPhone → Android | not implemented | not implemented | AccessibilityService only, explicit consent — not implemented | as above | n/i | maybe | n/m | as above |
| iPhone → iPhone | not implemented | view-only possible via ReplayKit broadcast (not implemented) | **UNSUPPORTED** — iOS allows no remote input | ReplayKit broadcast start by user | n/i | maybe | n/m | iOS forbids injecting input into other apps |

General rule: **iPhone as a controlled host is unsupported** (view-only at most). Android as controlled host is possible only through an AccessibilityService the user enables explicitly.

Extra row (not in the requested 12): **Android → Linux**: ✅ on emulator (see above). **Linux → Linux**: ✅ on one machine.
No pair has been tested with TURN, because no TURN server is deployed. Pairs behind symmetric NAT or strict firewalls will fail until one exists.
