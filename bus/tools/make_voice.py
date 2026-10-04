#!/usr/bin/env python3
"""Make the recorded voice clips for the school games (bus/audio/voice/).

The game speaks by playing these clips, so it sounds the same on every device and doesn't
depend on the phone having a speech voice (Android in-app browsers, including the Claude app,
have none). The words, numbers, things to count, animals and the players' names are read from
bus/js/school.js (and the lunch foods), so after changing PROFILES or the word lists, run this again.
The train lines are listed below; keep them matching js/train.js.

Setup (once), then run from the repo root:
  python3 -m venv /tmp/tts && /tmp/tts/bin/pip install kokoro-onnx soundfile
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  /tmp/tts/bin/python bus/tools/make_voice.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin
Needs ffmpeg for the mp3s. Then bump VOICE_VERSION in bus/js/school.js.
"""
import argparse, json, os, re, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'voice')
VOICE, LANG = 'bf_isabella', 'en-gb'
MAMMY = 'bf_emma'  # Mammy's lines (keys starting m_) at home get a voice of their own
SHOPMAN = 'bm_george'  # and the ice cream shop man's (keys starting s_)  # a soft British English voice; --voice picks another (or a mix, "bf_emma:0.5,af_heart:0.5")
SPEED = 1.0  # natural talking speed: slower than this sounds robotic
NUMS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']


def read_game():
    src = open(os.path.join(ROOT, 'js', 'school.js'), encoding='utf-8').read()
    block = src[src.index('const PROFILES'):src.index('let CHILD_NAME')]
    name = re.findall(r"\{ id: '([a-z]+)', name: '([^']+)'", block)  # [(id, name)] for every player
    block = src[src.index('const LETTERS'):src.index('const NUM_WORDS')]
    letters = {}
    for m in re.finditer(r"^\s*([a-z]): \{ name: '([^']+)', words: \[(.*?)\]\](, phrase: '(\w+)')?", block, re.M):
        letters[m.group(1)] = (m.group(2), re.findall(r"\['([a-z\- ]+)', '[^']+'", m.group(3) + ']'), m.group(5) or 'for')
    block = src[src.index('const COUNT_THINGS'):src.index('const NUMBERS_PER_GO')]
    things = re.findall(r"\['[^']+', '([a-z ]+)', '([a-z ]+)'\]", block)
    block = src[src.index('const ANIMALS ='):src.index('const ANIMALS_PER_GO')]
    animals = re.findall(r"\{ name: '([a-z]+)', pic: '[^']+', say: \"([^\"]+)\" \}", block)
    block = src[src.index('const LUNCH'):src.index('const GAMES')]
    lunch = re.findall(r"\{ id: '([a-z]+)', name: '([^']+)', say: \"([^\"]+)\" \}", block)
    return name, letters, things, animals, lunch


def read_home():
    src = open(os.path.join(ROOT, 'js', 'home.js'), encoding='utf-8').read()
    block = src[src.index('const DRESS'):src.index('const TOYS')]
    dress = []
    for m in re.finditer(r"\{ cat: '(\w+)', ask: '([^']+)', icon: '[^']+', items: \[(.*?)\] \}", block):
        dress.append((m.group(1), m.group(2), re.findall(r"\['(\w+)', '([^']+)'\]", m.group(3))))
    block = src[src.index('const TOYS ='):src.index('const TOYS_PER_GO')]
    toys = re.findall(r"\{ id: '(\w+)', name: '([^']+)', pic: '[^']+', say: \"([^\"]+)\" \}", block)
    block = src[src.index('const FOODS'):src.index('const DISHES')]
    foods = re.findall(r"(\w+): \{ pic: '[^']+', name: '([^']+)', is: \"([^\"]+)\" \}", block)
    block = src[src.index('const DISHES'):src.index('const Home')]
    dishes = [(m.group(1), m.group(2).split("', '"), m.group(3).split("', '"), (m.group(4) or '').split("', '") if m.group(4) else [], m.group(5))
              for m in re.finditer(r"(\w+): \{ name: '[^']+', pic: '[^']+', sub: '[^']+', need: \['([^\]]+)'\], steps: \['([^\]]+)'\],(?: chop: \['([^\]]+)'\],)?\s*intro: \"([^\"]+)\" \}", block)]
    return dress, toys, foods, dishes


