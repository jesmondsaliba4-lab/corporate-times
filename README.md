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
