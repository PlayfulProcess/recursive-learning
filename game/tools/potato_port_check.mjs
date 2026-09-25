#!/usr/bin/env node
// potato_port_check.mjs: does game/potato-model.js (the page's rules) give the same outcomes as
// tools/potato_rules_check.py (the rules as designed and checked)? Run from anywhere:
//
//   node game/tools/potato_port_check.mjs
//
// It walks every sequence of offered moves up to 8 presses, for all four hidden draws
// (4 or 5 pairs of hands, fire at 15 or 16 flames), in both languages, and compares the ending,
// the flames, how many hold it and every seat's hands after each sequence. It also prints the
// Python file's own path table next to the same table from the port. Needs node and python.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const M = require(join(here, '..', 'potato-model.js'));
const CODE = { hold: 'H', toss: 'X', together: 'T', down: 'D', idk: 'I' };
const DEPTH = 8;

function enumerateJs(need, burn) {
  const out = [];
  const walk = (s, q) => {
    for (const v of M.offered(s)) {
      const t = M.clone(s); M.step(t, v); const r = q + CODE[v];
      out.push([r, t.out || '-', t.F, t.on.length, M.SEATS.map(k => t.hands[k]).join('')].join(' '));
      if (!t.out && r.length < DEPTH) walk(t, r);
    }
  };
  walk(M.create(need, burn), '');
  return out;
}
const PY = `
import sys, copy
sys.path.insert(0, ${JSON.stringify(here)})
import potato_rules_check as m
SEATS = ['you'] + m.OTHERS
def walk(s, q, out, depth):
    for v in m.offered(s):
        t = copy.deepcopy(s); m.step(t, v); r = q + m.CODE[v]
        out.append(' '.join([r, t['out'] or '-', str(t['F']), str(len(t['on'])), ''.join(str(t['hands'][k]) for k in SEATS)]))
        if not t['out'] and len(r) < depth: walk(t, r, out, depth)
for need in (4, 5):
    for burn in (15, 16):
        out = []; walk(m.new(need, burn), '', out, ${DEPTH})
        print('#', need, burn); print(chr(10).join(out))
`;
const py = execFileSync(process.env.PYTHON || 'python', ['-c', PY], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .replace(/\r/g, '').trim().split('\n');
const js = [];
for (const need of [4, 5]) for (const burn of [15, 16]) { js.push(`# ${need} ${burn}`); js.push(...enumerateJs(need, burn)); }

let bad = 0;
if (py.length !== js.length) { console.log(`line count differs: python ${py.length}, js ${js.length}`); bad++; }
for (let i = 0; i < Math.min(py.length, js.length); i++) {
  if (py[i] !== js[i]) { if (bad < 10) console.log(`differs at ${i}:\n  py ${py[i]}\n  js ${js[i]}`); bad++; }
}
const paths = ['TTTD', 'TTTTD', 'HHXTTTD', 'HHXTTTTD', 'HHXHTTTD', 'HHXHTTTTD', 'XTTTD', 'XTTTTD',
  'HHHHXTTT', 'XX', 'HXHX', 'IIIIIIIIIIII', 'THHHTTD', 'THHHTTTD', 'TTXTTTD', 'TTXTTTTD', 'TTHHHHHTD'];
const REV = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
for (const need of [4, 5]) for (const burn of [15, 16]) {
  console.log(`need ${need}  burn ${burn}`);
  for (const p of paths) {
    const s = M.create(need, burn); let note = '';
    for (const c of p) { if (s.out) break; const v = REV[c]; if (!M.offered(s).includes(v)) { note = `[${v} not offered]`; break; } M.step(s, v); }
    console.log(`   ${p.padEnd(14)} ${(s.out || '...').padEnd(7)} flames=${String(s.F).padStart(2)} (${M.potw(s.F).padEnd(9)}) pairs=${s.on.length} ${note}`);
  }
}
console.log(bad ? `\nPORT DIFFERS in ${bad} of ${py.length} sequences` : `\nport matches python on all ${js.length - 4} sequences up to ${DEPTH} presses, for all four draws`);
process.exit(bad ? 1 : 0);
