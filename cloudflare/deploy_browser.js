// Veröffentlicht Shop-Seite (Ordner site/ als statische Assets) + Worker-Code auf den Worker „bm-downloads“.
// Läuft im eingeloggten Cloudflare-Dashboard-Tab: (await import? nein) -> per eval mit window.__SHA gesetzt.
(async () => {
  const A = '4289e4895795335ab087cdd8980d8604', W = 'bm-downloads', REPO = 'Lujerzy/bildungsmanufaktur-shop', SHA = window.__SHA;
  const log = (m) => { window.__log = (window.__log || []).concat(m); };
  const MIME = { html: 'text/html', css: 'text/css', js: 'application/javascript', json: 'application/json', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', txt: 'text/plain', ico: 'image/x-icon', xml: 'application/xml', pdf: 'application/pdf' };
  const tree = await (await fetch(`https://api.github.com/repos/${REPO}/git/trees/${SHA}?recursive=1`)).json();
  const files = tree.tree.filter((t) => t.type === 'blob' && t.path.startsWith('site/')).map((t) => t.path.slice(5));
  log('Dateien: ' + files.length);
  const inhalt = {};
  const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const manifest = {};
  let i = 0;
  async function lade() {
    while (i < files.length) {
      const f = files[i++];
      const buf = await (await fetch(`https://raw.githubusercontent.com/${REPO}/${SHA}/site/${f.split('/').map(encodeURIComponent).join('/')}`)).arrayBuffer();
      const b = b64(buf), ext = f.split('.').pop().toLowerCase();
      const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(b + ext)))].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
      inhalt[h] = { b, typ: MIME[ext] || 'application/octet-stream' };
      manifest['/' + f] = { hash: h, size: buf.byteLength };
    }
  }
  await Promise.all(Array.from({ length: 12 }, lade));
  log('geladen');
  const api = (p, o = {}) => fetch('/api/v4/accounts/' + A + p, { credentials: 'include', ...o });
  const s = await (await api(`/workers/scripts/${W}/assets-upload-session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ manifest }) })).json();
  if (!s.success) { log('Session-Fehler ' + JSON.stringify(s.errors)); return; }
  let fertigJwt = s.result.jwt;
  const buckets = s.result.buckets || [];
  log('Buckets: ' + buckets.length + ' (' + buckets.flat().length + ' neue Dateien)');
  for (const b of buckets) {
    const fd = new FormData();
    b.forEach((h) => fd.append(h, new Blob([inhalt[h].b], { type: inhalt[h].typ }), h));
    const r = await (await fetch('/api/v4/accounts/' + A + '/workers/assets/upload?base64=true', { method: 'POST', headers: { Authorization: 'Bearer ' + s.result.jwt }, body: fd, credentials: 'include' })).json();
    if (!r.success) { log('Upload-Fehler ' + JSON.stringify(r.errors)); return; }
    if (r.result && r.result.jwt) fertigJwt = r.result.jwt;
  }
  log('hochgeladen');
  const code = await (await fetch(`https://raw.githubusercontent.com/${REPO}/${SHA}/cloudflare/worker.js`)).text();
  const meta = { main_module: 'worker.js', compatibility_date: '2024-11-01', assets: { jwt: fertigJwt, config: { html_handling: 'auto-trailing-slash' } },
    bindings: [{ type: 'assets', name: 'ASSETS' }, { type: 'r2_bucket', name: 'BUCKET', bucket_name: 'bm-downloads' }], keep_bindings: ['secret_text'] };
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  fd.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
  const r = await (await api(`/workers/scripts/${W}`, { method: 'PUT', body: fd })).json();
  log(r.success ? 'VERÖFFENTLICHT ' + SHA.slice(0, 7) : 'Worker-Fehler ' + JSON.stringify(r.errors));
})().catch((e) => { window.__log = (window.__log || []).concat('FEHLER ' + e.message); });