def home_clips(c, name):
    dress, toys, foods, dishes = read_home()
    for cat, ask, items in dress:
        c['d_cat_' + cat] = ask
        for iid, nm in items: c['d_%s_%s' % (cat, iid)] = nm + '!'
    for tid, nm, line in toys:
        c['to_find_' + tid] = 'Can you find the %s? %s Put it in the toy box!' % (nm, line)
        c['to_is_' + tid] = "That's the %s." % nm
        c['to_yes_' + tid] = 'Yes! The %s goes in the toy box!' % nm
    c['to_intro'] = "Uh oh! There are toys all over the floor. Let's tidy up!"
    names = {f: n for f, n, _ in foods}
    the = lambda f: 'the ' + re.sub(r'^an? ', '', names[f])
    for f, nm, line in foods: c['fw_' + f] = line
    for d, need, steps, chop, intro in dishes:
        c['m_dish_' + d] = intro
        for f in need: c['m_need_' + f] = 'We need %s! Can you find %s?' % (names[f], the(f))
        for f in chop: c['m_chop_' + f] = "Let's chop %s! Tap, tap, tap!" % the(f)
    c.update({
        'm_pick': 'What will we make for dinner? You pick!',
        'm_yes': 'Yes, that\u2019s it! Thank you!',
        'm_stir': 'Stir the pot! Round and round and round!',
        'm_stirred': 'That smells delicious! Well done!',
        'm_sauce': 'Now spread the tomato sauce all over the pizza. Rub it round and round!',
        'm_cheese': 'Now tap the pizza to put on the cheese!',
        'm_corn': 'Now the sweetcorn! Tap, tap, tap!',
        'm_bake': 'Into the oven it goes! Tap the oven door.',
        'm_wait': 'Now we wait for it to cook. Tick, tock!',
        'm_ding': "Ding! The pizza's ready!",
        'm_serve': 'Dinner is ready! Put some on each plate.',
        'm_yum': 'Mmm, this is delicious! Well done!',
        'e_allgone': 'All gone! What a yummy dinner!',
    })
    for pid, nm in name:
        c['h_hello_' + pid] = "Welcome home, %s! Let's get changed out of your school clothes. Pick your socks!" % nm
        c['d_star_' + pid] = 'You look brilliant, %s! You get a gold star!' % nm
        c['to_star_' + pid] = 'What a tidy bedroom! Well done, %s! You get a gold star!' % nm
        c['k_star_' + pid] = "Dinner's ready! You're a great cook, %s! You get a gold star!" % nm
        c['g_night_' + pid] = 'Goodnight, %s! See you tomorrow!' % nm


