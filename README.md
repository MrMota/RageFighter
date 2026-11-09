# RageFighter

An original 2D arcade fighting game. It runs as an installable, offline-capable **PWA** and is packaged as an **Android APK** with Capacitor.

The characters, art (drawn in code), music and sound (synthesized at runtime) are all original. Only the genre and its mechanics are borrowed.

## Features
- 4 original fighters: **Kael**, **Brakka**, **Nyx** and **Volta**, each with their own stats, a projectile, a rising anti-air, a rush, and a RAGE super
- Best-of-3 rounds, 99-second timer, chip damage, high/low blocking, combo scaling, hitstop, special cancels and light-attack chains
- Modes: VS CPU (easy, normal or hard), local 2P versus, and Training (infinite health and meter)
- Keyboard, gamepad and on-screen touch controls (virtual stick and buttons)
- Works offline through a service worker, and can be installed to the home screen in fullscreen landscape

## Controls
| | Player 1 | Player 2 |
|---|---|---|
| Move / jump / crouch | W A S D | Arrow keys |
| Light / heavy punch | U / I | Numpad 4 / 5 (or 7 / 8) |
| Light / heavy kick | J / K | Numpad 1 / 2 (or 9 / 0) |
| Rage super | L | Numpad 6 (or -) |
| Pause | Esc / P | |

**Special moves** (written as if you face right):
- Projectile: ↓ ↘ → + Punch
- Rising: → ↓ ↘ + Punch (briefly invincible)
- Rush: ↓ ↙ ← + Kick
- Rage: the Rage button (or Heavy Punch + Heavy Kick) when the meter is full

## Run the PWA locally
```bash
npm run serve        # http://localhost:8080
```
Pushing to `main` deploys `www/` to GitHub Pages (`.github/workflows/pages.yml`). To turn this on, open Settings → Pages and set the Source to "GitHub Actions".

## Build the APK
**On GitHub (no local setup):** every push runs `.github/workflows/android.yml`. Download `RageFighter-apk` from the run's Artifacts. Pushing a tag such as `v1.0.0` also attaches `RageFighter.apk` to a GitHub Release.

**Locally** (needs the Android SDK and JDK 17):
```bash
npm install
npx cap add android
./scripts/patch-android.sh   # landscape, fullscreen, game icons
npm run android:build        # -> android/app/build/outputs/apk/debug/app-debug.apk
```
The APK is a debug build, so you can sideload it straight away. Publishing on Google Play needs a signed release build (`./gradlew bundleRelease` plus a keystore).

## Project layout
```
www/                 the game (static PWA)
  js/game.js         loop, scenes, HUD, combat, camera
  js/fighter.js      fighter state machine and physics
  js/characters.js   roster and move data
  js/render.js       procedural fighter and stage rendering
  js/input.js        keyboard, gamepad, touch and motion-input detection
  js/ai.js           CPU opponent
  js/audio.js        synthesized SFX and music
  sw.js, manifest.webmanifest, icons/
scripts/patch-android.sh   Android customisation
android-res/               launcher icons
```
