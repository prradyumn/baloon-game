/* Level journey — ordered to follow NCERT Class 6 Ganita Prakash, Ch. 10 "The Other Side of Zero".
   Height = sum of tokens on the ship: every orange balloon is (+1), every blue sandbag is (−1).
   start: tokens already on the ship. crate: tokens you may add. pair: zero pairs available.
   gates: target heights in order (each gate is one question). par: fewest moves for 3 stars.
   gulls: world x where a gull drops a (−1); gate i sits at x = 1000 + i·1300, so gate.x − 300 drops just before it.
   ncert: which idea of the chapter the level practises.
   map: the level's island on the voyage map (1920×1080): levels 1–5 run left→right, 6–10 come back right→left. */
(function (SB) {
  'use strict';
  /* The level each tool is taught in, following the chapter. A level shows only tools it has reached
     (and can use); a missing tool can still unlock early, just in time, when the ship needs it (game.js topUp). */
  SB.TOOL_LEVEL = { addB: 1, addS: 2, takeB: 4, takeS: 5, pair: 7 };
  SB.LEVELS = [
    { id: 1, map: [230, 520], world: 'Sunny Shore', name: 'Lift-off', min: -4, max: 10,
      start: { b: 0, s: 0 }, crate: { b: 10, s: 0 }, gates: [1, 3, 4, 6, 7, 9], par: 9,
      ncert: 'Positive integers as heights above sea level (0). Starting height + Movement = Target height.',
      intro: ['We start at sea level: height 0. Zero is neither positive nor negative.', 'Each orange balloon is (+1). Add balloons to rise to each gate!'] },
    { id: 2, map: [600, 540], world: 'Sunny Shore', name: 'Gentle Landing', min: -4, max: 10,
      start: { b: 8, s: 0 }, crate: { b: 0, s: 8 }, gates: [7, 5, 4, 2, 1], par: 7,
      ncert: 'Adding a negative integer: (+8) + (−1) = (+7). A sandbag and a balloon make a zero pair.',
      intro: ['Each blue sandbag is (−1).', 'Adding a negative number moves us DOWN. Watch the zero pairs link up!'] },
    { id: 3, map: [960, 520], world: 'Coral Isle', name: 'Splashdown', min: -8, max: 6,
      start: { b: 2, s: 0 }, crate: { b: 0, s: 9 }, gates: [1, 0, -2, -3, -5, -6], par: 8,
      ncert: 'Crossing zero into negative integers (below sea level), as on the number line.',
      intro: ['Below sea level, heights are negative.', 'Keep adding (−1) to dive under the water!'] },
    { id: 4, map: [1320, 540], world: 'Storm Peaks', name: 'Cut Loose', min: -4, max: 10,
      start: { b: 9, s: 0 }, crate: { b: 0, s: 0 }, gates: [8, 6, 5, 3, 1, 0], par: 9,
      ncert: 'Subtraction with tokens: taking away positives. (+9) − (+1) = (+8).',
      intro: ['No sandbags in the crate today!', 'Subtracting means taking tokens away. Cut balloons to come down.'] },
    { id: 5, map: [1690, 520], world: 'Storm Peaks', name: 'Drop the Weight', min: -8, max: 6,
      start: { b: 0, s: 7 }, crate: { b: 0, s: 0 }, gates: [-6, -5, -3, -2, -1, 0], par: 7,
      ncert: 'Subtracting a negative: taking away (−1) tokens. (−7) − (−1) = (−6).',
      intro: ['We are deep at (−7), and the crate is empty.', 'Take away a sandbag: subtracting (−1) makes us go UP!'] },
    { id: 6, map: [1690, 860], world: 'Lagoon Edge', name: 'Choose Wisely', min: -6, max: 8,
      start: { b: 3, s: 2 }, crate: { b: 4, s: 4 }, gates: [3, 0, 2, -2, 1, -1], par: 16,
      ncert: 'Net value of a mixed set of tokens; choosing to add or subtract.',
      intro: ['3 balloons and 2 sandbags: 2 zero pairs cancel, so we are at (+1).', 'Add OR take away: choose the smartest moves!'] },
    { id: 7, map: [1320, 840], world: 'Zero-Pair Lagoon', name: 'Zero-Pair Lagoon', min: -4, max: 8,
      start: { b: 2, s: 0 }, crate: { b: 0, s: 0, pair: true }, gates: [4, 3, 6, 5, 7], par: 16,
      ncert: 'When the tokens to remove are not there, add zero pairs first: (+2) − (−2) = (+4).',
      intro: ['We need to go UP, but there are no balloons and no sandbags to drop!', 'Add zero pairs (they add 0), then take away the sandbags.'] },
    { id: 8, map: [960, 860], world: 'Zero-Pair Lagoon', name: 'Pair Puzzle', min: -8, max: 4,
      start: { b: 0, s: 3 }, crate: { b: 0, s: 0, pair: true }, gates: [-5, -3, -6, -4, 0], par: 18,
      ncert: '(−3) − (+2) = (−5): add zero pairs first, then take away the (+1) tokens.',
      intro: ['Only zero pairs in the crate again.', 'To go down, we must take away (+1) balloons. Add pairs first!'] },
    { id: 9, map: [600, 840], world: 'Deep Trench', name: "Navigator's Challenge", min: -8, max: 10, mode: 'plan',
      startHeight: 4, gates: [-3, 6, -2, 5, -5, 2], par: 6,
      ncert: 'Target height − Starting height = Movement needed. (−3) − (+4) = (−7).',
      intro: ['Plan the whole move before we fly.', 'Movement needed = Target height − Starting height.'] },
    { id: 10, map: [230, 860], world: 'Deep Trench', name: 'Gull Gusts', min: -6, max: 10,
      start: { b: 4, s: 0 }, crate: { b: 6, s: 6 }, gates: [5, -2, 3, 0, 4, -1], par: 27,
      gulls: [700, 2000, 3300, 5900],
      ncert: 'Mixed practice: surprise (−1) tokens are added; keep the net value right.',
      intro: ['Watch out: cheeky gulls drop sandbags on us!', 'Every surprise sandbag adds (−1). Fix our height and fly on!'] }
  ];
})(window.SB);
