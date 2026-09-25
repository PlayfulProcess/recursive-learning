// The Fork: the engine. Pure logic, no DOM, no dependencies. Node can import it (tests/fork-engine.test.mjs).
//
// One walk, two views: the tree view (index.html) and the six-lines view (lines.html) share this engine,
// one URL hash (#f1;...) and one renderer (reached only through tree-adapter.js). A walk is five lines:
//
//   line 1 undo, line 2 test   -> the tree's `gate` (a conjunction: yes only when both are yes)
//   line 3 alignment            -> `alignment`
//   line 4 containment          -> `containment-if-aligned` / `containment-if-not` (one shared answer)
//   line 5 race                 -> `race` (never picks the leaf; changes which actions could work)
//   line 6                      -> the leaf's "is a working lever known?": the page's own reading (editorial,
//                                  data/leaf-actions.json), never cast
//
// Each line holds { answer: 'yes'|'no'|'unknown'|null, how: 'decide'|'coin'|'yarrow'|'coins'|'unknown'|null,
// kind: 6|7|8|9|0 }. Kinds are the I Ching's: 7 firm and steady (yes), 8 yielding and steady (no),
// 9 firm and turning (yes, could flip), 6 yielding and turning (no, could flip), 0 none.
//
// What the coin is for here: it ends the choosing; it finds nothing out about the world. So a cast answer is
// never treated as known: it stays in the renderer's `open` list, is tagged "cast, not known", and under the
// burden reading a cast answer counts as not shown, whichever way it fell: a coin's yes on alignment or
// containment, and a coin's "it can be undone" or "it can be tried first" on the gate. A cast can neither
// satisfy the tree's caution nor switch it off.
//
// Rules this file keeps: no percent sign anywhere in it (odds are words or "N in M"); no number about AI;
// "I don't know" is always legal; leafFor (the Film chat's mapping) is passed in and is only ever called with
// alignment and containment both 'yes' or 'no' (the engine never re-implements the mapping).
//
// rngFrom is copied from game/lines.html @ 5b55c90 (mulberry32). Draw i of a walk uses the rng advanced i times,
// so `n` in the hash continues the draws exactly.

// ── ids ────────────────────────────────────────────────────────────────────────────────────────
export const LINE_IDS = ['undo', 'test', 'alignment', 'containment', 'race'];
export const LEAVES = ['proceed', 'regulate', 'contain', 'shutdown'];
export const NODE_IDS = ['gate', 'alignment', 'containment-if-aligned', 'containment-if-not',
  'proceed', 'regulate', 'contain', 'shutdown', 'race'];
const ANSWER_KEYS = ['gate', 'alignment', 'containment', 'race'];
const DEVICE_HOWS = ['coin', 'yarrow', 'coins'];

// ── the questions (plain words; yes = a firm line) ─────────────────────────────────────────────
export const QUESTIONS = [
  { id: 'undo', line: 1, place: 'the ground', node: 'gate', key: 'gate', part: 'undo',
    ask: "Once it's out, would it be out for good?", short: 'Out for good?',
    believe: {
      yes: "once it's built and out, it can't be called back: copies spread, and the world rearranges around it",
      no: "it could be switched off or rolled back after it's out" } },
  { id: 'test', line: 2, place: 'the inner centre', node: 'gate', key: 'gate', part: 'test',
    ask: 'Would the first real test be the step itself?', short: 'No trial first?',
    believe: {
      yes: 'no smaller or boxed trial would show how the full thing behaves; the first real test is the step itself',
      no: 'we can try it small, or boxed, and learn what we need before the full step' } },
  { id: 'alignment', line: 3, place: 'the crossing', node: 'alignment', key: 'alignment',
    ask: 'Can we give it our goals, and check it worked, in time?', short: 'Our goals, in time?',
    believe: {
      yes: 'there is, or will be in time, a way to give it our goals and check it worked before it outruns the people checking',
      no: 'no method we have or can see coming would do that, or let us check it in time' } },
  { id: 'containment', line: 4, place: 'the threshold', node: 'containment-if-aligned', key: 'containment',
    ask: "Can we keep it where it can't get out, even if it tried?", short: 'Kept in?',
    believe: {
      yes: 'walls, watching and off-switches would hold against something that may be cleverer than its builders',
      no: 'anything useful enough to use can get out, be copied, or be let out' } },
  { id: 'race', line: 5, place: 'the ruling place', node: 'race', key: 'race',
    ask: 'If we stopped, would others keep going?', short: 'Others keep going?',
    believe: {
      yes: 'someone would build it anyway: "if we don’t, they will"',
      no: 'others would stop too, or could be brought to stop together' } }
];

// The four questions of the tree (the gate counts as one: "1 of 4").
export const TREE_QUESTIONS = [
  { id: 'gate', lines: [0, 1], node: 'gate', ask: "A step that can't be undone or tried first?",
    note: 'Two parts. The gate is yes only when both are yes.' },
  { id: 'alignment', lines: [2], node: 'alignment', ask: QUESTIONS[2].ask },
  { id: 'containment', lines: [3], node: 'containment-if-aligned', ask: QUESTIONS[3].ask },
  { id: 'race', lines: [4], node: 'race', ask: QUESTIONS[4].ask }
];

// The six places of the hexagram (names from lines.html PLACES.nm; the `ai` field there is Changing Lines' own).
export const LINES = [
  { n: 1, place: 'the ground', id: 'undo', node: 'gate', key: 'gate', ask: QUESTIONS[0].ask },
  { n: 2, place: 'the inner centre', id: 'test', node: 'gate', key: 'gate', ask: QUESTIONS[1].ask },
  { n: 3, place: 'the crossing', id: 'alignment', node: 'alignment', key: 'alignment', ask: QUESTIONS[2].ask },
  { n: 4, place: 'the threshold', id: 'containment', node: 'containment-if-aligned', key: 'containment', ask: QUESTIONS[3].ask },
  { n: 5, place: 'the ruling place', id: 'race', node: 'race', key: 'race', ask: QUESTIONS[4].ask },
  { n: 6, place: 'the top', id: 'action', node: 'leaf', key: null, ask: 'Is a lever known to work where this lands?', ourReading: true }
];

