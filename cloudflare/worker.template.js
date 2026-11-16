// Bildungsmanufaktur – Download-Auslieferung (Cloudflare Worker mit R2-Bucket "BUCKET")
// Secret: STRIPE_SECRET_KEY. Links: /d/<checkout_session_id>  und  /f/<session>/<datei-key>
const MANIFEST = __MANIFEST__; // { dateien: {eduki: [key,...]}, pakete: {eduki: [eduki,...]}, titel: {eduki: titel}, slug: {slug: eduki}, gratis: [eduki] }
const TAGE = 30;
const SHOP = 'https://bildungsmanufaktur.shop';

const anzeige = (k) => { const d = k.split('/').pop().replace(/^\d+_/, ''); const m = d.match(/^(.*)\.([A-Za-z0-9]+)$/); const n = (m ? m[1] : d).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); return `<span>${esc(n)}</span>` + (m ? `<i>${esc(m[2].toUpperCase())}</i>` : ''); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const seite = (titel, inhalt, status = 200) => new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titel)} | Bildungsmanufaktur</title>
<style>body{font-family:system-ui,sans-serif;background:#FFF8EC;color:#262830;margin:0;padding:32px 16px}main{max-width:720px;margin:auto;background:#fff;border:2.5px solid #262830;border-radius:18px;box-shadow:4px 4px 0 #262830;padding:28px}h1{margin-top:0;font-size:28px}ul{padding:0;list-style:none}li{margin:14px 0;padding:14px;border:2px solid #262830;border-radius:12px}a.btn{display:flex;justify-content:space-between;align-items:center;gap:10px;box-sizing:border-box;max-width:100%;margin-top:8px;background:#E07A2E;color:#fff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.3;padding:10px 16px;border-radius:14px;border:2px solid #262830;overflow-wrap:anywhere}a.btn i{font-style:normal;font-size:12px;background:#fff;color:#262830;border-radius:6px;padding:2px 7px;flex-shrink:0}small{color:#666}</style></head><body><main>${inhalt}<p><small><a href="${SHOP}">Zurück zum Shop</a> · Fragen? kontakt@bildungsmanufaktur.shop</small></p></main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

function materialien(liste) {
  const out = new Set();
  const add = (id) => { if (MANIFEST.pakete[id]) MANIFEST.pakete[id].forEach(add); else out.add(id); };
  liste.forEach(add);
  return [...out];
}

async function sitzung(env, id) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return null;
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  if (!r.ok) return null;
  const s = await r.json();
  if (s.payment_status !== 'paid') return null;
  if (Date.now() / 1000 - s.created > TAGE * 86400) return { abgelaufen: true };
  const pos = (s.metadata && s.metadata.positionen || '').split(',').filter(Boolean).map((p) => p.split(':')[0]);
  const ids = pos.map((slug) => MANIFEST.slug[slug]).filter(Boolean);
  return { ids: materialien(ids) };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const teile = url.pathname.split('/').filter(Boolean);
    if (teile[0] === 'd' && teile[1]) {
      const s = await sitzung(env, teile[1]);
      if (!s) return seite('Nicht gefunden', '<h1>Dieser Download-Link ist ungültig.</h1><p>Bitte prüfe den Link aus deiner E-Mail oder schreib mir.</p>', 404);
      if (s.abgelaufen) return seite('Abgelaufen', `<h1>Dieser Download-Link ist abgelaufen.</h1><p>Links gelten ${TAGE} Tage. Schreib mir kurz, dann schicke ich dir einen neuen.</p>`, 410);
      const listen = await Promise.all(s.ids.map((id) => dateien(env, id)));
      const li = s.ids.map((id, n) => `<li><b>${esc(MANIFEST.titel[id] || id)}</b><br>${listen[n].map((k) => `<a class="btn" href="/f/${teile[1]}/${encodeURIComponent(k)}">${anzeige(k)}</a>`).join(' ') || '<small>Datei folgt per E-Mail.</small>'}</li>`).join('');
      return seite('Deine Downloads', `<h1>Deine Downloads</h1><p>Danke für deinen Kauf! Hier kannst du deine Materialien herunterladen. Der Link gilt ${TAGE} Tage.</p><ul>${li}</ul>`);
    }
    if (teile[0] === 'f' && teile[1] && teile[2]) {
      const key = decodeURIComponent(teile.slice(2).join('/'));
      const s = await sitzung(env, teile[1]);
      if (!s || s.abgelaufen) return seite('Kein Zugriff', '<h1>Kein Zugriff.</h1>', 403);
      const erlaubt = s.ids.some((id) => key.startsWith(id + '_'));
      if (!erlaubt) return seite('Kein Zugriff', '<h1>Kein Zugriff.</h1>', 403);
      return datei(env, key);
    }
    if (teile[0] === 'gratis' && teile[1]) {
      const id = teile[1];
      if (!MANIFEST.gratis.includes(id)) return seite('Nicht gefunden', '<h1>Nicht gefunden.</h1>', 404);
      if (teile[2]) {
        const key = decodeURIComponent(teile.slice(2).join('/'));
        if (!key.startsWith(id + '_')) return seite('Nicht gefunden', '<h1>Nicht gefunden.</h1>', 404);
        return datei(env, key);
      }
      const links = (await dateien(env, id)).map((k) => `<a class="btn" href="/gratis/${id}/${encodeURIComponent(k)}">${anzeige(k)}</a>`).join(' ');
      return seite('Gratis-Download', `<h1>${esc(MANIFEST.titel[id] || 'Gratis-Download')}</h1><p>Viel Freude damit!</p><p>${links}</p>`);
    }
    return Response.redirect(SHOP, 302);
  },
};

async function dateien(env, id) {
  const r = await env.BUCKET.list({ prefix: id + '_', limit: 100 });
  return r.objects.map((o) => o.key).sort();
}

async function datei(env, key) {
  const o = await env.BUCKET.get(key);
  if (!o) return seite('Fehlt', '<h1>Diese Datei wird gerade aktualisiert.</h1><p>Bitte schreib mir kurz, ich schicke sie dir direkt.</p>', 404);
  const h = new Headers();
  o.writeHttpMetadata(h);
  h.set('content-type', key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.zip') ? 'application/zip' : 'application/octet-stream');
  h.set('content-disposition', `attachment; filename="${key.split('/').pop().replace(/"/g, '')}"`);
  h.set('cache-control', 'private, no-store');
  return new Response(o.body, { headers: h });
}
