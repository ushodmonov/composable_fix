#!/bin/bash
# Puts Tally's seeded UI bugs back, then builds, installs and launches it on the Home tab: run
# before each take. ANDROID_SERIAL names the device or emulator when adb sees more than one.
set -euo pipefail
cd "$(dirname "$0")/.."

ADB=${COMPOSABLEFIX_ADB:-$(command -v adb || echo "$HOME/Library/Android/sdk/platform-tools/adb")}

git checkout demo-start -- android/tally
rm -rf android/.composablefix/reports

(cd android && ./gradlew -q :tally:installDebug)
# Forget the last open tab, so the app starts on Home.
"$ADB" shell pm clear dev.composablefix.tally >/dev/null
"$ADB" shell am start -n dev.composablefix.tally/.MainActivity >/dev/null
