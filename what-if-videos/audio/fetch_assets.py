"""Download the licensed sound effects and music used by episodes into assets/sfx and assets/music.

Sources: Mixkit (mixkit.co) — Sound Effects Free License and Stock Music Free License:
free to use inside videos (including commercial social media); the files themselves must not be
redistributed, so they are not committed to the repository. Run this once after cloning.

usage: python3 audio/fetch_assets.py
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = {
    # crowd and people
    '446': 'crowded beach ambience', '455': 'male crowd whispering voices', '361': 'city downtown crowd ambience',
    '964': 'female astonished gasp', '965': 'female shocked gasp', '966': 'male astonished gasp',
    '351': 'trailer screaming people', '376': 'rioting crowd', '469': 'people moaning sadly',
    # places
    '2678': 'urban city ambience at night', '1193': 'beach waves with children', '1185': 'sea waves with birds',
    '1195': 'close sea waves loop', '1206': 'sea coast breaking waves', '1789': 'summer night crickets loop',
    '1153': 'blizzard cold winds', '2407': 'strong wild wind in a storm', '653': 'space soundscape',
    # tension and transitions
    '493': 'fast heartbeat', '494': 'slow heartbeat', '497': 'cinematic heartbeat ambience', '492': 'cinematic mystery heartbeat',
    '790': 'cinematic trailer riser', '632': 'cinematic drama riser', '645': 'cinematic synth riser', '678': 'trailer cinematic suspense swell',
    '1022': 'cinematic sci fi glitch', '2563': 'broken radio frequency signal',
    '1492': 'cinematic whoosh fast transition', '1486': 'cinematic tunnel reverb woosh', '2408': 'storm coming whoosh', '2918': 'epic trailer whoosh impact',
    '788': 'big cinematic impact', '2896': 'movie intro impact', '2915': 'blockbuster suspense impact', '546': 'mystery trailer drum hit',
    '724': 'trailer apocalypse horn', '2297': 'bass rumble hum', '563': 'drum deep impact',
    # disaster
    '1651': 'vintage manual fire siren', '1644': 'europe ambulance siren', '1296': 'thunder deep rumble', '1718': 'rocket rumble distant',
    '1703': 'explosion with rocks debris', '1686': 'underground explosion impact echo', '759': 'glass break with hammer thud', '1701': 'explosion and glass debris',
    '1150': 'introduction bell',
}
MUSIC = {'614': 'Silent Descent', '871': 'Fright Night', '464': 'Sci-Fi Score'}

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return
    r = subprocess.run(['curl', '-sfL', '-m', '120', '-o', path, url])
    print(('ok   ' if r.returncode == 0 else 'FAIL ') + os.path.basename(path), flush=True)

os.makedirs(os.path.join(ROOT, 'assets', 'sfx'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'assets', 'music'), exist_ok=True)
for i in SFX:
    wav = os.path.join(ROOT, 'assets', 'sfx', f'{i}.wav')
    get(f'https://assets.mixkit.co/active_storage/sfx/{i}/{i}.wav', wav)
    if not os.path.exists(wav) or os.path.getsize(wav) < 1000:
        # a few items only exist as mp3
        if os.path.exists(wav): os.remove(wav)
        get(f'https://assets.mixkit.co/active_storage/sfx/{i}/{i}-preview.mp3', os.path.join(ROOT, 'assets', 'sfx', f'{i}.mp3'))
for i in MUSIC:
    get(f'https://assets.mixkit.co/music/{i}/{i}.mp3', os.path.join(ROOT, 'assets', 'music', f'{i}.mp3'))
