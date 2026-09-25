// game/fork/bowl.js: the bowl, the hexagrams and the path maths for The Fork's six-lines view (lines.html).
//
// COPIED, not imported: game/lines.html (Changing Lines) belongs to other branches, and the Recursive I Ching is
// another repo. Copies, so nothing here can break them, and nothing they change can break The Fork.
//   from game/lines.html @ 5b55c90: HEX, START (yarrow, coins), ORDER, PLACES (`nm` and `tr` only: its `ai` field
//     is Changing Lines' own reading of the six places), rngFrom, copyB, firm, turning, listOf, drawFrom, isFirm,
//     isTurning, bits, lineGlyph, kindName, marble, renderBowl, hexSVG; the tokens --firm, --yield, --turn and
//     --line live in fork.css. NOT afterDraw: every draw in The Fork comes from a fresh bowl. Adapted only so a
//     bowl may leave kinds out (the one coin is { 7: 1, 8: 1 }) and hexSVG draws a 0 as an empty slot; ES module
//     syntax instead of var.
//   from recursive-iching viewers/caster-engine.js @ b8d82df: hamming (the tests check each reading step with it).
//     Its buildPath (the path caster's direct mode) is no longer copied: Walk to a leaf is now read by the tree's
//     rule, in fork-engine.js walkToLeaf, which can ask a change of belief where no line turns.
// Below those, marked, a few helpers of The Fork's own (hexOf, isWhole, relatingSteps): pure, tested by
// tests/fork-lines.test.mjs.
//
// Bit strings run bottom to top, as in both sources: index 0 is line 1, index 5 is line 6; '1' is a firm line.
// Kinds are the I Ching's: 7 firm and steady, 8 yielding and steady, 9 firm and turning, 6 yielding and turning.
// No DOM at import (node imports this file); renderBowl touches the DOM only when it is called.
// No percent sign anywhere in this file.

// ── data (game/lines.html @ 5b55c90) ─────────────────────────────────────────────────────────────
// [number, name, symbol, chinese, lines bottom-to-top (1 = firm)] from zhouyi-core, checked there against every
// line text's NINE/SIX on Sep 22 2026 (64 of 64 agree).
export const HEX = [[1,"The Creative","䷀","乾","111111"],[2,"The Receptive","䷁","坤","000000"],[3,"Difficulty at the Beginning","䷂","屯","100010"],[4,"Youthful Folly","䷃","蒙","010001"],[5,"Waiting (Nourishment)","䷄","需","111010"],[6,"Conflict","䷅","訟","010111"],[7,"The Army","䷆","師","010000"],[8,"Holding Together [Union]","䷇","比","000010"],[9,"The Taming Power of the Small","䷈","小畜","111011"],[10,"Treading [Conduct]","䷉","履","110111"],[11,"Peace","䷊","泰","111000"],[12,"Standstill [Stagnation]","䷋","否","000111"],[13,"Fellowship with Men","䷌","同人","101111"],[14,"Possession in Great Measure","䷍","大有","111101"],[15,"Modesty","䷎","謙","001000"],[16,"Enthusiasm","䷏","豫","000100"],[17,"Following","䷐","隨","100110"],[18,"Work on what has been spoiled [Decay]","䷑","蠱","011001"],[19,"Approach","䷒","臨","110000"],[20,"Contemplation [View]","䷓","觀","000011"],[21,"Biting Through","䷔","噬嗑","100101"],[22,"Grace","䷕","賁","101001"],[23,"Splitting Apart","䷖","剝","000001"],[24,"Return (The Turning Point)","䷗","復","100000"],[25,"Innocence (The Unexpected)","䷘","無妄","100111"],[26,"The Taming Power of the Great","䷙","大畜","111001"],[27,"The Corners of the Mouth (Providing Nourishment)","䷚","頤","100001"],[28,"Preponderance of the Great","䷛","大過","011110"],[29,"The Abysmal (Water)","䷜","坎","010010"],[30,"The Clinging, Fire","䷝","離","101101"],[31,"Influence (Wooing)","䷞","咸","001110"],[32,"Duration","䷟","恆","011100"],[33,"Retreat","䷠","遯","001111"],[34,"The Power of the Great","䷡","大壯","111100"],[35,"Progress","䷢","晉","000101"],[36,"Darkening of the Light","䷣","明夷","101000"],[37,"The Family [The Clan]","䷤","家人","101011"],[38,"Opposition","䷥","睽","110101"],[39,"Obstruction","䷦","蹇","001010"],[40,"Deliverance","䷧","解","010100"],[41,"Decrease","䷨","損","110001"],[42,"Increase","䷩","益","100011"],[43,"Break-through (Resoluteness)","䷪","夬","111110"],[44,"Coming to Meet","䷫","姤","011111"],[45,"Gathering Together [Massing]","䷬","萃","000110"],[46,"Pushing Upward","䷭","升","011000"],[47,"Oppression (Exhaustion)","䷮","困","010110"],[48,"The Well","䷯","井","011010"],[49,"Revolution (Molting)","䷰","革","101110"],[50,"The Caldron","䷱","鼎","011101"],[51,"The Arousing (Shock, Thunder)","䷲","震","100100"],[52,"Keeping Still, Mountain","䷳","艮","001001"],[53,"Development (Gradual Progress)","䷴","漸","001011"],[54,"The Marrying Maiden","䷵","歸妹","110100"],[55,"Abundance","䷶","豐","101100"],[56,"The Wanderer","䷷","旅","001101"],[57,"The Gentle (The Penetrating, Wind)","䷸","巽","011011"],[58,"The Joyous, Lake","䷹","兌","110110"],[59,"Dispersion [Dissolution]","䷺","渙","010011"],[60,"Limitation","䷻","節","110010"],[61,"Inner Truth","䷼","中孚","110011"],[62,"Preponderance of the Small","䷽","小過","001100"],[63,"After Completion","䷾","既濟","101010"],[64,"Before Completion","䷿","未濟","010101"]];

