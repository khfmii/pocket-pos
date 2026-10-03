#!/usr/bin/env bash
# Builds the web app, syncs it into the Android project and assembles a debug APK.
# Usage: npm run apk            (debug APK, installable on any phone with "unknown sources" enabled)
set -euo pipefail
cd "$(dirname "$0")/.."

# Capacitor 8 / Gradle 8.14 need JDK 17-24 (21 recommended); JDK 25 fails with "Unsupported class file major version 69".
# Prefer a project-local JDK in .tools/, then any installed 21/17.
pick_jdk() {
  for d in .tools/jdk-21*/Contents/Home .tools/jdk-21* .tools/jdk-17*/Contents/Home .tools/jdk-17*; do
    [ -x "$d/bin/java" ] && { echo "$PWD/$d"; return; }
  done
  /usr/libexec/java_home -v 21 2>/dev/null || /usr/libexec/java_home -v 17 2>/dev/null || true
}
JAVA_HOME=$(pick_jdk); export JAVA_HOME
[ -n "$JAVA_HOME" ] || { echo "No JDK 17-24 found. Install JDK 21 or unpack one into .tools/ (see README)."; exit 1; }
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
echo "JDK: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"

npm run build
npx cap sync android
(cd android && ./gradlew assembleDebug --console=plain -q)

mkdir -p releases
cp android/app/build/outputs/apk/debug/app-debug.apk releases/pocket-pos-debug.apk
echo "APK: releases/pocket-pos-debug.apk ($(du -h releases/pocket-pos-debug.apk | cut -f1))"
