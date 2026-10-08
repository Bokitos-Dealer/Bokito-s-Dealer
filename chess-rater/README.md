# Chess Rater

Makes **"I rated ___ like a chess game"** videos for TikTok and Instagram Reels. You give it
a movie or TV clip and a list of "moves" (who said what, how good it was, and a line of
commentary). It renders a finished 1080×1920 MP4 with:

- the hook title above the clip, with the red "like a chess game" accent
- chess.com-style player tags (White at the bottom, Black at the top) and a live eval bar
- name labels that follow every face: main characters by name, everyone else as NPC 1, NPC 2…
  (the same extra keeps the same number), and a label disappears when its face is covered
- move badges (`!!` brilliant, `!` great, ★ best, 👍 excellent, ✓ good, 📖 book, `?!`, `?`, ✕, `??`)
- freeze frames with a commentary card, read aloud by an AI voice in chess.com Game Review
  coach style ("The Kiss is brilliant!") while the words light up
- a coach character (an owl in big round glasses) that pops up on each rating banner and
  lip-syncs to the narrator: smug on good moves, shook on bad ones
- background music under the commentary
- the official chess.com sounds, used the way popular edits do: a plain move sound for normal
  moves, capture for the big ones, castling for openers, a chime when a great or brilliant card
  lands, and game-start when the Game Review opens
- a cold-open hook that teases the big move, then cuts back to the start
- a closing **Game Review** with accuracy scores, move counts and the result

