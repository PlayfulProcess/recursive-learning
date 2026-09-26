/* deck-picker.js — shared deck multiselect popover for cards + explorer.
 * Usage:
 *   DeckPicker.open(anchorEl, { collection, selected: ['slug',...], onLoad(slugs) {} })
 * collection = parsed _collection.json  (needs collection.grammars[])
 * selected   = currently active slug array (for checkmarks)
 * onLoad     = called with the chosen slug array when user clicks "Load selected"
 */
(function (global) {
  'use strict';

  const POP_STYLE = [
    'position:fixed', 'z-index:9001', 'background:#f4f1ea',
    'border:1px solid #cfc8ba', 'border-radius:10px', 'padding:10px',
    'box-shadow:0 8px 24px rgba(0,0,0,.55)', 'min-width:260px',
    'max-height:60vh', 'display:flex', 'flex-direction:column', 'gap:6px'
  ].join(';');

  function open(anchor, { collection, selected, onLoad }) {
    document.querySelectorAll('.dp-pop').forEach(p => p.remove());
    const sel = new Set(selected || []);
    const decks = (collection?.grammars || [])
      .filter(g => !g.is_meta && g.slug !== 'tree-of-tarot')
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) ||
                      (a.name || '').localeCompare(b.name || ''));

    const pop = document.createElement('div');
    pop.className = 'dp-pop';
    pop.style.cssText = POP_STYLE;

    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(r.left, window.innerWidth - 280) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';

    const hint = document.createElement('p');
    hint.style.cssText = 'margin:0;font-size:11.5px;color:#6b6457;line-height:1.45;max-width:240px';
    hint.innerHTML = 'Tick <b>several decks</b> and Load — patterns appear when collections overlap.';
    pop.appendChild(hint);

    const search = document.createElement('input');
    search.type = 'text'; search.placeholder = 'search decks…';
    search.style.cssText = 'width:100%;padding:5px 8px;background:#110e1d;border:1px solid #cfc8ba;border-radius:6px;color:#221f1a;font-size:12px;box-sizing:border-box;flex-shrink:0';
    pop.appendChild(search);

    const list = document.createElement('div');
    list.style.cssText = 'overflow-y:auto;flex:1;';
    decks.forEach(g => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:12.5px;color:#4a4439;';
      label.onmouseenter = () => { label.style.background = '#e9f5ef'; };
      label.onmouseleave = () => { label.style.background = ''; };
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = g.slug; cb.checked = sel.has(g.slug);
      cb.style.accentColor = '#177d56';
      const name = document.createElement('span');
      name.textContent = g.name.split(' — ')[0].slice(0, 34);
      label.append(cb, name);
      if (g.year_label) {
        const yr = document.createElement('span');
        yr.textContent = '(' + g.year_label + ')';
        yr.style.cssText = 'margin-left:auto;padding-left:8px;color:#8b7fb0;font-size:11px;white-space:nowrap;';
        label.appendChild(yr);
      }
      list.appendChild(label);
    });
    pop.appendChild(list);

    search.oninput = e => {
      const q = e.target.value.toLowerCase();
      list.querySelectorAll('label').forEach(l => {
        l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;';

    const mkBtn = (text, fn, isPrimary) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = `flex:1;padding:5px 8px;border-radius:6px;font-size:12px;cursor:pointer;${
        isPrimary ? 'background:#177d56;border:none;color:#fff;' : 'background:#e9f5ef;border:1px solid #cfc8ba;color:#4a4439;'
      }`;
      b.onclick = fn;
      return b;
    };

    btns.appendChild(mkBtn('All', () => list.querySelectorAll('input[type=checkbox]').forEach(i => { i.checked = true; })));
    btns.appendChild(mkBtn('None', () => list.querySelectorAll('input[type=checkbox]').forEach(i => { i.checked = false; })));
    btns.appendChild(mkBtn('Load selected', () => {
      const v = [...list.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
      pop.remove();
      onLoad(v);
    }, true));
    pop.appendChild(btns);

    document.body.appendChild(pop);
    search.focus();

    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!pop.contains(e.target) && e.target !== anchor) {
          pop.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 10);

    return pop;
  }

  global.DeckPicker = { open };
})(window);
