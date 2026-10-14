# Playbook: making a "What if…" episode for @what.if.your.life

Follow this exactly. The reference episode is `scenarios/ai-jobs.js` + `scenarios/ai-jobs-set.js` (the city kit):
read both before you start, and copy their patterns.

## 0. Setup (fresh machine)

```sh
sh what-if-videos/setup.sh          # npm, pip, Kokoro voice model, Mixkit music + sfx (not in git)
```

Work on your own branch, made from `origin/what-if-videos`: `git checkout -b what-if-<id> origin/what-if-videos`.
Do not edit shared files (`engine/`, `scenarios/ai-jobs*.js`, `audio/`): if you need a variant of a kit
function, copy it into `scenarios/<id>-set.js`. Commit and push to your branch as you go, with these
trailers on every commit:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <your session URL>
```

No pull requests. Never put model names in commits.

## 0.5 The v2 standard (what the channel owner asked for after episode 1)

The owner's feedback on v1: too slow, the voice rushed with no natural stops, graphics flat, retention weak. Every
episode now follows `scenarios/internet-down.js` v2:

- **Voice:** Kokoro `{am_puck 0.6, am_michael 0.4}` (the owner picked it over Chatterbox), `speed 1.16`, `pause 0.26`,
  `beat 0.3`. Write `|` for a short human stop **only after a section opener** ("Day one. | You wake up…", "But here's
  the crazy part. | …"). The owner found stops in the middle of sentences too much: never put `|` mid-sentence.
  Gaps between lines 0.2 s (`GAP`). It should feel quick but not rushed.
- **Script:** conversational, like a person telling a friend: contractions, "honestly?", "trust me", "be honest",
  short sentences, staccato on the payoff ("Every. | Single. | Notification."). Open a loop in line 2 ("trust me,
  day seven is the wildest part"). 65–72 s total (over a minute qualifies for TikTok Creator Rewards).
- **No title card.** The hook is spoken from frame 4 (`GAP.hook 0.12`) and shown as captions immediately; hide
  `#title`.
- **Captions:** `CAPTION_CSS` from internet-down.js: Montserrat 900, uppercase, 98 px, heavy black outline,
  2–3 words per chunk (`Math.ceil(c.length / 3)`), keywords in yellow, at y ≈ 1150.
- **Picture change every 1.5–2.5 s:** shots plus `PUNCH` jump zooms (`[time, crop 0.58–0.86]`, back to 1 to reset)
  on the words that land. Punches are cuts too (`CUTS`, `shotIdx`), so motion blur never smears across them.
- **Hits:** white flash frames on every new day/act (`FLASHES`), camera shake (`SHAKES`) on each impact word, a
  whoosh into every shot and a soft click on every punch.
- **Grade:** contrast 1.17, saturation 1.16, split 0.16, vignette 0.34, bloom 0.62 at threshold 1.1; DOF aperture
  0.003.
- **Close-ups of small props** (phones, terminals): the blocky hand hides half of a real-size phone, so draw a
  1.5× hero copy offset up its own axis, and aim the camera along the screen normal (probe the instance matrix).

## 1. Topic and research

- Topics are things people actually worry about and want the outcome of.
- The hook always starts with "What if…".
- Research real numbers with web search. Every number on screen must be sourced; keep the list of links to
  give the user at the end.
- Be grounded and balanced, not fear-mongering: show what would really happen, what still works, and how
  likely it is.

## 2. Script (about 12 lines, 65–75 s of speech)

- **Line 1** is the hook: "What if …?" (≤3 s).
- **Line 2** sets the goal and an open loop, e.g. "Let's count the days… the ending might surprise you."
- Then the escalation in stages.
  - Write in second person ("you").
  - Use "but / so" causality.
  - Give one sensory detail per beat.
  - Use a number only every second or third beat, and never start a line with a number.
- A **twist** two-thirds in ("But here's what surprises everyone…").
- A **grounded outcome** ("Could this really happen?").
- End on a **question** that invites comments ("Which job do you think goes last?").
- Narration file: `scenarios/<id>.vo.json`, with
  - voice `{ "am_puck": 0.6, "am_michael": 0.4 }`
  - speed 1.08 and pause 0.3
  - see `scenarios/ai-jobs.vo.json` for an example.
- Generate it with `python3 audio/narrate.py scenarios/<id>.vo.json`, which writes `<id>.vo.js` with word timings.
- Time everything off the words: `wordT(line, word)`.

## 3. On screen

- **Title card:** `titleWords` (first half of line 1) plus `titleIcon` (SVG), shown 0–2 s. Captions start after it.
- **Captions:** word-by-word captions with keywords in gold. Show numbers as figures, in **both units/currencies**:
  - `$600 (€560)`
  - `62 miles (100 km)`
  - `°F / °C`
- **Goal bar:** one goal bar that gives the video a destination (`JOBS DONE BY AI 0→100%`, `DAY 1 → 7`). Add ticks at the stages.
- **HUD counter:** a counter on the left (label / big value / value2 for the second unit / sub-line with a
  sourced fact). It pops when a stage lands.
