# The Corporate Times · corporate-times.com

Malta’s corporate observatory, within the wider work of Corporate ID Group, developed in collaboration with ThinkPeople Nexus. Developed by C-ai.US.

## What is here
- `index.html` — the whole portal (single page, hash-routed). Articles from the January–October 2026 print editions are embedded as data.
- `img/` — article photos, adverts, illustrations, Thinking images and the v3 horizontal logo.
- `api/live.js` — Vercel function that gathers, every 15 minutes (edge cache):
  - Malta Observer World News Dispatch: `maltaobserver.com/api/world-dispatch`
  - Malta Observer headline figures: `maltaobserver.com/api/glance`
  - Thinking listings: `thinkpeoplenexus.com/thinking/` and `leonardo2050.com/thinking.html`
  The page loads with a built-in copy and swaps in the live content when `/api/live` answers.

## Adding a new print edition
Send the edition folder (Word files + photos); the build script turns it into the embedded data and images.

## Sharing headlines with other sites (e.g. the Malta Observer)
- `feed.json` — the latest edition's stories (title, dek, section, image, link), open to any site (CORS `*`).
- `embed.js` — drop-in widget. On the other site:

```html
<div data-ct-headlines data-limit="6"></div>
<script src="https://corporate-times.com/embed.js" defer></script>
```
Options: `data-layout="list"`, `data-images="off"`, `data-title="…"`. The widget inherits the host page's fonts and text colour (works in light and dark themes).

Menu link: `<a href="https://corporate-times.com/" target="_blank" rel="noopener">Corporate Times</a>`
