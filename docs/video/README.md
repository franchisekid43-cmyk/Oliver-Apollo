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

## The 61-second promo, v2, with voice, music and sound (4 October 2026)

What changed from the 43-second cut: the two AI port and sea clips are gone. In their place are three scenes built on the
app's own screens, each in a browser window that rises in:
- **Cash advance:** the filled-in request scrolls, the pointer clicks Send, and the screen changes to the request
  page, with a "Sent to Finance" badge.
- **Sneak peek, Finance desk:** the "Requests to approve" box lights up green, with "Your request is in".
- **Pending shipments by account handler:** the list flicks from one handler's group to the next (Kim, Jena, Cherry,
  Jimmy), while the side menu stays put.

The port shot became a "Philindo One / One place for the whole team" title, and the sea shot became a "One place. One team." card.

| File | What it does |
|---|---|
| `promo2.jsx` | The Higgsedit script. Scene start times are in `S` at the top of the scenes. It needs `assets/` (deck screenshots and logo) and `v2/` (`ca-filled.png`, `ca-sent.png`, `finance-desk.png`, `pending.png`). |
| `promo2-capture.mjs` | Takes the three `v2/` screenshots from a local copy of the app running on the simulation database (never the live one). The Send button only works when cash advances are switched to the system, so that setting was turned on in the simulation database for the capture and removed straight after. |
| `promo2-mix.py` | Makes the sound track: the 14 voice lines placed on their scenes, the music dipped about 14 dB from just before each line until just after it, and about 50 sound effects made from scratch (whooshes on scene changes, pops, typing, the click on Send, a chime, phone dings, an end shimmer). Then it brings the whole track to −14 LUFS for social media. |

Voice: Higgsfield text-to-speech, voice "Emily", 14 lines at 0.6 credits each. Two were recorded again because the first
takes blurred a word ("processors", "port"). To change a line, generate it again and put its new length in `END` in
`promo2-mix.py`. Each line was checked with speech-to-text (Whisper) on the finished video. All of them come back word for
word except "port", which it hears as "board" under the music. The same words are on screen at that moment.

Music: "Better Times are Coming" by Alejandro Magaña, from Mixkit (`https://assets.mixkit.co/music/173/173.mp3`). Mixkit's
free licence allows commercial use with no credit needed.

Steps:
1. Build: `FPS=60 higgsedit build promo2.jsx`, then `higgsedit fonts add q60 Inter:400 Inter:600 Inter:700 Inter:900`, then build again.
2. Render: `higgsedit render q60 --out renders/promo2-60.mp4`.
3. Make the sound: put `vo0.wav`…`vo13.wav` and `music173.mp3` beside the mix script, then run `python3 promo2-mix.py` to get `mix.wav`.
4. Combine them: `ffmpeg -i promo2-60.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest out.mp4`.

The screens show real client names and amounts, so this cut is for the team only too.
