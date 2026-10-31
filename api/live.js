// The Corporate Times · live feed
// Gathers the Malta Observer's World News Dispatch and headline figures, and the
// ThinkPeople Nexus / Leonardo 2050 Thinking listings, into one JSON document.
// Cached at Vercel's edge for 15 minutes; each source fails independently.

const MO = 'https://www.maltaobserver.com';
const TPN = 'https://thinkpeoplenexus.com';
const L50 = 'https://www.leonardo2050.com';
const UA = { 'user-agent': 'CorporateTimes/1.0 (+https://corporate-times.com)' };

async function get(url, type = 'json', ms = 8000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: UA, signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    return type === 'json' ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

/* ---------- formatting ---------- */
const MT = 'Europe/Malta';
function stamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: MT, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}
function longDate(ymd) {
  const d = new Date(ymd + 'T12:00:00Z');
  return new Intl.DateTimeFormat('en-GB', { timeZone: MT, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/^(\w+) /, '$1, ');
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const decode = s => String(s || '')
  .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, ' ').trim();
const titleCase = s => s.toLowerCase().replace(/(^|[\s·-])([a-zà-ž])/g, (m, a, b) => a + b.toUpperCase());

/* ---------- World News Dispatch ---------- */
const SECTIONS = [['malta', 'Malta Observer', 6], ['europe', 'Europe', 6], ['comuniq', 'Comuniq.EU', 6],
  ['ai', 'SHaiPING Vision', 6], ['world', 'World', 12], ['sport', 'Sport', 9]];

// The feed mixes plain stories with country/institution wrappers ({name, iso, story}); unwrap both.
const unwrap = x => x && x.story ? Object.assign({}, x.story, { _name: x.name, _iso: x.iso }) : x;
const isEurope = s => /^(EU|Europe)/i.test(s.region || '');

function mapDispatch(wd) {
  const L = wd && wd.latest; if (!L) return null;
  const arr = k => (Array.isArray(L[k]) ? L[k] : []).map(unwrap).filter(x => x && x.headline);
  const top = arr('stories');
  const lists = {
    malta: arr('malta'),
    europe: top.filter(isEurope).concat(arr('eu')),
    comuniq: arr('comuniq'),
    ai: arr('ai'),
    world: top.filter(s => !isEurope(s)).concat(arr('world_stories'), arr('world')),
    sport: arr('sport_malta').concat(arr('sport'))
  };
  const items = [];
  for (const [key, , max] of SECTIONS) {
    const seen = new Set();
    let list = lists[key].filter(x => !seen.has(x.id) && seen.add(x.id));
    const lead = list.find(x => x.lead) || list[0];
    list = lead ? [lead, ...list.filter(x => x !== lead)] : list;
    list.slice(0, max).forEach((x, i) => {
      const src = (x.sources || [])[0] || {};
      const cc = (x.flags || [])[0] || x._iso || '';
      const country = x._name || (cc && x.region && !/^(EU|Europe|World|Americas|UK)$/i.test(x.region) ? x.region : '') || '';
      items.push([key, cc.toUpperCase(), country, i === 0 ? 1 : 0, decode(x.headline), src.url || '', src.publisher || '', stamp(x.latest_at || src.published_at), i === 0 ? decode(x.summary || '') : '']);
    });
  }
  if (!items.length) return null;
  const w = L.window || {};
  return {
    edition: `${cap(L.slot || 'latest')} edition · ${L.slot_date ? longDate(L.slot_date) : ''}`,
    window: `Top stories from ${stamp(w.from)} to ${stamp(w.to)}, Malta time · published ${stamp(L.approved_at)}`,
    sections: SECTIONS.map(s => [s[0], s[1]]),
    items
  };
}

/* ---------- Observer headline figures ---------- */
function mapGlance(g) {
  if (!g || !g.items) return null;
  const out = {};
  for (const [k, v] of Object.entries(g.items)) out[k] = { display: v.display, label: v.label, detail: v.detail, source: v.source };
  return { generated_at: g.generated_at, items: out };
}

/* ---------- Thinking ---------- */
function abs(base, u) { try { return new URL(u, base).href; } catch { return u; } }
function pick(re, s) { const m = s.match(re); return m ? m[1] : ''; }

function parseTPN(html) {
  const cards = [];
  const re = /<article class="collection-card[^"]*">([\s\S]*?)<\/article>/g; let m;
  while ((m = re.exec(html))) {
    const b = m[1];
    const href = pick(/<a href="([^"]+)"/, b); if (!href) continue;
    const img = pick(/<img[^>]*\ssrc="([^"]+)"/, b);
    const label = decode(pick(/<span class="label">([\s\S]*?)<\/span>/, b));
    const [date, by] = label.split('·').map(s => s && s.trim());
    cards.push({ k: decode(pick(/<p class="eyebrow">([\s\S]*?)<\/p>/, b)), t: decode(pick(/<h2>([\s\S]*?)<\/h2>/, b)),
      d: decode(pick(/<\/h2>\s*<p>([\s\S]*?)<\/p>/, b)), date: date ? titleCase(date) : '', by: by ? titleCase(by) : '',
      u: abs(TPN + '/thinking/', href), img: img ? abs(TPN + '/thinking/', img) : '' });
  }
  return cards.filter(c => c.t);
}

