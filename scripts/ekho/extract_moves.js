// Pull GROUPS (the odds board's moves) out of five-futures-draft-1.html and write the Sources lens.
const fs = require('fs');
const [,, htmlPath, walkPath, outPath] = process.argv;
const html = fs.readFileSync(htmlPath, 'utf8');
const js = html.split('<script>')[1].split('</script>')[0];
const start = js.indexOf('var GROUPS = [');
const end = js.indexOf('var NS =');
const DQ = 'https://youtu.be/qDzg-xvkeXw?t=', KR = 'https://youtu.be/bcpQkvBCACw?t=';
const GROUPS = eval('(function(){' + js.slice(start, end) + '; return GROUPS;})()');

// The Walk's seven endings, read from spread.html's CARDS (credits, upright, reversed)
const spread = fs.readFileSync(walkPath, 'utf8');
const cs = spread.indexOf('var CARDS = [');
const ce = spread.indexOf('];', cs) + 2;
const CARDS = eval('(function(){' + spread.slice(cs, ce) + '; return CARDS;})()');

// my five futures -> The Walk's endings (the fold, phase 0); 'd' (the quiet drift) is a ground quality, not an ending
const FOLD = { f1: ['doom'], f2: ['doom'], f3: ['lock_in'], f4: ['the_stop', 'sustainable_turn'], f5: ['grace'], d: ['drift'] };
const ROLE = { 'Advocacy · anyone': 'anyone', 'Inside the labs · builders': 'builder', 'Governments · institutions': 'institution', 'Things that happen to us': 'event', 'In every future': 'anyone' };

const voices = {};
function voiceOf(s) {
  const [url, time, who, text] = s;
  const m = url.match(/youtu\.be\/([\w-]{11})\?t=(\d+)/);
  const plain = time === 'US' || time === 'paper' || time === 'list' || who === 'HOT POTATO card 72';
  const id = m ? `${m[1]}@${m[2]}` : url;
  if (!voices[id]) voices[id] = {
    id, kind: 'voice', lens: 'sources', url, at: m ? +m[2] : null, time_label: time, speaker: who || null,
    words: plain ? null : text, note: plain ? text : null,
    verified: m ? 'matched to captions' : 'page link',
    speaker_confirmed: !/to confirm/.test(who || '')
  };
  return id;
}

const moves = [];
for (const g of GROUPS) {
  for (const a of g.acts) {
    const effects = [];
    for (const [k, v] of Object.entries(a.fx)) {
      for (const e of FOLD[k]) effects.push({ ending: e, direction: v === 'up' ? 'more_likely' : v === 'down' ? 'less_likely' : v === 'mixed' ? 'either_way' : 'less_likely_if_it_holds', basis: v === 'maybe' ? 'hypothesis' : 'argued' });
    }
    moves.push({
      id: a.id, kind: g.title.startsWith('Things that happen') ? 'condition' : 'move', lens: 'sources',
      name: a.name, note: a.note || null, who: ROLE[g.title] || 'anyone', group: g.title,
      move_kind: null, why_draft: a.why, effects, voices: a.src.map(voiceOf),
      civic_link: a.id === 'call' ? 'https://callcongress.ai' : a.id === 'groups' ? 'https://learning.recursive.eco/pages/institutions.html' : null
    });
  }
}

const endings = CARDS.map(c => ({
  id: c.k, kind: 'ending', lens: 'sources', name: c.nm, label_from: c.txt, label_link: c.link,
  what: c.src, upright: c.up, reversed: c.rev,
  folded_from: Object.entries(FOLD).filter(([, v]) => v.includes(c.k)).map(([k]) => k),
  numbers: 'toy, from game/walk-model.js only'
}));

const out = {
  _about: 'Recursive Ekho, Sources lens: what is sourced. Endings are The Walk\'s seven (game/spread.html CARDS, text copied, names borrowed as labels). Moves come from the odds-board draft (recursive-eco/docs/ai-readiness/five-futures-draft-1.html, private); every quote was matched to captions at its time. Effects are ARGUED directions, never numbers. "why_draft" lines are Claude\'s summaries, hers to rewrite. Draft, Oct 11 2026, local branch lab/recursive-ekho, not pushed.',
  lens: 'sources',
  endings, moves, voices: Object.values(voices),
  fold_of_five_futures: { f1: 'Lost control: the end -> doom', f2: 'Lost control: the host -> doom (a reading of it)', f3: 'Kept, by a few -> lock_in', f4: 'Tools, not gods -> the_stop + sustainable_turn', f5: 'Minds that care -> grace', d: 'The quiet drift -> a ground quality in every ending, not an ending' }
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log('endings', endings.length, 'moves', moves.length, 'voices', Object.keys(voices).length);
