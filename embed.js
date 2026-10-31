/*! The Corporate Times · headlines widget
 * Usage on any site:
 *   <div data-ct-headlines data-limit="6"></div>
 *   <script src="https://corporate-times.com/embed.js" defer></script>
 * Options (data-attributes on the div):
 *   data-limit   number of stories (default 6)
 *   data-layout  "grid" (default) or "list"
 *   data-images  "off" to hide photos
 *   data-title   heading text (default "From The Corporate Times")
 * The widget inherits the host page's text colour and fonts, so it sits naturally
 * in light and dark themes; only the bronze accent is its own.
 */
(function () {
  var FEED = 'https://corporate-times.com/feed.json';
  var CSS = [
    ':host{display:block;color:inherit;font:inherit}',
    '.ct{border-top:3px double currentColor;padding-top:12px}',
    '.hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 16px;margin:0 0 14px}',
    '.hd h2{margin:0;font-size:1.45em;line-height:1.15;font-weight:600}',
    '.hd a{color:inherit;text-decoration:none}',
    '.hd .ed{font-size:.8em;opacity:.7}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px 22px;margin:0;padding:0;list-style:none}',
    '.list{margin:0;padding:0;list-style:none}',
    '.list li{display:flex;gap:14px;padding:12px 0;border-top:1px solid color-mix(in srgb,currentColor 18%,transparent)}',
    '.list .ph{flex:0 0 96px}',
    'li{min-width:0}',
    'a.s{color:inherit;text-decoration:none;display:block}',
    'a.s:hover .t{text-decoration:underline;text-decoration-color:#B77A3C;text-underline-offset:3px}',
    '.ph{display:block;aspect-ratio:3/2;overflow:hidden;background:color-mix(in srgb,currentColor 8%,transparent);margin-bottom:8px}',
    '.list .ph{margin:0}',
    '.ph img{width:100%;height:100%;object-fit:cover;object-position:50% 25%;display:block}',
    '.k{margin:0 0 4px;font-size:.72em;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#B77A3C}',
    '.t{margin:0;font-size:1.08em;line-height:1.25;font-weight:600}',
    '.d{margin:6px 0 0;font-size:.88em;line-height:1.45;opacity:.82}',
    '.ft{margin:14px 0 0;font-size:.85em}',
    '.ft a{color:#B77A3C;font-weight:600;text-decoration:none}',
    '.ft a:hover{text-decoration:underline}',
    '.err{font-size:.85em;opacity:.7}'
  ].join('');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function render(el, feed) {
    var limit = parseInt(el.getAttribute('data-limit') || '6', 10) || 6;
    var layout = el.getAttribute('data-layout') === 'list' ? 'list' : 'grid';
    var images = el.getAttribute('data-images') !== 'off';
    var title = el.getAttribute('data-title') || 'From The Corporate Times';
    var stories = (feed.stories || []).slice(0, limit);
    var items = stories.map(function (s) {
      var kicker = s.section + (s.kind === 'interview' ? ' · Interview' : '');
      var ph = images && s.image ? '<span class="ph"><img src="' + esc(s.image) + '" alt="" loading="lazy" decoding="async"></span>' : '';
      var body = '<p class="k">' + esc(kicker) + '</p><h3 class="t">' + esc(s.title) + '</h3>' + (layout === 'grid' && s.dek ? '<p class="d">' + esc(s.dek) + '</p>' : '');
      return layout === 'list'
        ? '<li>' + (ph ? '<a class="s ph-link" href="' + esc(s.url) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true" style="flex:0 0 96px">' + ph + '</a>' : '') + '<a class="s" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + body + '</a></li>'
        : '<li><a class="s" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + ph + body + '</a></li>';
    }).join('');
    var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + '</style><section class="ct" aria-label="' + esc(title) + '">' +
      '<div class="hd"><h2><a href="' + esc(feed.home) + '" target="_blank" rel="noopener">' + esc(title) + '</a></h2>' +
      '<span class="ed">' + esc(feed.edition && feed.edition.label) + ' · ' + esc(feed.edition && feed.edition.date) + '</span></div>' +
      '<ul class="' + layout + '">' + items + '</ul>' +
      '<p class="ft"><a href="' + esc(feed.home) + '" target="_blank" rel="noopener">Read The Corporate Times →</a></p></section>';
  }

  function init() {
    var els = document.querySelectorAll('[data-ct-headlines]');
    if (!els.length) return;
    fetch(FEED, { mode: 'cors' }).then(function (r) { return r.json(); }).then(function (feed) {
      for (var i = 0; i < els.length; i++) render(els[i], feed);
    }).catch(function () {
      for (var i = 0; i < els.length; i++) {
        var root = els[i].shadowRoot || els[i].attachShadow({ mode: 'open' });
        root.innerHTML = '<style>' + CSS + '</style><p class="err"><a href="https://corporate-times.com/" target="_blank" rel="noopener" style="color:#B77A3C">The Corporate Times →</a></p>';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