// kinds: 6 old yin (yielding, turning) · 7 young yang (firm, stays) · 8 young yin (yielding, stays) · 9 old yang (firm, turning)
export const START = { yarrow: { 6: 1, 7: 5, 8: 7, 9: 3 }, coins: { 6: 2, 7: 6, 8: 6, 9: 2 } };
export const ORDER = [7, 9, 8, 6];
export const PLACES = [
  { nm: 'the ground', tr: 'In the tradition the first place is the beginning, still below the surface.' },
  { nm: 'the inner centre', tr: 'The second place is the centre of the lower half: the official, inward and steady.' },
  { nm: 'the crossing', tr: 'The third place is the top of the lower half, where it crosses over; the tradition calls it perilous.' },
  { nm: 'the threshold', tr: 'The fourth place opens the upper half, the minister beside the ruler.' },
  { nm: 'the ruling place', tr: 'The fifth place is the centre of the upper half: the ruler.' },
  { nm: 'the top', tr: 'The sixth place is the end, beyond the matter itself.' }
];

// ── rng (game/lines.html @ 5b55c90) ──────────────────────────────────────────────────────────────
export function rngFrom(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ── the bowl (game/lines.html @ 5b55c90) ─────────────────────────────────────────────────────────
export function copyB(b) { return { 6: b[6], 7: b[7], 8: b[8], 9: b[9] }; }
export function firm(b) { return (b[7] || 0) + (b[9] || 0); }
export function turning(b) { return (b[6] || 0) + (b[9] || 0); }
export function listOf(b) { const l = []; ORDER.forEach(k => { for (let i = 0; i < (b[k] || 0); i++) l.push(k); }); return l; }
export function drawFrom(b, rng) { const l = listOf(b); const i = Math.floor(rng() * l.length); return { kind: l[i], index: i }; }
export function isFirm(k) { return k === 7 || k === 9; }
export function isTurning(k) { return k === 6 || k === 9; }
export function bits(lines, turned) { return lines.map(k => { let f = isFirm(k); if (turned && isTurning(k)) f = !f; return f ? '1' : '0'; }).join(''); }

// ── drawing (game/lines.html @ 5b55c90) ──────────────────────────────────────────────────────────
const SVGNS = 'http://www.w3.org/2000/svg';
export function lineGlyph(k) {
  let s = '<svg viewBox="0 0 20 20" aria-hidden="true">';
  const col = isFirm(k) ? 'var(--firm)' : 'var(--yield)';
  if (isFirm(k)) s += '<rect x="2" y="8" width="16" height="4" rx="1" fill="' + col + '"/>';
  else s += '<rect x="2" y="8" width="6.5" height="4" rx="1" fill="' + col + '"/><rect x="11.5" y="8" width="6.5" height="4" rx="1" fill="' + col + '"/>';
  return s + '</svg>';
}
export function kindName(k) { return { 6: 'yielding, turning', 7: 'firm, stays', 8: 'yielding, stays', 9: 'firm, turning' }[k]; }
export function marble(k, extra) { const d = document.createElement('div'); d.className = 'mb k' + k + (extra ? ' ' + extra : ''); d.innerHTML = lineGlyph(k); d.title = kindName(k); return d; }
// The Fork's bowl is static: a drawn marble gets the class `pick` (fork's lines.html draws it with a ring, no
// motion). `moved` is kept from the source but The Fork never passes grown kinds.
export function renderBowl(el, b, movedKinds, pickIndex) {
  el.innerHTML = ''; const mk = (movedKinds || []).slice(); let i = 0;
  const counts = {}; mk.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
  ORDER.forEach(k => { for (let j = 0; j < (b[k] || 0); j++) { const grown = counts[k] && j >= b[k] - counts[k]; el.appendChild(marble(k, (grown ? 'moved' : '') + (i === pickIndex ? ' pick' : ''))); i++; } });
}
// a hexagram as svg: lines bottom to top, turning lines marked
export function hexSVG(lines, opts) {
  opts = opts || {}; const w = 60, h = 60, gap = 10, lh = 5.4;
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="' + SVGNS + '" aria-hidden="true"' + (opts.cls ? ' class="' + opts.cls + '"' : '') + '>';
  for (let i = 0; i < 6; i++) {
    const y = h - 4 - i * gap - lh, k = lines[i];
    if (k === undefined || k === 0) { s += '<rect x="2" y="' + y + '" width="' + (w - 14) + '" height="' + lh + '" rx="1" fill="none" stroke="var(--line)" stroke-dasharray="2 2"/>'; continue; }
    const f = typeof k === 'boolean' ? k : isFirm(k), col = opts.turncol && isTurning(k) ? 'var(--turn)' : (f ? 'var(--firm)' : 'var(--yield)');
    if (f) s += '<rect x="2" y="' + y + '" width="' + (w - 14) + '" height="' + lh + '" rx="1" fill="' + col + '"/>';
    else s += '<rect x="2" y="' + y + '" width="' + ((w - 14) / 2 - 3) + '" height="' + lh + '" rx="1" fill="' + col + '"/><rect x="' + ((w - 14) / 2 + 5) + '" y="' + y + '" width="' + ((w - 14) / 2 - 3) + '" height="' + lh + '" rx="1" fill="' + col + '"/>';
    if (typeof k === 'number' && isTurning(k) && !opts.plain) {
      if (k === 9) s += '<circle cx="' + (w - 5) + '" cy="' + (y + lh / 2) + '" r="3" fill="none" stroke="var(--turn)" stroke-width="1.6"/>';
      else s += '<path d="M' + (w - 8) + ' ' + (y - 0.5) + 'l6 6.4M' + (w - 2) + ' ' + (y - 0.5) + 'l-6 6.4" stroke="var(--turn)" stroke-width="1.6"/>';
    }
    if (opts.hl === i) s += '<rect x="0" y="' + (y - 2) + '" width="' + w + '" height="' + (lh + 4) + '" rx="2" fill="none" stroke="var(--turn)" stroke-width="1"/>';
  }
  return s + '</svg>';
}

// ── the hypercube (recursive-iching viewers/caster-engine.js @ b8d82df) ──────────────────────────
export function hamming(a, b) { let d = 0; for (let i = 0; i < 6; i++) if (a[i] !== b[i]) d++; return d; }

// ── The Fork's own (not copied) ──────────────────────────────────────────────────────────────────
export const BY_BITS = {}; HEX.forEach(x => { BY_BITS[x[4]] = x; });
export function hexOf(b) { return BY_BITS[b] || null; }
// six kinds, every one set (no 0): a whole hexagram
export function isWhole(kinds) { return kinds.length === 6 && kinds.every(k => k === 6 || k === 7 || k === 8 || k === 9); }
const steadyOpposite = k => (isFirm(k) ? 8 : 7);

// The relating reading, one turning line at a time, bottom to top (the path caster's sequential idea; in the
// tradition all turning lines change at once). `kinds`: six kinds, lines 1 to 5 from the walk and line 6 the
// page's reading for where they land. Every turning line flips exactly once, line 6 included (its own step,
// last), and nothing else changes: the number of steps is the number of turning lines the hexagram shows, and
// the end is the tradition's relating hexagram. Line 6 is NOT looked up again on the way (that would change a
// line nobody turned). The last step carries `lookedUp`: the page's reading for where lines 1 to 5 end, which
// the page may mention beside the reading (a change in the landing, not a flip).
// Returns [{ kinds, flipped: index|null, line6Changed: false }], the first entry being where the lines stand.
export function relatingSteps(kinds, line6At) {
  const cur = kinds.slice(), steps = [{ kinds: cur.slice(), flipped: null, line6Changed: false }];
  for (let i = 0; i < 6; i++) {
    if (!isTurning(kinds[i])) continue;
    cur[i] = steadyOpposite(cur[i]);
    steps.push({ kinds: cur.slice(), flipped: i, line6Changed: false });
  }
  steps[steps.length - 1].lookedUp = line6At ? line6At(cur.slice(0, 5)) : 0;
  return steps;
}

