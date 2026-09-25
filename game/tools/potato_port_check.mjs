#!/usr/bin/env node
// potato_port_check.mjs: does game/potato-model.js (the page's rules) give the same outcomes as
// tools/potato_rules_check.py (the rules as designed and checked)? Run from anywhere:
//
//   node game/tools/potato_port_check.mjs
//
// It walks every sequence of offered moves up to 7 presses, for all sixteen hidden draws
// (4 or 5 pairs of hands, fire at 15 or 16 flames, Wren waits 1 to 4 moves), in both languages,
// and compares the ending, the flames, what Wren has seen, who holds it, every seat's hands and
// whether it has become hopeless after each sequence. Needs node and python.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const M = require(join(here, '..', 'potato-model.js'));
const CODE = { hold: 'H', toss: 'X', together: 'T', down: 'D', idk: 'I' };
const DEPTH = 7;

function enumerateJs(need, burn, wait) {
  const out = [];
  const walk = (s, q) => {
    for (const v of M.offered(s)) {
      const t = M.clone(s); M.step(t, v); const r = q + CODE[v];
      out.push([r, t.out || '-', t.F, t.seen, t.on.join(','), M.SEATS.map(k => t.hands[k]).join(''), t.hopeless ? 'H' : '-'].join(' '));
      if (!t.out && r.length < DEPTH) walk(t, r);
    }
  };
  walk(M.create(need, burn, wait), '');
  return out;
}
const PY = `
import sys, copy
sys.path.insert(0, ${JSON.stringify(here)})
import potato_rules_check as m
def walk(s, q, out, depth):
    for v in m.offered(s):
        t = copy.deepcopy(s); m.step(t, v); r = q + m.CODE[v]
        out.append(' '.join([r, t['out'] or '-', str(t['F']), str(t['seen']), ','.join(t['on']),
                             ''.join(str(t['hands'][k]) for k in m.SEATS), 'H' if t['hopeless'] else '-']))
        if not t['out'] and len(r) < depth: walk(t, r, out, depth)
for need in m.NEEDS:
    for burn in m.BURNS:
        for wait in m.WAITS:
            out = []; walk(m.new(need, burn, wait), '', out, ${DEPTH})
            print('#', need, burn, wait); print(chr(10).join(out))
`;
const py = execFileSync(process.env.PYTHON || 'python', ['-c', PY], { encoding: 'utf8', maxBuffer: 1 << 29 })
  .replace(/\r/g, '').trim().split('\n');
const js = [];
for (const need of M.NEEDS) for (const burn of M.BURNS) for (const wait of M.WAITS) {
  js.push(`# ${need} ${burn} ${wait}`); js.push(...enumerateJs(need, burn, wait));
}
let bad = 0;
if (py.length !== js.length) { console.log(`line count differs: python ${py.length}, js ${js.length}`); bad++; }
for (let i = 0; i < Math.min(py.length, js.length); i++) {
  if (py[i] !== js[i]) { if (bad < 10) console.log(`differs at ${i}:\n  py ${py[i]}\n  js ${js[i]}`); bad++; }
}
const nDraws = M.NEEDS.length * M.BURNS.length * M.WAITS.length;
console.log(bad ? `\nPORT DIFFERS in ${bad} of ${py.length} sequences`
  : `port matches python on all ${js.length - nDraws} sequences up to ${DEPTH} presses, for all ${nDraws} draws`);
process.exit(bad ? 1 : 0);
