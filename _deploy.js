// Runs inside dash.cloudflare.com (uses the signed-in session token). Usage: await __dhDeploy(RAW)
window.__dhDeploy = async function (RAW) {
  const A = '968abdd5b276c8397404eab450a76c81', DB = 'bf56fd08-3c31-48c8-9061-12956ccdf4ff';
  const atok = window.bootstrap.atok; const st = window.__dhState = { step: 'manifest' };
  const man = await (await fetch(RAW + '/_manifest.json')).json();
  const code = await (await fetch(RAW + '/_worker.js')).text();
  const s = await (await fetch(`/api/v4/accounts/${A}/workers/scripts/dispatch-house/assets-upload-session`, { method: 'POST', headers: { 'x-atok': atok, 'content-type': 'application/json' }, body: JSON.stringify({ manifest: man }) })).json();
  if (!s.success) throw new Error('session ' + JSON.stringify(s.errors));
  const sess = s.result; let completion = sess.jwt; st.buckets = (sess.buckets || []).length;
  const byHash = {}; for (const [p, v] of Object.entries(man)) byHash[v.hash] = p;
  const CT = { html: 'text/html', css: 'text/css', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', woff: 'font/woff', svg: 'image/svg+xml', ico: 'image/x-icon', webmanifest: 'application/manifest+json', pdf: 'application/pdf', txt: 'text/plain' };
  const b64 = async (url) => { const b = new Uint8Array(await (await fetch(url)).arrayBuffer()); let x = ''; for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(x); };
  for (const [bi, bucket] of (sess.buckets || []).entries()) {
    const fd = new FormData();
    for (const h of bucket) { const p = byHash[h]; fd.append(h, new Blob([await b64(RAW + encodeURI(p))], { type: CT[p.split('.').pop()] || 'application/octet-stream' }), h); }
    const r = await (await fetch(`/api/v4/accounts/${A}/workers/assets/upload?base64=true`, { method: 'POST', headers: { 'x-atok': atok, 'Authorization': 'Bearer ' + sess.jwt }, body: fd })).json();
    st.step = 'bucket ' + bi; if (r.result?.jwt) completion = r.result.jwt; if (!r.success) throw new Error('upload ' + JSON.stringify(r.errors));
  }
  const meta = { main_module: 'worker.js', compatibility_date: '2026-11-01',
    bindings: [{ type: 'assets', name: 'ASSETS' }, { type: 'd1', name: 'DB', id: DB }, { type: 'send_email', name: 'MAILER', destination_address: 'jes@thinkpeople.eu' }],
    assets: { jwt: completion, config: { html_handling: 'auto-trailing-slash', not_found_handling: '404-page', run_worker_first: true } } };
  const fd = new FormData(); fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' })); fd.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
  const d = await (await fetch(`/api/v4/accounts/${A}/workers/scripts/dispatch-house`, { method: 'PUT', headers: { 'x-atok': atok }, body: fd })).json();
  st.step = 'deployed ' + d.success + ' ' + JSON.stringify(d.errors);
  if (!d.success) return st;
  // custom domains (zone dispatch-house.com)
  for (const host of ['dispatch-house.com', 'www.dispatch-house.com']) {
    const r = await (await fetch(`/api/v4/accounts/${A}/workers/domains`, { method: 'PUT', headers: { 'x-atok': atok, 'content-type': 'application/json' }, body: JSON.stringify({ hostname: host, service: 'dispatch-house', environment: 'production', zone_id: '3922f7a67e2ca5446058eef196edc6b5' }) })).json();
    st['domain ' + host] = r.success ? 'ok' : JSON.stringify(r.errors);
  }
  st.done = true; return st;
};
