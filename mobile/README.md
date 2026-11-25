# RemoteLink mobile viewer 0.2.0
Android: **debug APK built** (JDK 21, SDK 35, Capacitor 7) and **tested on an Android 14 emulator** against a Linux host (view + tap-to-click). Not tested on a physical phone. iOS: **not built** (needs macOS + Xcode).
The viewer saves its signaling server in localStorage (Settings). The default is `DEFAULT_SERVER` in `www/index.html`.
## Android (JDK 21, Android SDK platform 35 + build-tools 35; `android/` is committed)
    npm install && npx cap sync android
    cd android && ./gradlew assembleDebug        # -> app/build/outputs/apk/debug/app-debug.apk
    adb install app/build/outputs/apk/debug/app-debug.apk
Release: `./gradlew bundleRelease`, sign with your upload key, upload the .aab to Play Console (internal testing track first). Declare network use; no accessibility/screen-capture permissions are used by the viewer.
## iOS (needs macOS + Xcode 16)
    npm install && npx cap add ios && npx cap sync ios && npx cap open ios
Simulator: pick an iPhone simulator, Run. Device: set your Team under Signing & Capabilities, Run. App Store: Product > Archive > Distribute (TestFlight first), then App Review. Not ready for public install until signed, reviewed and distributed.
## Host roles on mobile (roadmap)
- Android as controlled host: screen via MediaProjection (system consent dialog each session) + input only through an AccessibilityService the user enables explicitly in Settings. Must comply with Play's Accessibility API policy.
- iPhone as host: view-only via ReplayKit Broadcast Upload Extension at best; **remote input control is unsupported** (iOS provides no API).