def clips():
    name, letters, things, animals, lunch = read_game()
    c = {}
    for l, (spoken, words, phrase) in letters.items():
        c['l_' + l] = spoken.capitalize() + '!'
        for w in words: c['f_%s_%s' % (l, w)] = '%s is %s %s!' % (spoken.capitalize(), phrase, w)
    for n in range(1, 11):
        c['n_%d' % n] = NUMS[n].capitalize() + '!'
        c['p_yes_%d' % n] = 'Yes! %s!' % NUMS[n].capitalize()
        one, many = things[(n - 1) % len(things)]
        c['c_%d' % n] = '%s %s!' % (NUMS[n].capitalize(), one if n == 1 else many)
    for one, many in things + [('kid', 'kids')]:
        c['p_how_' + many] = 'How many %s? Tap each one to count!' % many
        c['p_so_' + many] = 'So, how many %s are there?' % many
    c['p_how_kids'] = 'How many kids came to school on the bus? Tap each one to count!'
    c['p_nope'] = 'Not that one. Have another go!'
    for a, line in animals:
        c['an_' + a] = line
        c['ar_' + a] = "Yes! That's the %s!" % a
        c['aw_' + a] = "That's the %s." % a
    c['p_again'] = 'Have another go!'
    c['lu_intro'] = "It's lunch time! Put each food in its matching shape in the lunch box!"
    c['lu_nope'] = "Oops, that's not its shape. Have another go!"
    for fid, nm, line in lunch:
        c['lu_n_' + fid] = nm + '!'
        c['lu_' + fid] = line
    # the train ride home (js/train.js)
    c['t_aboard'] = 'All aboard! Press the green Go button to drive the train home!'
    c['t_coal'] = "We're running out of steam! Shovel some coal on the fire!"
    c['t_tunnel'] = 'Here comes a tunnel! Turn on the lights!'
    c['t_station'] = "There's your home station! Stop the train at the platform!"
    c['t_doors'] = 'Open the doors!'
    c['t_bye'] = 'Bye bye! See you tomorrow!'
    for pid, nm in name:
        c['p_spells_' + pid] = 'That spells %s!' % nm
        c['p_star_name_' + pid] = 'Well done, %s! You get a gold star!' % nm
        c['p_star_numbers_' + pid] = 'Brilliant counting, %s! You get a gold star!' % nm
        c['p_star_count_' + pid] = 'Great counting, %s! You get a gold star!' % nm
        c['p_star_animals_' + pid] = 'Brilliant, %s! You know your animals! You get a gold star!' % nm
        c['p_star_lunch_' + pid] = 'Yummy! Well done, %s! You packed your lunch box! You get a gold star!' % nm
        c['h_home_' + pid] = "Ding, ding! It's home time, %s! All your work is done. Let's drive the train home!" % nm
        c['p_star_train_' + pid] = 'You drove the train all the way home, %s! You get a gold star!' % nm
    home_clips(c, name)
    src = open(os.path.join(ROOT, 'js', 'stencils.js'), encoding='utf-8').read()
    for pid, line in re.findall(r"\{ id: '(\w+)', name: '[^']+', say: '([^']+)'", src): c['dr_' + pid] = line
    c['dr_pick'] = 'Pick a picture to colour in!'
    # the evening at home (js/evening.js): LINES, with {name} filled in for each player
    src = open(os.path.join(ROOT, 'js', 'evening.js'), encoding='utf-8').read()
    block = src[src.index('const LINES'):src.index('const Evening')]
    for key, text in re.findall(r'^\s*(\w+): "([^"]+)",', block, re.M):
        if '{name}' in text:
            for pid, nm in name: c[key + '_' + pid] = text.replace('{name}', nm)
        else: c[key] = text
    c['me_listen'] = 'Listen carefully!'
    c['me_again'] = "Oops! Let's listen again."
    c['me_help'] = 'Watch the numbers light up, and copy me!'
    c['me_turn'] = 'Your turn! Tap the numbers in the same order.'
    c['me_yes'] = 'Yes! You remembered them all!'
    for pid, nm in name: c['p_star_memory_' + pid] = 'Super memory, %s! You get a gold star!' % nm
    c['dr_how'] = 'Pick a colour, then tap the picture to colour it in!'
    c['dr_more'] = 'Keep going! Colour in some more of the picture.'
    for pid, nm in name: c['p_star_draw_' + pid] = 'What a beautiful picture, %s! You get a gold star!' % nm
    return name, c


def voice_style(k, spec):
    if ':' not in spec: return spec
    mix = 0
    for part in spec.split(','):
        v, w = part.split(':')
        mix = mix + k.get_voice_style(v) * float(w)
    return mix


def trim(a, sr):
    loud = np.where(np.abs(a) > 0.02)[0]
    if not len(loud): return a
    pad = int(0.04 * sr)
    return a[max(0, loud[0] - pad):loud[-1] + pad]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default=VOICE); ap.add_argument('--out', default=OUT)
    args = ap.parse_args()
    k = Kokoro(args.model, args.voices)
    style = voice_style(k, args.voice)
    mammy = voice_style(k, MAMMY)
    shopman = voice_style(k, SHOPMAN)
    lang = 'en-gb' if args.voice.startswith('b') else 'en-us'
    name, c = clips()
    os.makedirs(args.out, exist_ok=True)
    for f in os.listdir(args.out):
        if f.endswith('.mp3'): os.remove(os.path.join(args.out, f))
    with tempfile.TemporaryDirectory() as tmp:
        for key, text in c.items():
            a, sr = k.create(text, voice=mammy if key.startswith('m_') else shopman if key.startswith('s_') else style, speed=SPEED, lang=lang)
            wav = os.path.join(tmp, 'c.wav'); sf.write(wav, trim(a, sr), sr)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', '48k',
                            os.path.join(args.out, key + '.mp3')], check=True)
            print(key, '-', text)
    json.dump({'players': [n for _, n in name], 'voice': args.voice, 'clips': sorted(c)}, open(os.path.join(args.out, 'clips.json'), 'w'), indent=0)
    print(len(c), 'clips for', ', '.join(n for _, n in name))


if __name__ == '__main__':
    main()
