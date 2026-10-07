#!/bin/bash
# Runs every check: the mod's manifests and tests, the receiver's lookup, the Android library's
# tests, and Tally built against the library in debug and release.
set -euo pipefail
cd "$(dirname "$0")/.."

claude plugin validate .
claude plugin validate mod
claude plugin test mod
node --test mod/tests/*.node.test.mjs

cd android
./gradlew -q :composablefix:testDebugUnitTest :tally:assembleDebug :tally:assembleRelease