function parseL50(html) {
  const out = []; const re = /<article class="thinking-card[^"]*">([\s\S]*?)<\/article>/g; let m;
  while ((m = re.exec(html))) {
    const b = m[1];
    const meta = decode(pick(/<p class="thinking-meta">([\s\S]*?)<\/p>/, b));
    if (!/Essay/i.test(meta)) continue;
    const parts = meta.split('·').map(x => x.trim());
    const small = decode(pick(/<small>([\s\S]*?)<\/small>/, b));
    const [date, by] = small.split('·').map(x => x && x.trim());
    out.push({ no: parts.find(p => /Essay/i.test(p)) || '', k: parts.find(p => !/Essay/i.test(p)) || '', t: decode(pick(/<h2>([\s\S]*?)<\/h2>/, b)), d: decode(pick(/<\/h2>\s*<p>([\s\S]*?)<\/p>/, b)),
      date: date || '', by: by || '', u: abs(L50 + '/thinking.html', pick(/<a href="([^"]+)"/, b)), img: abs(L50 + '/thinking.html', pick(/<img[^>]*\ssrc="([^"]+)"/, b)) });
  }
  const seen = new Set();
  return out.filter(e => e.t && !seen.has(e.u) && seen.add(e.u));
}

function mapThinking(tpnHtml, l50Html) {
  const tpn = tpnHtml ? parseTPN(tpnHtml) : [];
  const essays = l50Html ? parseL50(l50Html) : [];
  if (!tpn.length && !essays.length) return null;
  const res = {};
  if (tpn.length) {
    const lead = tpn[0];
    const l50lead = l50Html && l50Html.includes(lead.u.replace(TPN, '').split('/').filter(Boolean).pop()) ? `${L50}/thinking/${lead.u.split('/').filter(Boolean).pop()}.html` : '';
    res.lead = { ...lead, u2: l50lead || L50 + '/thinking.html' };
    res.articles = tpn.slice(1);
  }
  if (essays.length) res.essays = essays;
  return res;
}

export default async function handler(req, res) {
  const [wd, gl, tp, l5] = await Promise.allSettled([
    get(MO + '/api/world-dispatch'), get(MO + '/api/glance'), get(TPN + '/thinking/', 'text'), get(L50 + '/thinking.html', 'text')]);
  const val = p => p.status === 'fulfilled' ? p.value : null;
  const body = {
    fetched_at: new Date().toISOString(),
    dispatch: (() => { try { return mapDispatch(val(wd)); } catch { return null; } })(),
    glance: (() => { try { return mapGlance(val(gl)); } catch { return null; } })(),
    thinking: (() => { try { return mapThinking(val(tp), val(l5)); } catch { return null; } })(),
    errors: [wd, gl, tp, l5].map((p, i) => p.status === 'rejected' ? ['dispatch', 'glance', 'thinking-tpn', 'thinking-l50'][i] + ': ' + String(p.reason && p.reason.message || p.reason) : null).filter(Boolean)
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify(body));
}

export { mapDispatch, mapGlance, parseTPN, parseL50, mapThinking };
