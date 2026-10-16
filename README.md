# Sky Balloon — an integer voyage (Grade 6, NCERT Ganita Prakash Ch. 10)

Open `index.html` in Chrome, Edge or Safari. Double-clicking works; no server or internet needed.

## How it plays
- The airship's **height is an integer**. Sea level is **0**, the sky above is positive and the sea below is negative.
- Each **orange balloon is (+1)** and each **blue sandbag is (−1)**: the NCERT token model.
- **Add** a balloon: + (+1). **Add** a sandbag: + (−1). **Take away** a balloon: − (+1). **Take away** a sandbag: − (−1), and up you go.
- To change the height, drag a token from its pod onto the ship or tap **Add**. To take one away, pull it off the ship or tap **Take away**.
- Fly through each gate at the height on its plaque. If the height is wrong, the ship waits in front of the gate (it bumps if pushed through).
- The ribbon at the bottom writes every move as an integer sentence, e.g. (+2) − (−1) = (+3).
- The altimeter on the left is the vertical number line (Bela's lift turned upright).
- Stars are awarded for the fewest moves; shells are collected at each gate.

## Levels (follow the chapter order)
1. Positive heights, Start + Movement = Target
2. Adding negatives
3. Crossing zero into the sea
4. Taking away positives
5. Taking away negatives
6. Mixed choices
7. and 8. Zero pairs: add pairs first when the tokens you need to take away aren't there
9. Plan mode: Movement needed = Target − Start
10. Surprise sandbags dropped by gulls

## Files
- `index.html`: screens and HUD markup
- `css/style.css`: styles
- `js/engine.js`: asset loader, stage scaling, **HUD layout table** (`RECTS`, landscape and portrait)
- `js/levels.js`: level data with the NCERT idea each level practises
- `js/world.js`: canvas world, including parallax, gates, the ship, particles and the measured sprite anchors
- `js/game.js`: integer actions, token physics, gates and scoring
- `js/hud.js`: altimeter, equation ribbon, pods and the navigator
- `js/screens.js`: title, how-to, voyage map, level intro, results and pause
- `js/audio.js`: placeholder synth sound effects and the browser voice
- `assets/`: cleaned sprites cut from your sheets, trimmed, with frame sets sharing one anchor

## URL flags
- `?level=5&go`: jump straight into level 5
- `?unlock`: unlock every level on the map
- `?speed=3`: run the game faster

## Keyboard
↑ adds a balloon, ↓ adds a sandbag, B takes away a balloon, S takes away a sandbag, Z adds a zero pair, Esc pauses.