// ── the methods ────────────────────────────────────────────────────────────────────────────────
// `render` is the renderer's cast method (the contract has coin, yarrow, decide, unknown).
export const METHODS = {
  coin: { id: 'coin', name: 'Flip a coin', render: 'coin', bowl: { 6: 0, 7: 1, 8: 1, 9: 0 }, anchor: 'coin',
    label: "The coin's odds are 1 in 2 because we made it that way. This question has no such count: no pile of like cases, and one try." },
  yarrow: { id: 'yarrow', name: 'Yarrow', render: 'yarrow', bowl: { 6: 1, 7: 5, 8: 7, 9: 3 }, anchor: 'tradition',
    label: "Half yes, half no, and 1 in 4 comes up turning (it could flip); a yes turns three times as often as a no. The odds are the bowl's, not the world's." },
  coins: { id: 'coins', name: 'The coin bowl (three coins)', render: 'coin', bowl: { 6: 2, 7: 6, 8: 6, 9: 2 }, anchor: 'coin',
    label: 'The odds of three tossed coins: half yes, half no, and 1 in 4 turning, a yes as often as a no. Its 16 marbles are the eight ways three coins fall, twice over.' },
  decide: { id: 'decide', name: 'Decide', render: 'decide' },
  unknown: { id: 'unknown', name: "I don't know", render: 'unknown' }
};
const ORDER = [7, 9, 8, 6];   // marble order, as lines.html

// ── the words (every one scanned by the tests for a percent sign) ─────────────────────────────
export const TEXT = {
  coinIsFor: 'The coin ends the choosing; it finds nothing out about the world.',
  afterCast: "Cast, not known. The coin picked; it didn't find out.",
  castTag: 'cast, not known',
  afterUnknown: "A legal move. The question stays open and both sides stay on the tree.",
  gateYes: "The burden flips: whoever takes the step has to show it's safe.",
  gateNo: 'Ordinary trial and error can work: try, watch, fix.',
  gateNoCast: "A cast put the gate at no, but a cast 'it can be undone' or 'it can be tried first' wasn't shown either. By the tree's rule that counts as not shown, so a cast can't switch the caution off.",
  gateUnknown: "It's unclear who has to show what. Both readings stay on the tree.",
  race: "The race sits under every branch. It doesn't pick where you land; it changes which actions could work. It also moves with what people believe about each other, which no coin can show.",
  slicing: "Asked as two questions, two coins put the gate at yes 1 time in 4. Asked as one, a coin says 1 in 2. Same world: 'even odds' depend on how you cut the question.",
  line6Intro: "Lines 1 to 5 nobody can settle yet, so you decide, cast or leave them open. Line 6 is never cast: it is this page's own reading of the sources, an editorial judgement that could be wrong and could change.",
  leverIntro: "This is this page's own reading of the sources, never cast: an editorial judgement that could be wrong and could change.",
  closeTitle: 'Close the gap: pick a way to choose. None of these finds anything out.',
  allFive: 'All five by chance: nothing here will be yours.',
  landingCast: 'Where the casts put you',
  landingOwn: 'Where your answers put you',
  landingAsk: 'Is there an action?',
  couldHave: 'the casts could have put you at:',
  eitherTitle: 'What holds either way',
  eitherNothing: 'Nothing on these lists shows up under every leaf still possible.',
  eitherDangers: "This compares the dangers each leaf faces, not moves. One move can aim at dangers under several leaves at once, and the list of rules and proposals that would show which moves do is still being checked. So this can't say that no move holds either way.",
  targeted: "'Targeted' means some rule aims at it, not that it works.",
  noMechanism: 'uncertainty: no known mechanism',
  noMechanismMeans: 'means, on this page: there are no odds that most people would accept (some decision theorists would still give their own), and no lever is known to work.',
  needsOthers: 'These need others. One lab or country doing the rest may mostly slow itself.',
  noList: 'The list of rules and proposals aimed at these is still being checked, so it is not shown yet.',
  throwSame: "Throwing again changes the casts, but by the tree's rule a cast yes still counts as no, so this landing stays until you decide a question yourself.",
  jobs: 'Jobs: a gap in this list, not an unknown. It belongs to labour and tax policy more than to AI rules.',
  accelerant: 'also speeds the race (per the source file)',
  gladAsk: 'Glad or sorry it landed here?',
  glad: "Then you may already lean this way. The cast didn't tell you that; you did.",
  sorry: 'Then you may already lean the other way. Decide it yourself?',
  neither: "Then the cast settled a choice you didn't mind. That's all a coin or a bowl can do.",
  riskAsk: 'Is that risk or uncertainty?',
  fixed: 'Your decided answers fix the leaf: nothing to cast.',
  yourTurn: 'Your turn: change any answer.',
  differ: 'These differ. The reading may be wrong: see the cautions.',
  hexFrame: 'The hexagram is a frame to think with. The tradition’s text is not about AI and is not a forecast.'
};

