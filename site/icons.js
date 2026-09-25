/* Recursive Eco-Improvement — one shared SVG icon library.
   Thin-line, 24×24, stroke = currentColor (so an icon inherits whatever colour its
   context sets — museum gold/ink). Use anywhere, static or JS-rendered:
       <rt-icon name="scale"></rt-icon>
       <rt-icon name="eye" size="18"></rt-icon>
   In JS-built markup just emit the same tag string; the element upgrades itself.
   Raw paths are also on window.RT_ICONS for code that needs the SVG inline.
   Hand-drawn in a consistent Feather/Lucide-style hairline — no emoji, no colour. */
(function () {
  if (customElements.get('rt-icon')) return;

  // name -> inner SVG markup (24×24 coordinate space)
  var I = {
    /* ── the eight voices ── */
    'scale':    '<path d="M12 4v16M7 20h10M12 6l-7 2M12 6l7 2"/><path d="M5 8l-2.5 6a3 3 0 0 0 5 0L5 8z"/><path d="M19 8l-2.5 6a3 3 0 0 0 5 0L19 8z"/>',           /* Kant — duty/law */
    'contrast': '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',                                              /* DBT — dialectic / both-true */
    'leaf':     '<path d="M4 20c0-9 6-15 16-15 0 11-7 16-14 16a6 6 0 0 1-2-1z"/><path d="M5 19c2-6 6-9 11-11"/>',                                                   /* The Ecosystem */
    'sun':      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>',               /* Jung — the Self */
    'trident':  '<path d="M12 3v18"/><path d="M6 4v3a6 6 0 0 0 12 0V4"/><path d="M6 7l-2-2M18 7l2-2"/><path d="M9 21h6"/>',                                          /* Non-Dual Tantra */
    'snail':    '<path d="M3 15a4 4 0 0 0 4 4h7a5.5 5.5 0 1 0-5.5-5.5A2.5 2.5 0 1 0 11 16"/><path d="M14 19l1.5 2M18 6l1.5-1.5M21 8.5L22.5 7"/>',                    /* Post-Activism — slow */
    'spiral':   '<path d="M12 12a1.5 1.5 0 1 1 1.5 1.5 3.5 3.5 0 0 1-3.5-3.5 5.5 5.5 0 0 1 5.5-5.5 7.5 7.5 0 0 1 7.5 7.5"/>',                                        /* Hospicing — composting/cycle */
    'triangle': '<path d="M12 4l8.5 15.5H3.5z"/>',                                                                                                                  /* Golden Dawn — ascent */

    /* ── UI chrome (for the viewer sweeps) ── */
    'x':        '<path d="M6 6l12 12M18 6L6 18"/>',
    'eye':      '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'pencil':   '<path d="M4 20h4L18.5 9.5l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    'link':     '<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/>',
    'message':  '<path d="M4 5h16v11H9l-5 4z"/>',
    'flag':     '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
    'grid':     '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    'folder':   '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'package':  '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    'book':     '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2z"/><path d="M5 4v16"/>',
    'cards':    '<rect x="3" y="6" width="11" height="15" rx="1.5"/><path d="M8 6l3-1.5L20 9v11"/>',
    'shop':     '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    'oracle':   '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>',
    'person':   '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    'play':     '<path d="M8 5l11 7-11 7z"/>',
    'film':     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
    'chart':    '<path d="M4 4v16h16"/><path d="M7 14l4-4 3 3 5-6"/>',
    'tree':     '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V11M12 11l-6 4M12 11l6 4"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/>',
    'crack':    '<path d="M14 3l-3.5 7 3 2-4.5 9"/>',
    'sefirot':  '<circle cx="12" cy="5" r="1.9"/><circle cx="7" cy="12" r="1.9"/><circle cx="17" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/><path d="M12 7v3M12 7l-4 3.5M12 7l4 3.5M7.5 13.5l4 4M16.5 13.5l-4 4"/>',
    'crown':    '<path d="M3 18h18M4.5 18l-1.3-9 5.3 4L12 5.5l3.5 7.5 5.3-4-1.3 9"/>',
    'device':   '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.5h3"/>',
    'printer':  '<path d="M6.5 9.5V3.5h11v6"/><rect x="3.5" y="9.5" width="17" height="7" rx="2"/><path d="M6.5 16v4.5h11V16z"/>',
    'github':   '<path fill="currentColor" stroke="none" d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.5-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C16.5 5 17.5 5.3 17.5 5.3c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/>'
  };

  function svg(name, size) {
    var inner = I[name]; if (!inner) return '';
    size = size || '1em';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.14em">' + inner + '</svg>';
  }

  class RTIcon extends HTMLElement {
    connectedCallback() {
      this.innerHTML = svg(this.getAttribute('name'), this.getAttribute('size'));
      this.style.display = 'inline-flex';
    }
  }
  customElements.define('rt-icon', RTIcon);

  window.RT_ICONS = I;       // raw paths
  window.rtIcon = svg;       // helper: rtIcon('eye', 18) -> '<svg…>'
})();
