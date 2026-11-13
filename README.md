# Blazing Vanguard

Static web build (no build step). Open `index.html` through any static server.

## Deploy to Vercel
- **Drag & drop:** vercel.com → Add New → Project → upload this folder, Framework preset: **Other**, no build command, output directory `.`.
- **CLI:** `npm i -g vercel` then run `vercel --prod` inside this folder.
- **GitHub:** push this folder to a repo and import it in Vercel (preset **Other**).

## Run locally
`npx serve .` or `python -m http.server 8080`, then open http://localhost:8080 (opening the file directly with file:// will not load the sprites).

## Files
- `index.html` — page, HUD and FEH-style skin
- `game.js` — combat, heroes, waves, save (localStorage)
- `engine.js`, `sprite.js`, `spritedata.js` — renderer + sprite animation data
- `audio.js` — synthesized BGM/SFX + Japanese voice lines (browser speech)
- `world.js` — platforms, rift portal + secret level, day/night + weather, skill FX
- `story.js` — dialogue events and quests
- `fxdata.js` — spell animation metadata; `audio/` — music
- `febg.js` — pixel-art battlefield backdrop
- `ui.js`, `d2.js`, `skillicons.js` — panels, items, skill icons
- `sprites/`, `icons/` — art; `vendor/three.min.js` — three.js r128