Everything runs locally and needs no paid services. The voice-over uses
[Kokoro](https://github.com/thewh1teagle/kokoro-onnx), a free text-to-speech model.

## Setup (once)

1. Install [ffmpeg](https://ffmpeg.org/download.html) and Python 3.10+.
2. In this folder:

   ```sh
   pip install -r requirements.txt
   ```

The first render downloads the voice model (about 340 MB) into `models/`, the chess.com
sound files into `sounds/`, and the background music into `music/`. The music is
"Be Chillin" by Alexander Nakarada, released into the public domain (CC0) on FreePD, so it's
free to use in posted videos. Pick another FreePD track by name to fit the scene's mood, for
example `"music": {"track": "Behind Enemy Lines"}` for a tense one (the mock-trial project uses
it). Use `"music": {"file": "my-track.mp3"}` for your own track,
`"level_db"` to set how far it sits under the voice (default −16 dB), or `"music": false` to
turn it off. The sounds are fetched from chess.com's site and aren't stored in
this repo. Set `"sfx": false` to turn them off, or point `"sounds"` at a folder with your own
`move-self.mp3`, `capture.mp3`, and so on.

## Example projects

`projects/charade.json` rates the ski-lodge scene from *Charade* (1963). The film is in the US
public domain, so this one is safe to post on Instagram and TikTok. Fetch the clip with:

```sh
mkdir -p clips
ffmpeg -ss 180 -i "https://archive.org/download/charade-1963-cary-grant-audrey-hepburn-walter-matthau-1080p-reup/Charade%20%281963%29%20Cary%20Grant%2C%20Audrey%20Hepburn%2C%20Walter%20Matthau%2C%20James%20Coburn%2C%20George%20Kennedy%3B%201080p%5D.ia.mp4" \
  -t 280 -c copy -avoid_negative_ts make_zero clips/charade-lodge.mp4
python chessrate.py projects/charade.json
```


`projects/suits-mike-rachel.json` rates Mike and Rachel's late-night scene from *Suits*, as
posted on the official Suits YouTube channel. The clip isn't included in this repo. Save your
own copy as `clips/suits-mike-rachel.mp4`. If you saved the video and audio as separate files,
merge them first:

```sh
mkdir -p clips
ffmpeg -i videoplayback.mp4 -i videoplayback.m4a -map 0:v -map 1:a -c copy clips/suits-mike-rachel.mp4

python chessrate.py projects/suits-mike-rachel.json        # -> out/suits-mike-rachel.mp4
```

The times in the project file match that upload (4:11, ending in the Suits end card). A
different copy of the scene will need its times re-checked with `scout.py`.

`projects/suits-mock-trial.json` rates the Season 5 mock trial: Mike gets help from Benjamin,
then claims Rachel is his wife so she can't testify, and Harvey plays the prosecutor. Save that
upload (4:22, also ending in the end card) as `clips/suits-mock-trial.mp4` the same way.
Benjamin plays for Mike's side only in the opening scene, and Jessica is labelled as the
arbiter.

`projects/suits-interview.json` rates Mike's interview with Harvey from the pilot, from 3:11 of
the official "Mike Ross Interview with Harvey Specter" clip (8:53) saved as
`clips/suits-interview.mp4`. Donna plays for Harvey's side at the door, and the Louis scene in
the middle is cut out.

## Making a new video

1. **Pick a scene.** The best ones are 1–3 minutes of back-and-forth between two sides: a
   negotiation, an interview, an argument, a flirt or a bluff. Someone should clearly "win".
2. **Scout it.** `python scout.py clips/scene.mp4 --from 120 --to 250` writes a transcript
   with timestamps and a contact sheet of every shot with a 10×10 grid. The transcript needs
   `pip install faster-whisper`. Use the sheet to pick avatar spots and check who says what.
3. **Write the project file.** Copy `projects/suits-interview.json` and edit it (format below).
   Five or six voiced cards plus 20–30 quick badges is about right for 2–3 minutes. Name
   labels, badge spots and card sides are automatic, so a project only needs the moves.
4. **Check it.**
   - `python chessrate.py projects/scene.json --timeline` prints the edit and where every
     move lands.
   - `--preview 12,40.5,88` writes PNG stills to `out/preview/`.
   - `--range 30:60` renders only part of the video.
   - `--no-voice` skips the voice-over for quick drafts.
5. **Render.** `python chessrate.py projects/scene.json` writes `out/scene.mp4`.

## Project file

All times are in seconds **of the source clip**. (The comments below are only there to
explain the fields; real JSON files can't contain them.) Positions (`x`, `y`, `badge`) are fractions
of the video frame: `0,0` is top-left and `1,1` is bottom-right.

```jsonc
{
  "source": "../clips/suits-mike-rachel.mp4",
  "title": {"text": "I rated Mike and Rachel's late-night kiss", "accent": "like a chess game"},
  "voice": "am_michael:0.6+am_onyx:0.4",   // the series narrator: a deep blend of two Kokoro voices
  "pitch": 0,                     // semitones up or down (formants kept)
  "speed": 1.08,
  "coach": {"enabled": true, "size": 220},  // the owl on the rating banners
  "music": {"level_db": -16},     // background music under the commentary
  "coach_intro": true,            // voice-over opens like the chess.com coach: "In Here is a great move!"
  "sfx_volume": 0.7,              // chess.com sounds: move/capture on badges, check on bad cards, game start/end
  "crop": "auto",                 // trims letterbox bars; or [w, h, x, y]; or false
  "players": {
    "white": {"name": "Rachel Zane", "short": "Rachel",
              "avatar": {"t": 106.8, "x": 0.34, "y": 0.47, "size": 0.5}},  // face crop from the clip
    "black": {"name": "Mike Ross", "short": "Mike", "avatar": "mike.png"},  // or an image file
    // a main-storyline character who joins partway through: gets ratings, joins a team's tag
    // ("Mike & Louis") from `joins` (clip time) on, and gets a column in the Game Review
    "louis": {"name": "Louis Litt", "short": "Louis", "team": "black", "joins": 203.7,
              "avatar": {"t": 230.4, "x": 0.365, "y": 0.21, "size": 0.36}}
  },
  "hook": {                       // optional cold open: plays up to a card move, then rewinds
    "from": 187.45,
    "move": "The Kiss",           // name of a move that has a "comment"
    "vo": "The Kiss is brilliant! But how did Rachel get here? Let's review the game."
  },
  "segments": [[44.6, 113.85], [122.72, 137.0]],   // the parts of the clip to use, in order
  "review": {"at": 226.0, "result": "1-0 · Rachel wins", "vo": "Good game! White wins."},
  "labels": "auto",               // the default: face-tracked labels (see "Name labels" below)
  "faces": {
    "cast": {"Undercover Cop": [{"t": 247.0, "x": 0.48, "y": 0.32}]},  // name other people
    "pins": [[229.24, 0.53, 0.35, "Harvey"]]  // [t, x, y, name] for faces too small to recognise
  },
  "moves": [
    // a quick badge: shows for ~3 s while the clip keeps playing
    {"t": 59.44, "side": "black", "class": "excellent", "name": "Stealing From Us",
     "note": "Straight to the point.", "eval": -0.3},
    // a card: freezes the clip, and the voice reads "comment" (or "vo" if given)
    {"t": 93.0, "side": "white", "class": "great", "name": "In Here",
     "comment": "Mike read the files once, so he already has them. White is better.",
     "eval": 1.2}
  ]
}
```

- **`class`** is one of `brilliant`, `great`, `best`, `excellent`, `good`, `book`,
  `inaccuracy`, `mistake`, `miss`, `blunder`. Accuracy in the Game Review is worked out from
  these. You can override it with `"review": {"accuracy": {"white": 91.2, "black": 78.0}}`.
- **`eval`** is the evaluation *after* the move: positive favours White, negative favours
  Black. Use `"1-0"` or `"0-1"` for checkmate. Moves without `eval` leave the bar where it is.
- **`t`** for a card should sit just after the line ends and before the next shot cut, so
  the freeze lands on the right face. The scout transcript gives the end time of every word.
  Keep it at least a couple of frames (0.07 s) before the cut, or the freeze can grab the
  first frame of the next shot.
- **`review.hold_at`** picks the frame held under the Game Review (a clip time). Use it when
  the clip ends in a transition into an end card.
- **Badges and cards** are placed automatically: the badge goes next to the speaker's head (or
  somewhere clear if they're off screen), never over a face, a name label, a player tag or a
  card, and clear of the TikTok/Reels buttons; a card goes on the side that covers fewer faces.
  To place one by hand, give the move `"badge": [x, y]` or `"card": "left"`/`"right"`.
- **Other characters**: anyone from the main storyline who joins in goes under `players` with a
  `team` and a `joins` time, and their moves use their key as `side` (`"side": "louis"`). Add
  `leaves` (clip time) when they drop out of the scene, and their avatar leaves the team's tag.
  Random extras get a label only: `NPC 1`, `NPC 2`, and so on. A judge or referee who only
  rules on things is labelled as the arbiter ("Jessica (Arbiter)") and doesn't get moves.
- **Name labels** (`"labels": "auto"`, the default) come from face tracking (`faces.py`, needs
  `pip install opencv-python-headless`; the models download on first use). Every player is
  recognised from their avatar spot; add anyone else from the main story under `faces.cast`
  with a point on their face. Everyone else is an extra and gets `NPC 1`, `NPC 2`, … in the
  order viewers meet them, keeping the same number when they come back. A label follows its
  face, fades when someone walks in front or the person turns away, and switches exactly on
  cuts. Faces that are tiny or blurry can't be recognised reliably, so they're numbered as
  extras unless you pin a name on them (`faces.pins`); check the wide shots in a preview.
  `faces.hide` lists names not to label, and `extra_labels` adds fixed text labels
  (`[from, to, text, x, y]`), such as "Jessica (Arbiter)". A project can still give
  `"labels"` as a list of fixed labels instead of `"auto"`. The face analysis takes about 40
  seconds per minute of footage the first time and is cached after that.
- **`voice`** can be one Kokoro voice (`"am_fenrir"`) or a weighted blend
  (`"am_michael:0.6+am_onyx:0.4"`). Leave out `voice` and `pitch` to get the series narrator.
  Keep the same voice across videos so the account has one recognisable host.
- **The coach** sprites are in `assets/coach/`. To restyle the character, edit
  `tools/coach_sprites.cjs` (plain SVG) and run `node tools/coach_sprites.cjs` (needs Playwright).
- **Timing**: the freeze lasts as long as the voice-over, so keep each comment short: one or two
  sentences, about 10–15 words.

## Rating guide

Rate lines the way chess.com rates moves, and don't inflate the ratings:

| Rating | Use it for | How often |
|---|---|---|
| Brilliant `!!` | the single best line, usually a "sacrifice" that wins anyway | once per video at most |
| Great `!` | the only reply that saves or wins the exchange | 1–2 |
| Best ★ | the strongest possible reply in that moment | a few |
| Excellent 👍 | clever, strong lines | often |
| Good ✓ | solid, normal lines | most common |
| Book 📖 | standard openers ("Hi, nice to meet you") | opening only |
| Inaccuracy `?!` / Mistake `?` / Blunder `??` | weak, bad and game-losing lines | as deserved |

The voice-over opens with the move and its rating, the way the chess.com coach does ("In Here
is a great move!"), so the comment shouldn't repeat it. After that, make it funny: one or two
short lines with a clear attitude, Gen Z slang and a bit of swearing. For example: *"She said his
mind is amazing, and he hit her with thanks? Bro, that's dry as hell."* or *"Two seconds ago he
was defending Jenny. Now he's kissing back. Bro is cooked."* Mild words (damn, hell) are fine.
Heavy swearing can get a video's reach limited on TikTok.
Check every quote and speaker against the clip. The scout transcript and contact sheet are
there for that.

## Posting

- The output is 1080×1920, 30 fps, H.264 + AAC, loudness-normalised for social apps. It
  uploads straight to TikTok, Reels and Shorts.
- Cards and badges keep clear of the right-hand like/comment/share buttons.
- The hook matters most: open on the most surprising move, and make the title name someone
  people know.
- **Copyright:** clips from shows under copyright (like *Suits*) can get muted, taken down or
  earn strikes, even with commentary over them. Public-domain films (for example *Charade*,
  *His Girl Friday* and *Night of the Living Dead*) and footage you have rights to are safe.
