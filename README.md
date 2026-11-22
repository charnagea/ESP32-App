# Smart Post Academy

An offline Android course that teaches C++ and the ESP32 by writing the complete firmware for the Vineyard Smart Post: four XIAO ESP32-S3 Sense camera nodes and the LILYGO T-SIM7600E-H hub.

Built from `PROJECT-STATE.md` revision 2 (16 Nov 2026).

## Install

1. Open **Releases** in this repo on your phone and download the newest `SmartPostAcademy.apk`.
2. Open it and allow installs from your browser or file manager when Android asks.
3. New builds install over the old one and keep your progress, because every build is signed with the same key.

## What is inside

| Folder | Contents |
|---|---|
| `course/src` | The lesson engine (`app.js`), styles and the course content (`content_*.js`) |
| `course/bundle.py` | Inlines everything into one offline `index.html` and copies it into the app's assets |
| `course/test_content.js` | Checks every question and that every lab's reference solution passes its own checks |
| `firmware/SmartPost_Node` | Camera node sketch + `SmartPostProtocol.h` |
| `firmware/SmartPost_Hub` | Hub sketch + the same `SmartPostProtocol.h` |
| `android` | A minimal WebView app that shows the course full-screen |
| `.github/workflows/build.yml` | Compiles both sketches against esp32 core 3.3.8, builds and publishes the APK, and writes a report to the `ci-logs` branch |

## Status of the firmware

Both sketches implement the **proposed** design (📐) in `PROJECT-STATE.md` §5. They are compile-checked in CI only, not run on the boards. Test each part in the order of the project's next-steps list.

Settings you still have to fill in: `UPLOAD_URL`, `APN`, `BAT_DIVIDER`/`BAT_CAL` (calibration I-07), and confirm `WAKE_PIN 39` (Q2) and `PWRKEY_ON_LEVEL` on the bench.

## Signing key

`android/app/signing/keystore.b64` is a dedicated key for this personal, sideloaded app only, so updates install over each other. Don't reuse it for anything published.
