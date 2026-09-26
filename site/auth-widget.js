/* auth-widget.js: a STUB. v1 of this site has no sign-in (the tarot template's widget reads the
 * .recursive.eco session and renders <recursive-auth>; that is left out here on purpose).
 * The copied viewers read exactly one thing from it, so the stub defines exactly that:
 *   window.recursiveAuth = { client, getUser() }
 * cards.html polls for window.recursiveAuth (40 x 100 ms) before it loads a grammar, so an empty
 * file here would add four seconds to every cards page. <recursive-auth> stays undefined and
 * renders nothing. To bring sign-in back, copy recursive-tarot/auth-widget.js over this file. */
(function () {
  if (window.recursiveAuth) return;
  window.recursiveAuth = { client: null, getUser: async function () { return null; } };
})();