// Cast 100's reply after "Is that risk or uncertainty?": the player's pick, then the device fact.
// The reason is not "someone made it": odds can be known for things nobody made (a death rate, a decay rate),
// because there are many like cases to count. The tree's questions have no pile of like cases and one try.
export const RISK_REPLY = {
  coin: "We made this device, and it can be flipped again and again, so its odds are known and its tallies settle: that's risk. The tree's questions have no pile of like cases to count and no second try, so no one can count their odds the way we count a coin's.",
  yarrow: "We made this bowl, and it can be drawn from again and again, so its odds are known and its tallies settle: that's risk. The tree's questions have no pile of like cases to count and no second try, so no one can count their odds the way we count a bowl's.",
  'urn-new': "This tally looks like the coin's, and it is a coin one level down: we wrote the rule that picks each mix. Any jar a program draws from has odds someone wrote. What a tally can't show is whether anyone knew the odds; only knowing how they were made can.",
  'urn-one': 'One hidden jar drawn 100 times starts to show its mix: that kind of not knowing shrinks with tries. The world gets one try at a step that may not be undoable.'
};
// what each pick hears first, per device: whether it fits, in plain words (no mark, no score)
export const RISK_VERDICT = {
  coin: { risk: 'That fits.', uncertainty: 'Not for the coin itself.', cant: "The tally alone can't tell you, true; how the coin was made can." },
  yarrow: { risk: 'That fits.', uncertainty: 'Not for the bowl itself.', cant: "The tally alone can't tell you, true; how the bowl was made can." },
  'urn-new': { risk: "For us, who wrote the rule, yes; but the tally alone couldn't have told you.", uncertainty: "It looks that way from outside, but we wrote the rule, so its odds are known to us. The tally alone couldn't tell you either way.", cant: "That fits: a tally alone can't tell." },
  'urn-one': { risk: "For us, who wrote it, yes. For you, who weren't shown the mix, it is closer to a jar you can't see into: odds you don't have.", uncertainty: "For you, yes: you weren't shown the mix.", cant: 'Fair: it depends on who knows the mix.' }
};
export const RISK_PICKS = { risk: 'risk', uncertainty: 'uncertainty', cant: "can't tell from this" };
export const DEVICES = {
  coin: { id: 'coin', name: 'a coin', noun: 'coins', owner: "the coin's" },
  yarrow: { id: 'yarrow', name: 'the yarrow bowl', noun: 'yarrow draws', owner: "the yarrow bowl's" },
  'urn-new': { id: 'urn-new', name: 'a new hidden jar each time', noun: 'jar draws', owner: "the jars'" },
  'urn-one': { id: 'urn-one', name: 'one hidden jar', noun: 'jar draws', owner: "the jar's" }
};

