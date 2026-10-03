# Pocket POS — promo video

`pocket-pos-teaser-15s.mp4` — 15 s, 1080×1920 (9:16) teaser; `pocket-pos-teaser-cover.jpg` — cover frame.

Everything is generated from the real app, no stock footage or samples:

1. `tools/seed.mjs` fills the dev app with an original demo shop ("Pixel Panda ACG": vector product art from `art.mjs`,
   translated names, two weeks of sales) through the app's own modules.
2. `tools/takes.mjs` drives the app in headless Chrome on a **virtual clock** (`inject.js`, `vrecord.mjs`) and screenshots every
   frame, so the three takes (`sell`, `lang`, `reports`) are exact 30 fps and repeatable.
3. `tools/compose.html` lays the takes into a phone mockup with camera moves, tap ripples and captions;
   `timeline.mjs` says which part of which take plays when (and is shared with the audio).
4. `tools/music.mjs` synthesises an original 128 BPM track and the tap-synced sound effects (royalty-free, no samples).
5. `tools/encode.swift` writes the H.264/AAC MP4 with macOS AVFoundation (no ffmpeg needed).

## Rebuild
Needs the dev server (`npm run dev`, port 5173) and Google Chrome. `SP` is any scratch folder.

```bash
cd marketing/tools && SP=/tmp/pocketpos-video && mkdir -p $SP
node takes.mjs seed $SP && node takes.mjs sell $SP && node takes.mjs lang $SP && node takes.mjs reports $SP
node music.mjs $SP
node render.mjs $SP --out=$SP/frames            # add --step=15 --scale=0.35 for a quick preview
swiftc -O -swift-version 5 encode.swift -o encode && ./encode $SP/frames $SP/audio.wav ../pocket-pos-teaser-15s.mp4 30
```

Captions and the end card are in `compose.html` (`CAPS`, `#end`); camera framing is the `CAM` list there.
Item-name translations in the footage are seeded values — the web build can't run the Android on-device translator.

## 30 s cut (`pocket-pos-promo-30s.mp4`)
Same pipeline, new files: `tools/timeline30.mjs`, `compose30.html`, `music30.mjs`, web takes `takes30.mjs`, Android takes `andtakes30.mjs`,
shop stills `stills.mjs` (café / fashion / ACG from `shops.mjs` + `art2.mjs`). Render with
`node render.mjs $SP --page=compose30.html --out=$SP/frames30`, encode with `$SP/audio30.wav`.

Android scenes are the real APK in the emulator, captured from its WebView over CDP:
boot `emulator -avd ct -no-window -no-audio -no-snapshot -read-only -gpu swiftshader_indirect`, `adb install` the APK, then
`node takes30.mjs seed $SP && node cloneseed.mjs $SP` (copies the demo shop in), `adb shell ime disable <each ime>` (so the soft keyboard
doesn't resize the WebView), `node androidwarm.mjs $SP` (downloads the ML Kit language packs once), `adb shell mkdir /sdcard/Documents/PocketPOS`
and grant that folder through the system picker (`androidfolder.mjs` opens it; accept with adb taps), then `node andtakes30.mjs translate|backup $SP`.
