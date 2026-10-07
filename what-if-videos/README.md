# What If… video engine

Makes vertical (1080×1920, 30 fps, ~80 s) "What if…" disaster videos in the style of the TikTok trend:
a low-poly 3D city, a serif title over the opening shot, a HUD counter on the left
(small label / big number / tiny sub-label), short italic captions every few seconds,
a "HERE"/"NOW" climax, a fade to black and an end card with a real fact.

Everything is generated: three.js scenes rendered frame-by-frame in headless Chromium,
synthesised sound design (no samples), encoded with ffmpeg.

## Episodes

| id | title |
|---|---|
| `solar-storm` | What if a solar superstorm hit tonight? |
| `ice-melt` | What if all the ice on Earth melted? |
| `hurricane` | What if the strongest hurricane ever recorded hit your city? |

Finished videos land in `output/<id>.mp4` (full 1080p master, ~12 Mbps) and `output/share/<id>-preview.mp4` (720p, under 30 MB).

## Setup

```sh
npm install                      # three, fonts, playwright
pip install numpy scipy          # audio synth
# needs ffmpeg and a Chromium that Playwright can find
```

## Rendering

```sh
node render.mjs ice-melt --preview 1,20,40,60     # stills + contact sheet in output/ice-melt/preview/
node render.mjs ice-melt --workers 2 --resume --then-encode   # full render → output/ice-melt.mp4
node render.mjs ice-melt --encode                 # re-encode only (after changing audio or the end card)
```

Rendering uses software WebGL, about 1–2 s per frame (~40 min per episode on 4 cores).
`--resume` skips frames already on disk, so an interrupted render picks up where it stopped.

## Your handle on the end card

Edit `brand.json`:

```json
{ "handle": "@yourhandle", "name": "" }
```

The end card starts at 70.2 s, so after changing it you only need to redraw those frames:

```sh
rm output/<id>/frames/02[1-3]*.jpg
node render.mjs <id> --from 70 --resume --then-encode
```

## Making a new episode

Copy a scenario in `scenarios/` and edit it. A scenario exports:

- `title`, `endFact` (end-card fact, `<br>` for a line break), `duration`, `fadeOut`, `endAt`
- `captions`: `[start, end, text]` — keep each under ~45 characters
- `hud(t)`: returns `{ label, value, sub }` for time `t`
- `audio`: cue list for `audio/synth.py` (ambience, drone, boom, zap, rain, thunder, water, glass, chime, …)
- `setup(ctx)`: build the scene with the engine helpers in `engine/lib/`
  (`buildCity`, `buildSky`, `buildWater`, `buildTrees`, `buildCars`, `buildPeople`, `buildBalcony`, `GlowLayer`, `Particles`)
- `update(ctx, t, dt)`: animate; set `ctx.cam` (pos/look/fov), `ctx.shake`, `ctx.flash`, `ctx.crack`, `ctx.rain`

Animation must depend only on time and seeded randomness (`Rng`), never `Math.random`,
so a render can be resumed or split across workers and still match.
