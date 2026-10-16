You are joining an existing project: **Sky Balloon**, a Grade 6 integer-learning browser game (plain HTML/CSS/JS + GSAP 3.12.5, no build step, no framework). Before changing anything, read the files listed below and build a mental model of the game. Then give me a short summary of how it works, and wait for my instructions.

## What the game teaches (NCERT Class 6, Ganita Prakash Ch. 10 "The Other Side of Zero")
- The airship's **height is an integer**. Sea level = 0 (neither positive nor negative), sky = positive, sea = negative.
- **Orange balloon = (+1) token, blue sandbag = (−1) token** (the NCERT token model). Height = balloons − sandbags.
- Four actions = four integer operations: add balloon `+ (+1)`, add sandbag `+ (−1)`, take away balloon `− (+1)`, take away sandbag `− (−1)` (goes UP). A balloon + sandbag is a **zero pair**: (+1) + (−1) = 0.
- The ship must fly through gates at the target height on each plaque. The ship waits at a gate until the height is right.
- The altimeter on the left is a vertical number line (NCERT "Bela's building" lift). The bottom ribbon writes every move as an integer sentence in bracket notation, e.g. `(+2) − (−1) = (+3)`.
- Pedagogy rules to keep: use the chapter's phrases ("Starting + Movement = Target", "Target − Start = Movement needed"); say "add / take away" and "up / down", not just "more / less"; no "two minuses make a plus" shortcuts; no multiplication (that's Class 7).

## Files (read in this order)
1. `index.html`: all screens and the HUD markup; script load order matters (globals on `window.SB`).
2. `js/engine.js`: asset loader (`SB.assets`), stage scaling, and **`RECTS`**, the single layout table for the two fixed stages (landscape 1920×1080, portrait 1080×1920). The stage is scaled to fit the window; all positions are stage pixels.
3. `js/levels.js`: the 10 levels (`SB.LEVELS`): start tokens, crate contents, gates, par moves, map position, the NCERT idea each level practises, and intro lines. Level 9 is "plan" mode (choose the whole movement at once).
4. `js/game.js`: state (`SB.state`), the integer actions (`SB.game.actions`), token spring physics, gate passing/bumping, stars, gull surprise sandbags, camera follow. World units: `y = −height × U` (U = 84 px per step).
5. `js/world.js`: the canvas renderer: mirror-tiled parallax layers, gates and plaques, the airship (balloons above, sandbags below), particles, water surface, and depth vignette. **`G` (geom) holds measured anchor fractions for each sprite.** Change those, not ad-hoc offsets.
6. `js/hud.js`: the minimal HUD: level pill, altimeter ticks, equation ribbon, token pods, navigator speech bubble, and hints.
7. `js/screens.js`: title, 4-card how-to, voyage map, level intro card, results (stars and confetti), pause.
8. `js/main.js`: boot, the GSAP ticker game loop, drag & drop (drag from pod = add, pull off ship = take away), keyboard shortcuts.
9. `js/audio.js`: placeholder WebAudio sound effects plus the browser speech voice.
10. `css/style.css`: all styling; per-orientation rules use `.land` / `.port` on `#stage`.
11. `js/asset-sizes.js`: auto-generated `[width, height, ext]` for every file in `assets/`. **Regenerate it if you add or replace art.**

## Assets
`assets/` holds sprites cut from the generated sheets, trimmed, with animation frame sets sharing one anchor. Folders: `vessel/gondola`, `tokens/balloons`, `tokens/sandbags`, `characters/{pilot,navigator}-poses`, `characters/rival` (unused yet), `world/{gates,obstacles,creatures,pickups}`, `fx/{flight,zero-pair}`, `parallax/*`, `ui/*`. Ignore `_qa/` (QA scratch).

## Constraints when editing
- It must keep working when `index.html` is opened directly from disk (file://). **Never read canvas pixels** (`getImageData`), and never use fetch or modules for local files.
- Keep the UI decluttered. Keep all HUD rectangles in `RECTS`, and keep both orientations working.
- Keep integer formatting via `SB.util.fmt` / `SB.util.br` (zero is shown as `0`, never `+0`).
- Test with URL flags: `?level=5&go` (jump into a level), `?unlock` (open all map nodes), `?speed=3` (fast). Keys: ↑ add balloon, ↓ add sandbag, B / S take away, Z zero pair, Esc pause.

## Known next steps
- Real sound effects and a recorded voice (currently synth beeps and the browser voice).
- More levels (planned: 30, plus "Captain Gusto" rival races; rival art is in `characters/rival`).