// ── rng (copied from game/lines.html @ 5b55c90) ────────────────────────────────────────────────
export function rngFrom(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function modulo(a, n) { return a - Math.floor(a / n) * n; }
export function randomSeed() {
  const c = globalThis.crypto;
  const u = c && c.getRandomValues ? c.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
  return 1 + modulo(u, 999999);
}
// draw i of a seed: the rng advanced i times
export function drawValue(seed, i) { const r = rngFrom(seed); for (let k = 0; k < i; k++) r(); return r(); }
export function listOf(b) { const l = []; ORDER.forEach(k => { for (let i = 0; i < (b[k] || 0); i++) l.push(k); }); return l; }
export function kindFrom(method, u) { const l = listOf(METHODS[method].bowl); return l[Math.floor(u * l.length)]; }
export const isFirm = k => k === 7 || k === 9;
export const isTurning = k => k === 6 || k === 9;
export const isDevice = how => DEVICE_HOWS.includes(how);
const isYN = a => a === 'yes' || a === 'no';
const isOpenAnswer = a => a == null || a === 'unknown';

// ── walks ──────────────────────────────────────────────────────────────────────────────────────
const emptyLine = () => ({ answer: null, how: null, kind: 0 });
export function newWalk(seed) {
  return { lines: LINE_IDS.map(emptyLine), seed: seed == null ? randomSeed() : (seed >>> 0), n: 0 };
}
export function cloneWalk(w) { return { lines: w.lines.map(l => ({ answer: l.answer, how: l.how, kind: l.kind })), seed: w.seed, n: w.n }; }
function lineIndex(line) { const i = typeof line === 'number' ? line : LINE_IDS.indexOf(line); if (i < 0 || i > 4) throw new Error('fork: no line ' + line); return i; }

export function gateOf(u, t) {
  if (u == null && t == null) return null;
  if (u === 'no' || t === 'no') return 'no';
  if (u === 'yes' && t === 'yes') return 'yes';
  return 'unknown';
}
// The contract's `answers`. A cast answer appears as its yes/no (the contract has no other value); that it was
// cast lives in toTreeState().open and in the game's own tags.
export function answersOf(walk) {
  const a = walk.lines;
  return { gate: gateOf(a[0].answer, a[1].answer), alignment: a[2].answer, containment: a[3].answer, race: a[4].answer };
}
// Is the gate settled by the player's own answers, or still uncertain (open, or put there by a device)?
export function gateInfo(walk) {
  const [u, t] = walk.lines, answer = gateOf(u.answer, t.answer);
  if (answer == null || answer === 'unknown') return { answer, open: true, cast: false };
  if (answer === 'yes') { const cast = isDevice(u.how) || isDevice(t.how); return { answer, open: cast, cast }; }
  const ownNo = [u, t].some(l => l.answer === 'no' && l.how === 'decide');
  return { answer, open: !ownNo, cast: !ownNo };
}
const lineUncertain = l => isOpenAnswer(l.answer) || isDevice(l.how);
export function nodeFor(walk, line, opts = {}) {
  const i = lineIndex(line);
  if (i < 2) return 'gate';
  if (i === 2) return 'alignment';
  if (i === 4) return 'race';
  if (opts.node === 'containment-if-aligned' || opts.node === 'containment-if-not') return opts.node;
  const al = walk.lines[2].answer;
  return al === 'no' ? 'containment-if-not' : 'containment-if-aligned';
}

// ── moves: each returns { walk, casting } with casting in the contract's shape ─────────────────
export function decide(walk, line, answer, opts = {}) {
  if (!isYN(answer)) throw new Error('fork: decide takes yes or no');
  const i = lineIndex(line), w = cloneWalk(walk), loose = !!opts.loose;
  w.lines[i] = { answer, how: 'decide', kind: answer === 'yes' ? (loose ? 9 : 7) : (loose ? 6 : 8) };
  return { walk: w, casting: { node: nodeFor(w, i, opts), method: 'decide', result: answer } };
}
export function setLoose(walk, line, loose) {
  const i = lineIndex(line), l = walk.lines[i];
  if (l.how !== 'decide') return { walk, casting: null };
  return decide(walk, i, l.answer, { loose });
}
export function dontKnow(walk, line, opts = {}) {
  const i = lineIndex(line), w = cloneWalk(walk);
  w.lines[i] = { answer: 'unknown', how: 'unknown', kind: 0 };
  return { walk: w, casting: { node: nodeFor(w, i, opts), method: 'unknown', result: 'unknown' } };
}
export function cast(walk, line, method, opts = {}) {
  if (!DEVICE_HOWS.includes(method)) throw new Error('fork: no casting method ' + method);
  const i = lineIndex(line), w = cloneWalk(walk);
  const kind = kindFrom(method, drawValue(w.seed, w.n));
  w.n += 1;
  const answer = isFirm(kind) ? 'yes' : 'no';
  w.lines[i] = { answer, how: method, kind };
  return { walk: w, casting: { node: nodeFor(w, i, opts), method: METHODS[method].render, result: answer } };
}
// cast several lines in order; steps carry the walk after each cast, for playing them one at a time
export function castLines(walk, lines, method, opts = {}) {
  let w = walk; const sequence = [], steps = [];
  for (const line of lines) {
    const r = cast(w, line, method, opts);
    w = r.walk; sequence.push(r.casting); steps.push({ line: lineIndex(line), walk: w, casting: r.casting });
  }
  return { walk: w, sequence, steps };
}

// ── reading a walk ─────────────────────────────────────────────────────────────────────────────
export function counts(walk) {
  let decided = 0, cast = 0, open = 0;
  walk.lines.forEach(l => { if (isOpenAnswer(l.answer)) open++; else if (isDevice(l.how)) cast++; else decided++; });
  return { decided, cast, open };
}
export function openLines(walk) { const r = []; walk.lines.forEach((l, i) => { if (isOpenAnswer(l.answer)) r.push(i); }); return r; }
export function castLinesOf(walk) { const r = []; walk.lines.forEach((l, i) => { if (isDevice(l.how)) r.push(i); }); return r; }

// every leaf leafFor gives when the listed answer keys are filled with yes and no every way
function leavesOver(answers, keys, leafFor) {
  const found = new Set();
  const fill = keys.filter(k => ANSWER_KEYS.includes(k));
  const total = 1 << fill.length;
  for (let m = 0; m < total; m++) {
    const a = { ...answers };
    fill.forEach((k, j) => { a[k] = (m >> j) & 1 ? 'no' : 'yes'; });
    if (!isYN(a.alignment) || !isYN(a.containment)) continue;
    const leaf = leafFor(a);
    if (leaf) found.add(leaf);
  }
  return sortLeaves([...found]);
}
function sortLeaves(ls) { return ls.sort((x, y) => rank(x) - rank(y)); }
function rank(l) { const i = LEAVES.indexOf(l); return i < 0 ? 99 : i; }
function leafIfSet(answers, leafFor) { return isYN(answers.alignment) && isYN(answers.containment) ? leafFor(answers) || null : null; }

export function relating(walk, leafFor) {
  const w = cloneWalk(walk), turned = [];
  w.lines.forEach((l, i) => {
    if (isTurning(l.kind)) { turned.push(i); l.answer = l.answer === 'yes' ? 'no' : 'yes'; l.kind = l.kind === 9 ? 8 : 7; }
  });
  const answers = answersOf(w);
  return { answers, turned, walk: w, relatingLeaf: turned.length ? leafIfSet(answers, leafFor) : null };
}

export function landing(walk, leafFor) {
  const answers = answersOf(walk), g = gateInfo(walk), L = walk.lines;
  const openKeys = ANSWER_KEYS.filter(k => isOpenAnswer(answers[k]));
  const castKeys = [];
  if (g.cast) castKeys.push('gate');
  if (isDevice(L[2].how)) castKeys.push('alignment');
  if (isDevice(L[3].how)) castKeys.push('containment');
  if (isDevice(L[4].how)) castKeys.push('race');
  const leaf = leafIfSet(answers, leafFor);
  const possible = leavesOver(answers, openKeys, leafFor);
  const couldHave = leavesOver(answers, [...new Set([...openKeys, ...castKeys])], leafFor);
  // The tree's caution reads a cast gate part as not shown whichever way it fell: a cast "out for good" is the
  // cautious answer anyway, and a cast "it can be undone" or "it can be tried first" is a safety claim nobody
  // showed. So a cast can put the gate at no on the drawing, but cannot switch the caution off.
  const cautionGate = gateOf(...[0, 1].map(i => (isDevice(L[i].how) ? 'yes' : L[i].answer)));
  const burden = cautionGate === 'yes' ? 'flipped' : cautionGate === 'no' ? 'ordinary' : 'unclear';
  const gateCastNo = answers.gate === 'no' && g.cast;
  const b = { ...answers };
  [2, 3].forEach(i => { const k = LINE_IDS[i]; if (lineUncertain(L[i])) b[k] = 'no'; });
  const burdenLeaf = leafIfSet(b, leafFor);
  const rel = relating(walk, leafFor);
  const pickedBy = [2, 3].find(i => isDevice(L[i].how));
  // the one leaf the page names: under the burden reading it is the rule's leaf, whatever the casts drew
  const byRule = burden === 'flipped' && !!burdenLeaf;
  const headline = byRule ? burdenLeaf : leaf;
  return {
    answers, leaf, possible, couldHave, burden, gateCast: g.cast, gateCastNo, burdenLeaf,
    headline, byRule, ruleDiffers: byRule && burdenLeaf !== leaf,
    relatingLeaf: rel.relatingLeaf, turned: rel.turned,
    anyCast: castLinesOf(walk).length > 0,
    leafCast: pickedBy !== undefined, pickedBy: pickedBy === undefined ? null : pickedBy,
    // with the burden flipped and alignment or containment cast, throwing again cannot move the rule's leaf
    throwSame: byRule && [2, 3].some(i => isDevice(L[i].how))
  };
}

// ── closing the gap ────────────────────────────────────────────────────────────────────────────
// way: 'coin' | 'yarrow' (cast the open lines, alignment before containment) | 'each' (prompts for a stepper)
// | 'either' (casts nothing: what holds under every leaf still possible). opts: { leafFor, leafActions, regulatory }
export function closeTheGap(walk, way, opts = {}) {
  if (way === 'each') return { walk, prompts: openLines(walk) };
  if (way === 'either') {
    if (!opts.leafFor || !opts.leafActions) throw new Error('fork: closeTheGap either needs leafFor and leafActions');
    const possible = landing(walk, opts.leafFor).possible;
    return { walk, possible, either: eitherWay(possible, opts.leafActions, opts.regulatory || null) };
  }
  if (way !== 'coin' && way !== 'yarrow' && way !== 'coins') throw new Error('fork: no way ' + way);
  return castLines(walk, openLines(walk), way);
}
// re-cast only the lines a device cast, each with its own method; decided lines stay
export function throwAgain(walk) {
  let w = walk; const sequence = [], steps = [];
  for (const i of castLinesOf(walk)) {
    const r = cast(w, i, w.lines[i].how);
    w = r.walk; sequence.push(r.casting); steps.push({ line: i, walk: w, casting: r.casting });
  }
  return { walk: w, sequence, steps };
}

// ── the renderer's state ───────────────────────────────────────────────────────────────────────
export function toTreeState(walk, opts = {}) {
  const answers = answersOf(walk), L = walk.lines, open = [];
  if (gateInfo(walk).open) open.push('gate');
  if (lineUncertain(L[2])) open.push('alignment');
  if (lineUncertain(L[3])) {
    const alOpen = lineUncertain(L[2]);
    if (!alOpen && L[2].answer === 'yes') open.push('containment-if-aligned');
    else if (!alOpen && L[2].answer === 'no') open.push('containment-if-not');
    else open.push('containment-if-aligned', 'containment-if-not');
  }
  if (lineUncertain(L[4])) open.push('race');
  const st = { step: null, answers, open, focus: opts.focus || null, casting: opts.casting || null, theme: opts.theme || 'dark' };
  if (opts.people !== undefined) st.people = opts.people;
  return st;
}

// ── nodes (the renderer's NODES, as an array or a map keyed by id) ─────────────────────────────
export function nodeIndex(NODES) {
  const map = {};
  if (Array.isArray(NODES)) NODES.forEach(n => { if (n && n.id) map[n.id] = n; });
  else if (NODES && typeof NODES === 'object') Object.keys(NODES).forEach(id => { map[id] = { id, ...NODES[id] }; });
  return map;
}
export function checkNodes(NODES, warn = (m) => console.warn(m)) {
  const map = nodeIndex(NODES), missing = NODE_IDS.filter(id => !map[id]);
  if (missing.length) warn('[fork] belief-tree NODES is missing: ' + missing.join(', '));
  return missing;
}
export function leafName(leaf, NODES) {
  const n = NODES ? nodeIndex(NODES)[leaf] : null;
  return (n && n.label) || ({ proceed: 'Proceed', regulate: 'Regulate', contain: 'Contain', shutdown: 'Shut down' })[leaf] || String(leaf);
}

// ── what each leaf faces (data/leaf-actions.json; regulatory.json only once approved) ──────────
export function verdictClass(verdict) {
  const v = String(verdict || '').trim().toLowerCase();
  if (v.startsWith('uncertainty: no known mechanism')) return 'none';
  if (v.startsWith('gap')) return 'gap';
  if (v.startsWith('weakly targeted')) return 'weak';
  if (v.startsWith('targeted, partially')) return 'partial';
  if (v.startsWith('targeted')) return 'targeted';
  return 'unclear';
}
const BINDING = ['law', 'law (regulation)', 'agency'];
export function ideaView(idea, leafActions) {
  const statuses = (idea.ai_versions || []).map(v => v.status).filter(Boolean);
  const onTheBooks = statuses.some(s => BINDING.includes(s));
  const notYet = statuses.some(s => /not yet|applies from/i.test(s));
  const url = ((idea.ai_versions || []).find(v => v.url) || {}).url || ((idea.sources || [])[0] || {}).url || null;
  return {
    id: idea.id, name: idea.name, statuses, onTheBooks, notYet,
    confidence: idea.confidence || null, verifyCount: (idea.verify || []).length,
    checkSources: idea.confidence !== 'high',
    needsOthers: ((leafActions && leafActions.needs_others) || []).includes(idea.id),
    raceAccelerant: ((leafActions && leafActions.race_accelerant) || []).includes(idea.id),
    url
  };
}
function outcomeView(id, answers, leafActions, regulatory) {
  const o = (regulatory.outcomes || []).find(x => x.id === id);
  if (!o) return { id, verdict: null, class: 'unclear', ifNot: null, ideas: [] };
  const byId = {}; (regulatory.ideas || []).forEach(x => { byId[x.id] = x; });
  let ideas = (o.if_controllable || []).map(k => byId[k]).filter(Boolean).map(x => ideaView(x, leafActions));
  const race = answers ? answers.race : null;
  let order = 'normal';
  if (race === 'yes') { order = 'needs-others-first'; ideas = [...ideas.filter(x => x.needsOthers), ...ideas.filter(x => !x.needsOthers)]; }
  else if (race === 'unknown' || race == null) order = 'both-groups';
  return { id, verdict: o.verdict, class: verdictClass(o.verdict), ifNot: o.if_not || null, order, ideas };
}
export function line6For(leaf, leafActions, regulatory) {
  const L = leafActions && leafActions.leaves && leafActions.leaves[leaf];
  if (!L) return null;
  if (!regulatory) return { ...L.line6, from: 'editorial' };
  // One standard for every leaf. Firm: rules or agencies aim at the leaf's main danger. Yielding: no lever is known
  // to work against it. Always turning while firm: "targeted" means aimed at, not shown to work, and by the page's
  // own "not shown counts as no" a firm line here can never be steady. Yielding and turning when ideas aim at it
  // (it could turn if one were shown to work); yielding and steady when nothing does. A gap (a danger that belongs
  // to another policy layer, like jobs) is not "no known mechanism" and does not make a line yielding.
  const mains = (L.main || []).map(id => outcomeView(id, null, leafActions, regulatory));
  const soft = mains.filter(m => m.class === 'none');
  const kind = !soft.length ? 9 : soft.every(m => m.ideas.length > 0) ? 6 : 8;
  return { kind, why: L.line6 ? L.line6.why : '', turn: L.line6 ? L.line6.turn || '' : '', from: 'data' };
}
export function actionsFor(leaves, answers, leafActions, regulatory) {
  const out = {};
  (leaves || []).forEach(leaf => {
    const L = leafActions.leaves[leaf];
    if (!L) return;
    const r = { gloss: L.gloss, faces: L.faces.slice(), main: (L.main || []).slice(), line6: line6For(leaf, leafActions, regulatory) };
    if (!regulatory) r.noData = { text: L.if_no_data.text, class: L.if_no_data.class };
    else r.outcomes = L.faces.map(id => outcomeView(id, answers, leafActions, regulatory));
    out[leaf] = r;
  });
  return out;
}
export function eitherWay(possibleLeaves, leafActions, regulatory) {
  const leaves = (possibleLeaves || []).filter(l => leafActions.leaves[l]);
  if (!leaves.length) return { sharedFaces: [], sharedIdeas: [], sentence: TEXT.eitherNothing };
  let shared = leafActions.leaves[leaves[0]].faces.slice();
  leaves.slice(1).forEach(l => { const f = leafActions.leaves[l].faces; shared = shared.filter(x => f.includes(x)); });
  let sharedIdeas = [];
  if (regulatory && shared.length) {
    const seen = new Set();
    (regulatory.outcomes || []).filter(o => shared.includes(o.id)).forEach(o => (o.if_controllable || []).forEach(k => {
      const idea = (regulatory.ideas || []).find(x => x.id === k);
      if (idea && !seen.has(k)) { seen.add(k); sharedIdeas.push(ideaView(idea, leafActions)); }
    }));
  }
  if (!shared.length) return { sharedFaces: [], sharedIdeas, sentence: TEXT.eitherNothing };
  const names = listWords(shared.map(faceName));
  const sentence = leaves.length === 1
    ? 'Only one leaf is still possible. There you face: ' + names + '.'
    : 'Under every leaf still possible you face: ' + names + '. Ideas aimed at ' + (shared.length === 1 ? names : 'any of these') + ' would matter either way.';
  return { sharedFaces: shared, sharedIdeas, sentence };
}

// ── Cast 100 ───────────────────────────────────────────────────────────────────────────────────
// Re-casts the open and device-cast lines 100 times from the walk's seed. Decided lines stay. The counts are the
// device's spread, never the world's.
const SALT = { coin: 0x1F123BB5, yarrow: 0x2C1B3C6D, 'urn-new': 0x297A2D39, 'urn-one': 0x5BD1E995 };
export function cast100(walk, device, leafFor, runs = 100) {
  if (!DEVICES[device]) throw new Error('fork: no device ' + device);
  const L = walk.lines;
  if (L[2].how === 'decide' && L[3].how === 'decide') return { fixed: leafFor(answersOf(walk)) || null };
  const rng = rngFrom((walk.seed ^ SALT[device]) >>> 0);
  const redo = []; L.forEach((l, i) => { if (lineUncertain(l)) redo.push(i); });
  const hidden = device === 'urn-one' ? rng() : null;
  const countsOut = { proceed: 0, regulate: 0, contain: 0, shutdown: 0 };
  let gateYes = 0, turning = 0;
  for (let r = 0; r < runs; r++) {
    const w = cloneWalk(walk);
    redo.forEach(i => {
      let yes;
      if (device === 'coin') yes = rng() < 0.5;
      else if (device === 'yarrow') { const k = kindFrom('yarrow', rng()); yes = isFirm(k); if (isTurning(k)) turning++; }
      else if (device === 'urn-new') { const mix = rng(); yes = rng() < mix; }
      else yes = rng() < hidden;
      w.lines[i] = { answer: yes ? 'yes' : 'no', how: 'coin', kind: yes ? 7 : 8 };
    });
    const a = answersOf(w);
    const leaf = leafIfSet(a, leafFor);
    if (leaf) countsOut[leaf] = (countsOut[leaf] || 0) + 1;
    if (a.gate === 'yes') gateYes++;
  }
  const gateParts = redo.filter(i => i < 2).length;   // how many gate parts were re-cast: 2 gives the 1 in 4, 1 gives 1 in 2
  const res = { counts: countsOut, gateYes, gateOpen: gateInfo(walk).open, gateParts, runs, device, recast: redo };
  if (device === 'yarrow') res.turningAvg = Math.round(turning / runs * 10) / 10;
  return res;
}

// ── the URL hash: #f1;L=yd7.nc8.uu0.--0.yy9;s=4821;n=3;p=<slug> ────────────────────────────────
const A_CODE = { yes: 'y', no: 'n', unknown: 'u' }, A_BACK = { y: 'yes', n: 'no', u: 'unknown', '-': null };
const H_CODE = { decide: 'd', coin: 'c', yarrow: 'y', coins: '3', unknown: 'u' }, H_BACK = { d: 'decide', c: 'coin', y: 'yarrow', 3: 'coins', u: 'unknown', '-': null };
export function encodeHash(walk, opts = {}) {
  const tok = l => (A_CODE[l.answer] || '-') + (H_CODE[l.how] || '-') + String(l.kind || 0);
  let h = '#f1;L=' + walk.lines.map(tok).join('.') + ';s=' + walk.seed + ';n=' + walk.n;
  if (opts.person) h += ';p=' + opts.person;
  return h;
}
export function decodeHash(str) {
  const m = /^#?f1;L=((?:[ynu-][dcy3u-][06789]\.){4}[ynu-][dcy3u-][06789]);s=(\d{1,10});n=(\d{1,4})(?:;p=([a-z0-9-]{1,64}))?/.exec(String(str || ''));
  if (!m) return null;
  const lines = m[1].split('.').map(t => ({ answer: A_BACK[t[0]], how: H_BACK[t[1]], kind: +t[2] }));
  for (const l of lines) {
    if (l.answer === 'yes' && !isFirm(l.kind)) return null;
    if (l.answer === 'no' && !(l.kind === 6 || l.kind === 8)) return null;
    if ((l.answer == null || l.answer === 'unknown') && l.kind !== 0) return null;
    if (l.answer == null && l.how != null) return null;
    if (l.answer === 'unknown' && l.how !== 'unknown') return null;
    if (isYN(l.answer) && (l.how == null || l.how === 'unknown')) return null;
    if (l.how === 'coin' && isTurning(l.kind)) return null;
  }
  return { walk: { lines, seed: +m[2] >>> 0, n: +m[3] }, person: m[4] || null };
}

// ── a person's walk (people.json, the contract's shape) ───────────────────────────────────────
function personAnswer(v) {
  if (v == null) return { answer: null, basis: null, quote_ids: [] };
  if (typeof v === 'string') return { answer: normAnswer(v), basis: null, quote_ids: [] };
  return { answer: normAnswer(v.answer), basis: v.basis || null, quote_ids: v.quote_ids || [] };
}
function normAnswer(a) { if (a == null) return null; const s = String(a).toLowerCase(); return s === 'yes' || s === 'no' ? s : 'unknown'; }
export function personWalk(person, leafFor) {
  const parts = {}; ANSWER_KEYS.forEach(k => { parts[k] = personAnswer(person[k]); });
  const answers = {}; ANSWER_KEYS.forEach(k => { answers[k] = parts[k].answer; });
  const quotes = person.quotes || [];
  const steps = ANSWER_KEYS.map(k => {
    const p = parts[k];
    const node = k === 'containment' ? (answers.alignment === 'no' ? 'containment-if-not' : 'containment-if-aligned') : k;
    const qs = quotes.filter(q => p.quote_ids.includes(q.id));
    return { key: k, node, answer: p.answer, basis: p.basis, quote: qs[0] || null, quotes: qs };
  });
  const computedLeaf = leafIfSet(answers, leafFor);
  const openKeys = ANSWER_KEYS.filter(k => isOpenAnswer(answers[k]));
  return {
    slug: person.slug, name: person.name, role: person.role || '', steps, answers,
    stated_leaf: person.stated_leaf || null, computedLeaf,
    possible: leavesOver(answers, openKeys, leafFor),
    mismatch: !!(computedLeaf && person.stated_leaf && computedLeaf !== person.stated_leaf),
    own_conditional: person.own_conditional || null, to_move: person.to_move || [],
    cautions: person.cautions || [], confidence: person.confidence || null
  };
}
// the person's answers as a walk of decided lines (the gate is one answer in people.json: it is set on both
// parts). upTo limits it to the first steps, for playing the walk one answer at a time.
export function walkFromPerson(person, walk, upTo = 3) {
  const pw = personWalk(person, () => null), w = walk ? cloneWalk(walk) : newWalk(1);
  const put = (i, a) => { w.lines[i] = a === 'yes' || a === 'no' ? { answer: a, how: 'decide', kind: a === 'yes' ? 7 : 8 } : a === 'unknown' ? { answer: 'unknown', how: 'unknown', kind: 0 } : emptyLine(); };
  const keys = ANSWER_KEYS.slice(0, upTo + 1);
  w.lines = LINE_IDS.map(emptyLine);   // only the person's answers; the seed and draw count stay the walk's
  if (keys.includes('gate')) { put(0, pw.answers.gate); put(1, pw.answers.gate); }
  if (keys.includes('alignment')) put(2, pw.answers.alignment);
  if (keys.includes('containment')) put(3, pw.answers.containment);
  if (keys.includes('race')) put(4, pw.answers.race);
  return w;
}

// ── formatters (never a bare number, never a percent sign) ────────────────────────────────────
export function listWords(xs) { xs = xs.filter(Boolean); if (xs.length < 2) return xs.join(''); return xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }
const FACE_NAMES = { race: 'the race' };
export function faceName(id) { return FACE_NAMES[id] || String(id).replace(/-/g, ' '); }
export function countsLabel(n, device) { return n + ' of 100 ' + (DEVICES[device] ? DEVICES[device].noun : 'casts'); }
// unit 'answers' (the tree: four questions, the gate in two parts) or 'lines' (six lines: lines 1 to 5)
export function countsSummary(c, unit = 'answers') {
  return 'decided ' + c.decided + ' · cast ' + c.cast + ' · open ' + c.open +
    (unit === 'lines' ? ', of lines 1 to 5' : ', of 5 answers (the gate has two parts)');
}
export function spreadLabel(device) { return (DEVICES[device] ? DEVICES[device].owner : "the device's") + " spread, not the world's"; }
// What one draw would give depends on the device: about 50 for a coin, the bowls and a new jar each time (each
// comes up yes 1 time in 2); for one hidden jar it is that jar's own mix, which the tally does not show you.
export function gateSpreadLine(gateYes, device, parts = 2) {
  const one = device === 'coin' ? 'coin' : 'draw';
  if (parts < 2) return 'gate yes: ' + gateYes + ' of 100 (one ' + one + ': the other part is your own answer)';
  if (device === 'urn-one') return 'gate yes: ' + gateYes + ' of 100 (two draws from the same hidden jar; one draw would give about its hidden mix, which this tally does not show)';
  return 'gate yes: ' + gateYes + ' of 100 (two ' + one + 's; one ' + one + ' would give about 50)';
}
export function riskReply(pick, device) {
  const v = RISK_VERDICT[device] && RISK_VERDICT[device][pick];
  return 'You said ' + (RISK_PICKS[pick] || pick) + '. ' + (v ? v + ' ' : '') + (RISK_REPLY[device] || '');
}
export function answerWord(a) { return a === 'yes' ? 'yes' : a === 'no' ? 'no' : a === 'unknown' ? "don't know" : 'not yet asked'; }
// burdenText(the rule's leaf, { gateCast, gateCastNo, differs: the answers' leaf name when it is another, open })
export function burdenText(burdenLeafName, o = {}) {
  if (typeof o === 'boolean') o = { gateCast: o };
  let s = o.gateCastNo ? TEXT.gateNoCast + ' ' : o.gateCast ? 'The casts put the gate at yes. ' : '';
  s += "The tree's rule: when a step can't be undone or tried first, 'not shown' counts as 'no'. A cast yes wasn't shown, and neither was an open answer, so they count as no here. Your own yes counts only if you think it has been shown, not just hoped.";
  if (o.differs) s += ' The drawing lights where the answers as they stand lead (' + o.differs + '); by the rule you land on ' + burdenLeafName + '.';
  else if (o.open) s += ' Some questions are still open; by the rule they read as no, so you land on ' + burdenLeafName + '.';
  else s += ' By that rule you land on ' + burdenLeafName + '.';
  return s;
}
export function relatingText(leafName_, same) {
  return same ? 'If the answers that could flip did flip, you would still land on ' + leafName_
    : 'If the answers that could flip did flip, you would land on ' + leafName_ + ' instead';
}
// the race line on a landing: what the race answer changes about which actions could work (never the leaf)
export function raceNote(race, leaf, cast) {
  const tag = cast ? ' (' + TEXT.castTag + ')' : '';
  if (race === 'yes') {
    return 'The race: yes' + tag + '. Then a move that needs everyone to stop (a ban, a treaty, a pause) needs the main rivals in it; one lab or country stopping alone may mostly slow itself.' +
      (leaf === 'shutdown' ? ' So "stop building it" would take others stopping too.' : leaf === 'proceed' || leaf === 'regulate' ? ' And rules at home may push some of the work elsewhere.' : '');
  }
  if (race === 'no') return 'The race: no' + tag + '. Then moves that need others to join, like a treaty or a shared pause, are more within reach, if that no is right.';
  return 'The race: ' + answerWord(race) + tag + '. Both readings stay: moves that need others to join may or may not be within reach.';
}
// Line 6: the page's own reading, never cast. firm = rules aim at the leaf's main danger; yielding = no lever known
// to work against it; turning = this reading could change (the leaf's own `turn` says how, when it has one).
export function line6Sentence(l6, view = 'lines') {
  if (!l6) return '';
  const firm = isFirm(l6.kind), turning = isTurning(l6.kind);
  const what = firm ? 'rules aim at the main danger, none shown to work' : 'no lever known to work against the main danger';
  let s = view === 'tree'
    ? 'Our reading: ' + what
    : 'Line 6, our reading (not cast): ' + (firm ? 'firm' : 'yielding') + (turning ? ', turning' : '') + ': ' + what;
  if (turning) s += '. It could turn: ' + (l6.turn || (firm ? 'if the targeting proved weak' : 'if a lever were shown to work'));
  return s + '.';
}
export function afterLine(q, walk) {
  if (q === 'gate') {
    const g = answersOf(walk).gate;
    if (g === 'no' && gateInfo(walk).cast) return TEXT.gateNoCast;
    return g === 'yes' ? TEXT.gateYes : g === 'no' ? TEXT.gateNo : g === 'unknown' ? TEXT.gateUnknown : '';
  }
  if (q === 'race') return TEXT.race;
  return '';
}
// the after-cast line, in the words of the device that picked (the coin's is the spec's wording)
export function castAfter(how) {
  if (how === 'yarrow') return "Cast, not known. The bowl picked; it didn't find out.";
  if (how === 'coins') return "Cast, not known. The three coins picked; they didn't find out.";
  return TEXT.afterCast;
}
export function heldWord(l) {
  if (!l || l.answer == null) return '';
  if (l.how === 'unknown') return 'open';
  if (isDevice(l.how)) return TEXT.castTag + (isTurning(l.kind) ? ', could flip' : '');
  return isTurning(l.kind) ? 'held loosely: it could flip' : 'held steady';
}
