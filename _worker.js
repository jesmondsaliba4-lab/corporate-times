// thedispatch.pro — static site (assets) + issue requests.
// POST /api/request  -> stored in D1 (DB) and notified by email to jes@thinkpeople.eu (MAILER).
// GET /api/editions -> latest edition dates of all print editions (cached 30 min)
// POST /api/subscribe, /api/unsubscribe -> WhatsApp subscriptions (D1 table wa_subscribers)
import { EmailMessage } from 'cloudflare:email';

const TO = 'jes@thinkpeople.eu';
const FROM = 'requests@comuniq.eu';
const EDITIONS = { en: 'English' };

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const hdr = (s) => '=?UTF-8?B?' + b64(s) + '?=';
const clean = (s, n) => String(s || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);

async function handleRequest(req, env) {
  let d;
  try { d = await req.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  if (d.website) return json({ ok: true }); // honeypot
  const email = clean(d.email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
  if (d.consent !== true) return json({ ok: false, error: 'Please tick the box so we can send you the edition.' }, 400);
  const name = clean(d.name, 120);
  const edition = EDITIONS[d.edition] ? d.edition : 'en';
  const story = clean(d.story, 60);
  const country = req.cf?.country || '';
  const ua = clean(req.headers.get('user-agent'), 200);

  // light rate limit: 5 requests per address per day
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE email = ? AND created_at > datetime('now','-1 day')").bind(email).first();
  if (recent && recent.n >= 5) return json({ ok: true });

  const ins = await env.DB.prepare('INSERT INTO requests (email, name, edition, story, issue, consent, ip_country, user_agent) VALUES (?,?,?,?,?,?,?,?)')
    .bind(email, name, edition, story, 'The Dispatch.pro No. 1 · December 2026', 1, country, ua).run();
  const id = ins.meta?.last_row_id;

  const body = [
    'New request to receive The Dispatch.pro by email.',
    '',
    'Email:    ' + email,
    'Name:     ' + (name || '—'),
    'Edition:  ' + EDITIONS[edition] + ' (' + edition + ')',
    'Issue:    The Dispatch.pro No. 1 · December 2026',
    'From story: ' + (story || '— (general request)'),
    'Country:  ' + (country || '—'),
    'Request #' + (id || '?') + ' · ' + new Date().toISOString(),
    '',
    'PDF: https://thedispatch.pro/1/pdf/TheDispatch.pro-No1-December-2026.pdf',
    'Reply to this email to answer the reader directly.',
  ].join('\r\n');
  const raw = [
    'From: ' + hdr('The Dispatch.pro requests') + ' <' + FROM + '>',
    'To: <' + TO + '>',
    'Reply-To: <' + email + '>',
    'Subject: ' + hdr('The Dispatch.pro request — ' + email),
    'Message-ID: <' + crypto.randomUUID() + '@comuniq.eu>',
    'Date: ' + new Date().toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(body).replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n');
  try {
    await env.MAILER.send(new EmailMessage(FROM, TO, raw));
    await env.DB.prepare('UPDATE requests SET mailed = 1 WHERE id = ?').bind(id).run();
  } catch (e) {
    console.log('mail failed', String(e)); // request is still stored in D1
  }
  return json({ ok: true });
}


// ---------------- Editions hub: latest edition dates + WhatsApp subscriptions ----------------
const WA_EDITIONS = {
  'dispatch-pro': 'The Dispatch.pro · monthly magazine',
  'cde-daily': 'The CDE.NEWS Dispatch · daily print edition',
  'cde-weekly': 'The Weekly CDE.NEWS Dispatch · Sundays',
  'ct-daily': 'The Corporate Times · daily evening edition',
  'ct-weekly': 'The Corporate Times · weekly edition',
  'ct-monthly': 'The Corporate Times · monthly edition',
  'comuniq': 'Comuniq.EU · European weekly',
};
const WA_LANGS = { en: 'English', mt: 'Malti', it: 'Italiano', el: 'Ελληνικά', cy: 'Κυπριακά', fr: 'Français', de: 'Deutsch', es: 'Español', pl: 'Polski', ar: 'العربية' };
const CONSENT = 'I agree that Corporate ID Group may send me the editions I have chosen on WhatsApp, at the number above. I can stop at any time by replying STOP or at thedispatch.pro/unsubscribe.';

async function latestEditions(ctx) {
  const cache = caches.default;
  const key = new Request('https://thedispatch.pro/__editions_cache_v2');
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const out = { checked: new Date().toISOString() };
  const ua = { headers: { 'user-agent': 'thedispatch.pro editions (+https://thedispatch.pro/editions/)' } };
  const wp = async (cat, re) => {
    const r = await fetch(`https://cde.news/wp-json/wp/v2/posts?categories=${cat}&per_page=20&_fields=slug,link`, ua);
    for (const p of await r.json()) { const m = re.exec(p.slug); if (m) return { date: m[1], web: p.link }; }
  };
  const MON = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
  const titleDate = async (url) => {
    const h = await (await fetch(url, ua)).text();
    const t = (/<title>([^<]*)<\/title>/i.exec(h) || [])[1] || '';
    const m = /(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/.exec(t);
    return m ? { date: `${m[3]}-${String(MON[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}` } : undefined;
  };
  const jobs = [
    ['cdeDaily', () => wp(610837373, /^daily-dispatch-(\d{4}-\d{2}-\d{2})/)],
    ['cdeWeekly', () => wp(610837362, /^weekly-dispatch-(\d{4}-\d{2}-\d{2})/)],
    ['ctDaily', () => titleDate('https://daily.corporate-times.com/')],
    ['ctWeekly', () => titleDate('https://weekly.corporate-times.com/')],
  ];
  await Promise.all(jobs.map(async ([k, f]) => { try { const v = await f(); if (v) out[k] = v; } catch (e) {} }));
  const res = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=1800' } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return out;
}

const normPhone = (s) => {
  let p = String(s || '').replace(/[\s().\-]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : '';
};

async function mailJes(env, subject, lines) {
  const raw = [
    'From: ' + hdr('The Dispatch.pro editions') + ' <' + FROM + '>',
    'To: <' + TO + '>',
    'Subject: ' + hdr(subject),
    'Message-ID: <' + crypto.randomUUID() + '@comuniq.eu>',
    'Date: ' + new Date().toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(lines.join('\r\n')).replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n');
  try { await env.MAILER.send(new EmailMessage(FROM, TO, raw)); } catch (e) { console.log('mail failed', String(e)); }
}

async function handleSubscribe(req, env) {
  let d;
  try { d = await req.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  if (d.website) return json({ ok: true }); // honeypot
  const phone = normPhone(d.phone);
  if (!phone) return json({ ok: false, error: 'Please enter your WhatsApp number with the country code, e.g. +356 9912 3456.' }, 400);
  const eds = [...new Set((Array.isArray(d.editions) ? d.editions : []).filter(e => WA_EDITIONS[e]))];
  if (!eds.length) return json({ ok: false, error: 'Please choose at least one edition.' }, 400);
  if (d.consent !== true) return json({ ok: false, error: 'Please tick the box so we can send you the editions on WhatsApp.' }, 400);
  const lang = WA_LANGS[d.lang] ? d.lang : 'en';
  const name = clean(d.name, 120);
  const country = req.cf?.country || '';
  const ua = clean(req.headers.get('user-agent'), 200);
  await env.DB.prepare(`INSERT INTO wa_subscribers (phone, name, editions, lang, status, consent_text, source, ip_country, user_agent)
    VALUES (?,?,?,?, 'pending', ?, 'thedispatch.pro/editions', ?, ?)
    ON CONFLICT(phone) DO UPDATE SET name=excluded.name, editions=excluded.editions, lang=excluded.lang, status='pending',
      consent_text=excluded.consent_text, consent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP, unsubscribed_at=NULL,
      ip_country=excluded.ip_country, user_agent=excluded.user_agent`)
    .bind(phone, name, eds.join(','), lang, CONSENT, country, ua).run();
  await mailJes(env, 'New WhatsApp subscriber — ' + eds.length + ' edition' + (eds.length > 1 ? 's' : ''), [
    'A reader has asked to receive editions on WhatsApp (status: pending until WhatsApp delivery is switched on).', '',
    'Number:   ' + phone, 'Name:     ' + (name || '—'), 'Language: ' + WA_LANGS[lang] + ' (' + lang + ')', 'Country:  ' + (country || '—'), '',
    'Editions:', ...eds.map(e => '  · ' + WA_EDITIONS[e]), '', 'Consent recorded: ' + new Date().toISOString(),
  ]);
  return json({ ok: true });
}

async function handleUnsubscribe(req, env) {
  let d;
  try { d = await req.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  if (d.website) return json({ ok: true });
  const phone = normPhone(d.phone);
  if (!phone) return json({ ok: false, error: 'Please enter the WhatsApp number you subscribed with, including the country code.' }, 400);
  await env.DB.prepare("UPDATE wa_subscribers SET status='unsubscribed', unsubscribed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE phone = ?").bind(phone).run();
  return json({ ok: true }); // same answer whether or not the number was on the list
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.hostname === 'www.thedispatch.pro') { u.hostname = 'thedispatch.pro'; return Response.redirect(u.toString(), 301); }
    if (u.pathname === '/api/request') {
      if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      return handleRequest(req, env);
    }
    if (u.pathname === '/api/editions') return json(await latestEditions(ctx));
    if (u.pathname === '/api/subscribe' || u.pathname === '/api/unsubscribe') {
      if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      return u.pathname === '/api/subscribe' ? handleSubscribe(req, env) : handleUnsubscribe(req, env);
    }
    const res = await env.ASSETS.fetch(req);
    const r = new Response(res.body, res);
    r.headers.set('X-Content-Type-Options', 'nosniff');
    r.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (u.pathname.endsWith('.pdf')) r.headers.set('Content-Disposition', 'inline');
    return r;
  },
};
