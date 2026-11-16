// Bildungsmanufaktur – Download-Auslieferung (Cloudflare Worker mit R2-Bucket "BUCKET")
// Secret: STRIPE_SECRET_KEY. Links: /d/<checkout_session_id>  und  /f/<session>/<datei-key>
const MANIFEST = __MANIFEST__; // { dateien: {eduki: [key,...]}, pakete: {eduki: [eduki,...]}, titel: {eduki: titel}, slug: {slug: eduki}, gratis: [eduki] }
const TAGE = 36500; // Kauf-Links bleiben dauerhaft gültig
const SHOP = 'https://bildungsmanufaktur.shop';

const anzeige = (k) => { const d = k.split('/').pop().replace(/^\d+_/, ''); const m = d.match(/^(.*)\.([A-Za-z0-9]+)$/); const n = (m ? m[1] : d).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); return `<span>${esc(n)}</span>` + (m ? `<i>${esc(m[2].toUpperCase())}</i>` : ''); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const seite = (titel, inhalt, status = 200) => new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titel)} | Bildungsmanufaktur</title>
<style>body{font-family:system-ui,sans-serif;background:#FFF8EC;color:#262830;margin:0;padding:32px 16px}main{max-width:720px;margin:auto;background:#fff;border:2.5px solid #262830;border-radius:18px;box-shadow:4px 4px 0 #262830;padding:28px}h1{margin-top:0;font-size:28px}ul{padding:0;list-style:none}li{margin:14px 0;padding:14px;border:2px solid #262830;border-radius:12px}a.btn{display:flex;justify-content:space-between;align-items:center;gap:10px;box-sizing:border-box;max-width:100%;margin-top:8px;background:#E07A2E;color:#fff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.3;padding:10px 16px;border-radius:14px;border:2px solid #262830;overflow-wrap:anywhere}a.btn i{font-style:normal;font-size:12px;background:#fff;color:#262830;border-radius:6px;padding:2px 7px;flex-shrink:0}small{color:#666}</style></head><body><main>${inhalt}<p><small><a href="${SHOP}">Zurück zum Shop</a> · Fragen? kontakt@bildungsmanufaktur.shop</small></p></main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

const NL = `<div style="margin-top:22px;padding:16px;border:2px dashed #262830;border-radius:12px;background:#E3F4F1"><b>Lust auf mehr Gratis-Material?</b><br>Neue Freebies, Saisonmaterial und Rabatte zuerst – etwa einmal im Monat. <a href="${SHOP}/newsletter.html" style="font-weight:700;color:#1F6F78">Zum Newsletter anmelden →</a></div>`;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function tokenPruefen(env, t) {
  const [p, sig] = String(t).split('.');
  if (!p || !sig) return null;
  const roh = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bm-konto:' + env.STRIPE_SECRET_KEY));
  const key = await crypto.subtle.importKey('raw', roh, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const soll = b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(p))).slice(0, 32);
  if (soll !== sig) return null;
  let txt; try { txt = new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))); } catch { return null; }
  const i = txt.lastIndexOf('|'); const email = txt.slice(0, i), bis = Number(txt.slice(i + 1));
  if (!email || !(bis > Date.now() / 1000)) return { abgelaufen: true };
  return { email };
}
async function kaeufe(env, email) {
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100&status=complete&customer_details[email]=' + encodeURIComponent(email), { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  if (!r.ok) return null;
  const d = await r.json();
  const ids = [], datum = {};
  d.data.filter((s) => s.payment_status === 'paid').sort((a, b) => b.created - a.created).forEach((s) => {
    const slugs = (s.metadata && s.metadata.positionen || '').split(',').filter(Boolean).map((x) => x.split(':')[0]);
    materialien(slugs.map((x) => MANIFEST.slug[x]).filter(Boolean)).forEach((id) => { if (!ids.includes(id)) { ids.push(id); datum[id] = s.created; } });
  });
  return { ids, datum };
}

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
    if (teile[0] === 'api' && teile[1]) return api(req, env, teile[1]);
    if (teile[0] === 'd' && teile[1]) {
      const s = await sitzung(env, teile[1]);
      if (!s) return seite('Nicht gefunden', '<h1>Dieser Download-Link ist ungültig.</h1><p>Bitte prüfe den Link aus deiner E-Mail oder schreib mir.</p>', 404);
      if (s.abgelaufen) return seite('Abgelaufen', `<h1>Dieser Download-Link ist abgelaufen.</h1><p>Links gelten ${TAGE} Tage. Schreib mir kurz, dann schicke ich dir einen neuen.</p>`, 410);
      const listen = await Promise.all(s.ids.map((id) => dateien(env, id)));
      const li = s.ids.map((id, n) => `<li><b>${esc(MANIFEST.titel[id] || id)}</b><br>${listen[n].map((k) => `<a class="btn" href="/f/${teile[1]}/${encodeURIComponent(k)}">${anzeige(k)}</a>`).join(' ') || '<small>Datei folgt per E-Mail.</small>'}</li>`).join('');
      return seite('Deine Downloads', `<h1>Deine Downloads</h1><p>Danke für deinen Kauf! Hier kannst du deine Materialien herunterladen. Der Link bleibt gültig – alle Käufe findest du außerdem jederzeit unter <a href="${SHOP}/meine-materialien.html">Meine Materialien</a>.</p>${NL}<ul>${li}</ul>`);
    }
    if (teile[0] === 'f' && teile[1] && teile[2]) {
      const key = decodeURIComponent(teile.slice(2).join('/'));
      const s = await sitzung(env, teile[1]);
      if (!s || s.abgelaufen) return seite('Kein Zugriff', '<h1>Kein Zugriff.</h1>', 403);
      const erlaubt = s.ids.some((id) => key.startsWith(id + '_'));
      if (!erlaubt) return seite('Kein Zugriff', '<h1>Kein Zugriff.</h1>', 403);
      return datei(env, key);
    }
    if ((teile[0] === 'k' || teile[0] === 'kf') && teile[1]) {
      const t = await tokenPruefen(env, teile[1]);
      if (!t) return seite('Ungültig', `<h1>Dieser Link ist ungültig.</h1><p><a href="${SHOP}/meine-materialien.html">Hier neuen Zugangslink anfordern</a></p>`, 404);
      if (t.abgelaufen) return seite('Abgelaufen', `<h1>Dieser Zugangslink ist abgelaufen.</h1><p>Aus Sicherheitsgründen gilt er 7 Tage. <a href="${SHOP}/meine-materialien.html">Hier bekommst du sofort einen neuen.</a></p>`, 410);
      const k = await kaeufe(env, t.email);
      if (!k) return seite('Fehler', '<h1>Gerade nicht erreichbar.</h1><p>Bitte versuch es in ein paar Minuten noch einmal.</p>', 502);
      if (teile[0] === 'kf' && teile[2]) {
        const key = decodeURIComponent(teile.slice(2).join('/'));
        if (!k.ids.some((id) => key.startsWith(id + '_'))) return seite('Kein Zugriff', '<h1>Kein Zugriff.</h1>', 403);
        return datei(env, key);
      }
      const listen = await Promise.all(k.ids.map((id) => dateien(env, id)));
      const dat = (x) => new Date(x * 1000).toLocaleDateString('de-DE');
      const li = k.ids.map((id, n) => `<li><b>${esc(MANIFEST.titel[id] || id)}</b><br><small>gekauft am ${dat(k.datum[id])}</small>${listen[n].map((f) => `<a class="btn" href="/kf/${teile[1]}/${encodeURIComponent(f)}">${anzeige(f)}</a>`).join('') || '<br><small>Datei folgt per E-Mail.</small>'}</li>`).join('');
      return seite('Meine Materialien', `<h1>Meine Materialien</h1><p>Angemeldet als <b>${esc(t.email)}</b>. Hier findest du alle deine Käufe – immer in der aktuellsten Version.</p>${k.ids.length ? `<ul>${li}</ul>` : '<p>Zu dieser Adresse habe ich keine Käufe gefunden.</p>'}${NL}`);
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
      return seite('Gratis-Download', `<h1>${esc(MANIFEST.titel[id] || 'Gratis-Download')}</h1><p>Viel Freude damit!</p><p>${links}</p>${NL}`);
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
