// dispatch-house.com — static landing page (assets) + enquiries.
// POST /api/enquire -> stored in D1 (DB, table dh_enquiries) and notified by email to jes@thinkpeople.eu (MAILER).
import { EmailMessage } from 'cloudflare:email';

const TO = 'jes@thinkpeople.eu';
const FROM = 'requests@comuniq.eu';
const CONSENT = 'I agree that Dispatch House (Corporate ID Group) may use these details to reply to my enquiry. They are not used for anything else.';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const b64 = (s) => { const u = new TextEncoder().encode(s); let x = ''; for (let i = 0; i < u.length; i += 0x8000) x += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(x); };
const hdr = (s) => '=?UTF-8?B?' + b64(s) + '?=';
const line = (s, n) => String(s || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const text = (s, n) => String(s || '').replace(/\r\n?/g, '\n').trim().slice(0, n);

async function enquire(req, env) {
  let d;
  try { d = await req.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  if (d.website) return json({ ok: true }); // honeypot
  const name = line(d.name, 120);
  const email = line(d.email, 200).toLowerCase();
  if (!name) return json({ ok: false, error: 'Please tell us your name.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
  if (d.consent !== true) return json({ ok: false, error: 'Please tick the box so we can reply to you.' }, 400);
  const org = line(d.org, 160), kind = line(d.kind, 80), message = text(d.message, 3000);
  const country = req.cf?.country || '';
  const ua = line(req.headers.get('user-agent'), 200);

  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM dh_enquiries WHERE email = ? AND created_at > datetime('now','-1 day')").bind(email).first();
  if (recent && recent.n >= 5) return json({ ok: true });

  const ins = await env.DB.prepare('INSERT INTO dh_enquiries (name, org, email, kind, message, consent, consent_text, ip_country, user_agent) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(name, org, email, kind, message, 1, CONSENT, country, ua).run();
  const id = ins.meta?.last_row_id;

  const body = [
    'New enquiry from dispatch-house.com',
    '',
    'Name:          ' + name,
    'Organisation:  ' + (org || '—'),
    'Email:         ' + email,
    'They are:      ' + (kind || '—'),
    'Country:       ' + (country || '—'),
    '',
    'What they have in mind:',
    message || '—',
    '',
    'Enquiry #' + (id || '?') + ' · ' + new Date().toISOString(),
    'Reply to this email to answer them directly.',
  ].join('\r\n');
  const raw = [
    'From: ' + hdr('Dispatch House enquiries') + ' <' + FROM + '>',
    'To: <' + TO + '>',
    'Reply-To: <' + email + '>',
    'Subject: ' + hdr('Dispatch House enquiry — ' + name + (org ? ', ' + org : '')),
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
    await env.DB.prepare('UPDATE dh_enquiries SET mailed = 1 WHERE id = ?').bind(id).run();
  } catch (e) {
    console.log('mail failed', String(e)); // the enquiry is still stored in D1
  }
  return json({ ok: true });
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.hostname === 'www.dispatch-house.com') { u.hostname = 'dispatch-house.com'; return Response.redirect(u.toString(), 301); }
    if (u.pathname === '/api/enquire') {
      if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      return enquire(req, env);
    }
    const res = await env.ASSETS.fetch(req);
    const r = new Response(res.body, res);
    r.headers.set('X-Content-Type-Options', 'nosniff');
    r.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    r.headers.set('X-Frame-Options', 'SAMEORIGIN');
    if (/\.(png|woff|svg|ico)$/.test(u.pathname)) r.headers.set('Cache-Control', 'public, max-age=604800');
    return r;
  },
};
