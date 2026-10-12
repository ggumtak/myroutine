# 소리일기: UI, piano and scale review

Based on `ccr-d2f00aa2-py1nx9` at `e1fd227`. The repository's `main` is a separate skincare app; this change
targets the active Android song diary rather than replacing that project.

## Before → after

| Problem | Result |
| --- | --- |
| Diary identity depended entirely on a personal title | 소리일기 branding, musical notebook icon, personal title kept underneath |
| Piano/recording tools were small or inside another part | Three labeled home shortcuts: 스케일, 녹음, 한 줄 기록 |
| Diary was hidden behind 모아보기 → 일지 | 기록 opens directly on 일기, alongside 곡별·녹음·음역 |
| Long exercise instructions came before the instrument | Keyboard and playback controls first; optional instructions below |
| Today parts lacked a visible heading/backward action | Visible headings, matching icons, previous/next buttons and keyboard tab navigation |
| First-use screens described tools but provided little direction | Notebook/microphone illustrations and working write/add actions |
| Monophonic 80 kbps MP3 and synthetic loading fallback | Original 48 kHz stereo Yamaha C5 samples in lossless FLAC (16-bit, dithered from 24-bit, to keep the APK under the Drive upload limit); wait for the real sound |
| Final note sustained for up to several beats | Final note 0.6 beat plus a short 160 ms damper release |
| Normal speed was 100 BPM | 느리게 60, 보통 80, 빠르게 100, 매우 빠르게 130; prior default 100 migrates to 80 |
| 계이름 stayed 도 미 솔 after transposing | Actual played note names update on every root change |
| Off-screen highlighted piano keys stayed hidden | Current key follows horizontally as the melody moves |
| Automatic scales always rose then fell | Default 상행 시작; 하행만 runs from the upper bound down to the independently selected start |
| Endpoint edits stopped/restarted playback | Finish the current round, replan only the remaining rounds in semitone steps |
| Starting and top notes were implicitly related | Both persist independently; an invalid range plays once without changing either setting |
| Renderer loss in Recents could also kill the app | Handle renderer termination and recreate the activity; discard incomplete OTA launch paths |
| Background time counted toward OTA boot failure | Boot watchdog counts foreground time only; installer/cleanup serialize and protect rollback files |
| Split/popup window support was implicit | Explicit resizable activity and native window-size events; short windows scroll the controls |

## Validation

`songdiary/tests/ux-smoke.cjs`: browser navigation, persistent diary text, failure/recovery, tab keyboard
controls, 320/360/390/430/768px layouts, 320×460 and 600×380 scale windows, transposition, key tracking,
descending mode, independent/live endpoint edits, and actual offline stereo audio rendering. The audio
check confirms audible output, different left/right channels, no clipping, and a short final tail.

Run: `cd songdiary/tests && npm ci && npx playwright install chromium && npm test`.
Optional `CHROMIUM_EXECUTABLE_PATH` and `SCREENSHOT_DIR` select a browser/output location.
The exported samples, Android XML, PNGs, JSON and JavaScript are also validated separately.

The browser tests do not reproduce Android renderer termination or exercise the system's split-screen
launcher. Those native paths require a device check with the new APK. No connected Android device is
available in this workspace. GitHub Actions compiles and signs the APK with the existing owner key.

## Compatibility

Package `com.songdiary.app`, IndexedDB database, localStorage keys, cloud identity and existing backup
directories/formats stay stable, preserving stored diaries/recordings. Custom notebook names remain.
Launcher artwork/name and native recovery require installing the new APK; screen/audio changes also work
with the existing OTA bridge. APK delivery filenames/Drive folder keep their integration-compatible names.
CI saves an APK artifact before the Drive upload, so a Drive service failure does not hide the build.

Brand vectors are hand-authored SVG/Android vector code. `tools/generate_brand_assets.py` reproduces the
PWA icons, Android icons and splash artwork with cairosvg/Pillow. Piano attribution and hashes live in
`www/piano/README.md` and `samples.json`.