- **Callout labels:** pinned to things in 3D (`labels(t)` → `toScreen`). Never put them over the goal bar.
- **Safe zones:** keep subjects clear of the goal bar (y 190–370), the HUD (left, y 870–1010) and the captions (y ≈1240–1320).

## 4. Pictures: attention all the way through

- **Pace:** something new every 2–4 s.
  - Cuts between shots.
  - Time-of-day changes.
  - Floors/windows changing state.
  - Labels popping.
  - A camera shake on hits.
- **Camera:** shots are lists of Catmull-Rom keys; a new shot is a cut. Copy `SHOTS`/`camAt`/`crAt` from `ai-jobs.js`.
  - **The frame is narrow (9:16).** The horizontal field of view is only ~56% of the vertical one. At 10 m, a
    40° lens sees about 4 m across. Check that subjects are actually in frame with previews.
  - Sub-frames never cross a cut (the guard at the top of `pose`).
  - **Never fly the camera through geometry.** City towers start at |x| > 52 m around the block. Check the
    camera path against building boxes (see the `path2.mjs` idea: sample `camAt(t)` and test against the city
    instance boxes).
  - Camera near plane 0.25, far 4200.
- **Lighting:** `todAt(t)` presets (dusk / dawn / day / dusk2), interior light by `patchInterior`, and the
  post chain:
  - bloom threshold ~1.15
  - DOF
  - AgX tonemapping
  - grade: contrast 1.1, vignette 0.3, grain 0.035
- **Night look:** warm interiors against a dark blue exterior; make one colour mean one thing (cyan = AI in ai-jobs).
- **InstancedMesh:** `count` must NEVER exceed the capacity you created it with. Drawing past the buffer gives
  random giant black/brown triangles that look like a renderer bug; this cost a day on ai-jobs. Size every
  instanced mesh from the data (`list.length`). Static furniture goes through `boxBatch` (merged meshes).
- **People** (`engine/lib/people.js`): add custom poses on `ppl.POSES`. Pass only defined keys to `ppl.add`
  (an `undefined` value overrides the defaults and crashes).
- **Determinism:** everything must be a pure function of `t` (no `Math.random`), so renders can be resumed and split.

## 5. Sound (`buildAudio`)

- **Voice:** each line as a `sample` (level 1.35, `free: true`).
- **Ducking:**
  - Music is ducked about 11 dB under the voice.
  - Sound effects (`fx: true`) step back under the voice through `fxduck`.
- **Music library:** `assets/music` (titles in `audio/fetch_assets.py`).
  - Tension: 464 "Sci-Fi Score".
  - Hopeful: 606 "Drawing the Sky".
  - Big build: 871.
- **Effects:** a whoosh on every big camera move, a hit (2896 + `subdrop`) on the climax with ~0.4 s of silence
  before it, chirps/glitches on state changes.
- **Don't mask the voice:** no thud or loud ambience in the 0.5 s before a key word. Check the full mix with Whisper:
  every line must transcribe correctly.

## 6. Preview → render → QA

```sh
node render.mjs <id> --scale 0.5 --preview 1,5,10,…            # stills + output/<id>/preview/sheet.jpg (look at them!)
setsid nohup node render.mjs <id> --scale 0.8 --workers 3 --chunks 36 --resume > output/<id>/render.log 2>&1 < /dev/null & disown
python3 -I qa/spikes.py output/<id>/frames                       # isolated spikes, jumps (= your cuts), dark shards
node render.mjs <id> --encode                                    # audio mix + output/<id>.mp4
sh share.sh <id>                                                 # output/share/<id>-1080p.mp4 (~30 MB)
```

**Render speed and process handling:**
- Rendering runs at about 6–7 s per frame overall (4 cores); a 75 s episode takes 4 h.
- Background shell tasks are capped at 2 h, so always launch the render detached (as above) and poll with
  an `until` loop.
- Kill leftover browsers with `pkill headless_shel`.
- Never `pkill -f "render.mjs …"`: the pattern matches your own shell. Use `pgrep -f "node.*render\.mjs"` and kill PIDs.

**QA:**
- Look at a contact sheet of the whole video.
- Every isolated spike above ~15 and every big jump that isn't a cut must be explained.
- After any fix, delete only the affected frames and re-render with `--resume`.

## 7. Delivery

- **No end card.** Set `endAt: 1e9` and let the last shot fade (`fadeOut`). `DURATION = FADE[1] + 0.3`.
- **The cover is a separate image, never inside the video.**
  - Make `thumbs/<id>.html` (copy `thumbs/ai-jobs.html`: a clean `--layer scene` still as background, big
    "WHAT IF …" title in Montserrat 900 with the key words in the episode colour, one short tag line).
  - Run `node thumb.mjs <id>` to get `output/share/<id>-cover.jpg`.
- Send the user `output/share/<id>-1080p.mp4` and the cover, plus a suggested caption with hashtags and the
  list of sources.
