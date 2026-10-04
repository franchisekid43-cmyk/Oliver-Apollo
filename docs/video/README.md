# Philindo One videos: source

The 2-minute explainer (1920 × 1080, 60 fps) built from the team launch slides, 4 October 2026.

| File | What it does |
|---|---|
| `make-layers.mjs` | Opens each slide of the team launch deck in a browser and saves every part of it (headline, text, cards, screens) as its own transparent PNG at its exact place, plus `manifest.json`. Needs the deck's slide files and screenshots. |
| `edit.jsx` | The Higgsedit scene script: the drifting green glow behind everything, each layer rising in with a blur-in on an expo-out curve, screens with motion blur and a slow push, green section slides wiping up from the bottom, scenes overlapping by 0.6 s. Durations per slide are at the top. |

To re-render on Higgsfield: in its sandbox, unzip the layers into `/home/user/vid/layers`, then run
`higgsedit build edit.jsx` and `higgsedit render /home/user/vid/p60 --out renders/philindo-one-explainer.mp4`.

The screenshots show real client names and amounts, so the video and its layers are for the team only. Don't post
them publicly.

## The 43-second promo (4 October 2026)

`promo.jsx` builds the promo in the same structure as the reference reel (Intro → Problem → Use case → Call to action),
natively in Higgsedit:
- the name with the phone and popping icon tiles;
- word-by-word lines with green payoff words;
- the scattered tools pulled into a ring;
- the port and ship footage;
- the monitor with a search;
- the phone with live updates;
- the green end card.

It needs `assets/` (the deck screenshots and logo) plus `port.mp4` and `sea.mp4`. Those are two Kling 3.0 clips made on
Higgsfield for 8.75 credits each.

Before building, register Inter in the project: `higgsedit fonts add p60 Inter:400 Inter:600 Inter:700 Inter:900`.
Without it the text falls back to a wider font.
