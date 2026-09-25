#!/usr/bin/env node
// potato_port_check.mjs: does game/potato-model.js (the page's rules) give the same outcomes as
// tools/potato_rules_check.py (the rules as designed and checked)? Run from anywhere:
//
//   node game/tools/potato_port_check.mjs
//
// It walks every sequence of offered moves up to 9 presses, for the three rounds and every random
// round (start 2 to 5, Wren wants 2 to 5), with the fire at 15 and at 16, in both languages, and
// compares the ending, the flames, the hottest it got, what Wren has seen, who holds it and your
// hands after each sequence. Needs node and python.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const M = require(join(here, '..', 'potato-model.js'));
const CODE = { hold: 'H', toss: 'X', together: 'T', down: 'D', idk: 'I' };
const DEPTH = 9;
const PARAMS = [];
for (const start of M.FREE.starts) for (const wait of M.FREE.waits) PARAMS.push([start, wait]);
M.ROUNDS.forEach(r => { if (!PARAMS.some(p => p[0] === r.start && p[1] === r.wait)) PARAMS.push([r.start, r.wait]); });

function enumerateJs(start, wait, burn) {
  const out = [];
  const walk = (s, q) => {
    for (const v of M.offered(s)) {
      const t = M.clone(s); M.step(t, v); const r = q + CODE[v];
      out.push([r, t.out || '-', t.F, t.maxF, t.seen, t.on.join(','), t.hand].join(' '));
      if (!t.out && r.length < DEPTH) walk(t, r);
    }
  };
  walk(M.create(start, wait, burn), '');
  return out;
}
const PY = `
import sys, copy
sys.path.insert(0, ${JSON.stringify(here)})
import potato_rules_check as m
def walk(s, q, out, depth):
    for v in m.offered(s):
        t = copy.deepcopy(s); m.step(t, v); r = q + m.CODE[v]
        out.append(' '.join([r, t['out'] or '-', str(t['F']), str(t['maxF']), str(t['seen']), ','.join(t['on']), str(t['hand'])]))
        if not t['out'] and len(r) < depth: walk(t, r, out, depth)
for start, wait in ${JSON.stringify(PARAMS)}:
    for burn in m.BURNS:
        out = []; walk(m.new(start, wait, burn), '', out, ${DEPTH})
        print('#', start, wait, burn); print(chr(10).join(out))
`;
const py = execFileSync(process.env.PYTHON || 'python', ['-c', PY], { encoding: 'utf8', maxBuffer: 1 << 29 })
  .replace(/\r/g, '').trim().split('\n');
const js = [];
for (const [start, wait] of PARAMS) for (const burn of M.BURNS) {
  js.push(`# ${start} ${wait} ${burn}`); js.push(...enumerateJs(start, wait, burn));
}
let bad = 0;
if (py.length !== js.length) { console.log(`line count differs: python ${py.length}, js ${js.length}`); bad++; }
for (let i = 0; i < Math.min(py.length, js.length); i++) {
  if (py[i] !== js[i]) { if (bad < 10) console.log(`differs at ${i}:\n  py ${py[i]}\n  js ${js[i]}`); bad++; }
}
const n = PARAMS.length * M.BURNS.length;
console.log(bad ? `\nPORT DIFFERS in ${bad} of ${py.length} sequences`
  : `port matches python on all ${js.length - n} sequences up to ${DEPTH} presses, for ${PARAMS.length} rounds x ${M.BURNS.length} fire points`);
process.exit(bad ? 1 : 0);
