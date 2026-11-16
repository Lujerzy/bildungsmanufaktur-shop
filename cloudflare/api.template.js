
// ======================= Shop-API (früher Netlify Functions) =======================
// Erreichbar über die Pages-Seite bildungsmanufaktur.shop/api/* (Service-Binding „API“) und direkt unter /api/*.
// Secrets im Worker: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BREVO_API_KEY
const DL_BASIS = 'https://bm-downloads.lukas-jaskolka.workers.dev';
const SHOP_URL = 'https://bildungsmanufaktur.shop';
const KONTO_TAGE = 7;
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function sendeMail(env, { an, name, betreff, html, kopieAnShop = false }) {
  if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY fehlt');
  const body = {
    sender: { name: 'Bildungsmanufaktur', email: 'kontakt@bildungsmanufaktur.shop' },
    to: [{ email: an, name: name || an }],
    replyTo: { email: 'kontakt@bildungsmanufaktur.shop', name: 'Bildungsmanufaktur' },
    subject: betreff, htmlContent: html,
  };
  if (kopieAnShop) body.bcc = [{ email: 'kontakt@bildungsmanufaktur.shop' }];
  const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Brevo ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
const rahmen = (inhalt) => `<div style="font-family:Arial,sans-serif;background:#FFF8EC;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border:2px solid #262830;border-radius:14px;padding:24px;color:#262830;font-size:16px;line-height:1.5">${inhalt}<p style="font-size:13px;color:#666;margin-top:24px">Bildungsmanufaktur · Lukas Jaskolka · Paul-Klee-Straße 72 · 24539 Neumünster · kontakt@bildungsmanufaktur.shop</p></div></div>`;
const brevo = (env, pfad, opt = {}) => fetch('https://api.brevo.com/v3' + pfad, { ...opt, headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' } });
const knopf = (href, text) => `<p style="text-align:center;margin:24px 0"><a href="${href}" style="background:#E07A2E;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;border:2px solid #262830;display:inline-block">${text}</a></p>`;

async function api(req, env, pfad) {
  if (req.method !== 'POST') return json(405, { fehler: 'Nur POST erlaubt.' });
  try {
    if (pfad === 'checkout') return await apiCheckout(req, env);
    if (pfad === 'stripe-webhook') return await apiWebhook(req, env);
    if (pfad === 'newsletter') return await apiNewsletter(req, env);
    if (pfad === 'konto') return await apiKonto(req, env);
    if (pfad === 'widerruf') return await apiWiderruf(req, env);
  } catch (e) {
    console.error(pfad, e && e.message);
    return json(502, { fehler: 'Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.' });
  }
  return json(404, { fehler: 'Unbekannt.' });
}

async function apiCheckout(req, env) {
  let d; try { d = await req.json(); } catch { return json(400, { fehler: 'Ungültige Anfrage.' }); }
  const { items = [], email = '', zustimmung = false } = d;
  if (!zustimmung) return json(400, { fehler: 'Bitte bestätige den Hinweis zum Widerrufsrecht.' });
  if (!MAIL_RE.test(email)) return json(400, { fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  const katalog = MANIFEST.preise;
  const pos = (Array.isArray(items) ? items : []).filter((i) => i && katalog[i.id]).slice(0, 50);
  if (!pos.length) return json(400, { fehler: 'Dein Warenkorb ist leer.' });
  const origin = new URL(req.url).origin;
  const p = new URLSearchParams();
  p.set('mode', 'payment'); p.set('customer_email', email); p.set('locale', 'de');
  p.set('success_url', `${origin}/danke.html?session_id={CHECKOUT_SESSION_ID}`);
  p.set('cancel_url', `${origin}/warenkorb.html`);
  p.set('payment_intent_data[description]', 'Bildungsmanufaktur – digitale Unterrichtsmaterialien');
  p.set('metadata[zustimmung_download]', 'ja');
  p.set('metadata[positionen]', pos.map((i) => `${i.id}:${i.lizenz === 'Schullizenz' ? 'S' : 'E'}`).join(',').slice(0, 490));
  p.set('invoice_creation[enabled]', 'true');
  p.set('invoice_creation[invoice_data][footer]', 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
  pos.forEach((i, n) => {
    const m = katalog[i.id], schul = i.lizenz === 'Schullizenz';
    p.set(`line_items[${n}][quantity]`, '1');
    p.set(`line_items[${n}][price_data][currency]`, 'eur');
    p.set(`line_items[${n}][price_data][unit_amount]`, String(Math.round((schul ? m.schul : m.preis) * 100)));
    p.set(`line_items[${n}][price_data][product_data][name]`, `${m.titel} (${schul ? 'Schullizenz' : 'Einzellizenz'})`);
    p.set(`line_items[${n}][price_data][product_data][metadata][material]`, i.id);
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p });
  const s = await r.json();
  if (!r.ok) { console.error('Stripe-Fehler', s.error && s.error.message); return json(502, { fehler: 'Die Bezahlung konnte nicht gestartet werden. Bitte versuch es gleich noch einmal.', code: (s.error && (s.error.code || s.error.type)) || String(r.status) }); }
  return json(200, { url: s.url });
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function signaturOk(roh, kopf, geheim) {
  if (!kopf || !geheim) return false;
  const teile = Object.fromEntries(kopf.split(',').map((t) => t.split('=')));
  const t = teile.t;
  const sigs = kopf.split(',').filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(geheim), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const soll = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${roh}`)));
  return sigs.includes(soll);
}

async function apiWebhook(req, env) {
  const roh = await req.text();
  if (!(await signaturOk(roh, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) return new Response('Signatur ungültig', { status: 400 });
  const ev = JSON.parse(roh);
  if (ev.type !== 'checkout.session.completed' && ev.type !== 'checkout.session.async_payment_succeeded') return new Response('ignoriert');
  const s = ev.data.object;
  if (s.payment_status !== 'paid') return new Response('noch nicht bezahlt');
  const email = (s.customer_details && s.customer_details.email) || s.customer_email;
  const name = (s.customer_details && s.customer_details.name) || '';
  const positionen = (s.metadata && s.metadata.positionen) || '';
  const pos = positionen.split(',').filter(Boolean).map((x) => {
    const [id, l] = x.split(':');
    const t = (MANIFEST.preise[id] && MANIFEST.preise[id].titel) || MANIFEST.titel[MANIFEST.slug[id]] || id;
    return `<li>${esc(t)} (${l === 'S' ? 'Schullizenz' : 'Einzellizenz'})</li>`;
  }).join('');
  const inhalt = `<h2 style="margin-top:0">Danke für deine Bestellung!</h2>
<p>Deine Zahlung ist eingegangen. Hier sind deine Materialien:</p><ul>${pos}</ul>
${knopf(DL_BASIS + '/d/' + s.id, 'Zu deinen Downloads')}
<p>Der Link bleibt gültig. Alle deine Käufe findest du außerdem jederzeit unter <a href="${SHOP_URL}/meine-materialien.html">Meine Materialien</a> – dort gibt es auch die aktualisierten Versionen, und ich sage dir per E-Mail Bescheid, wenn ein Material ein Update bekommt. Die Rechnung kommt in einer separaten E-Mail von Stripe.</p>
<p style="font-size:14px;color:#555">Du hast vor dem Kauf zugestimmt, dass der Download sofort beginnt, und bestätigt, dass dein Widerrufsrecht damit erlischt. Diese E-Mail ist zugleich deine Vertragsbestätigung.</p>
<p>Viel Freude im Unterricht!<br>Lukas von der Bildungsmanufaktur</p>
<p style="font-size:14px;background:#E3F4F1;padding:12px;border-radius:10px"><b>Lust auf Gratis-Material?</b> Neue Freebies und Rabatte zuerst: <a href="${SHOP_URL}/newsletter.html?email=${encodeURIComponent(email)}">Hier zum Newsletter anmelden</a> (mit Bestätigungs-Mail, jederzeit abbestellbar).</p>`;
  try {
    await sendeMail(env, { an: email, name, betreff: 'Deine Downloads von der Bildungsmanufaktur', html: rahmen(inhalt), kopieAnShop: true });
  } catch (e) {
    console.error(e.message);
    return new Response('Mail fehlgeschlagen', { status: 500 }); // Stripe versucht es später erneut
  }
  try { await kaeuferMerken(env, email, positionen); } catch (e) { console.error('Käuferliste', e.message); }
  return new Response('ok');
}

// Käufer:innen für Update-Hinweise merken (Brevo-Liste „Käufer – Updates“, Merkmal KAEUFE = gekaufte Materialien)
async function kaeuferMerken(env, email, positionen) {
  if (!env.BREVO_API_KEY || !email) return;
  const LISTE = 'Käufer – Updates';
  let liste = ((await (await brevo(env, '/contacts/lists?limit=50')).json()).lists || []).find((l) => l.name === LISTE);
  if (!liste) {
    const ordner = ((await (await brevo(env, '/contacts/folders?limit=10')).json()).folders || [])[0];
    liste = await (await brevo(env, '/contacts/lists', { method: 'POST', body: JSON.stringify({ name: LISTE, folderId: ordner ? ordner.id : 1 }) })).json();
  }
  await brevo(env, '/contacts/attributes/normal/KAEUFE', { method: 'POST', body: JSON.stringify({ type: 'text' }) });
  const neu = positionen.split(',').filter(Boolean).map((x) => x.split(':')[0]);
  let alt = [];
  const r = await brevo(env, '/contacts/' + encodeURIComponent(email));
  if (r.ok) alt = String(((await r.json()).attributes || {}).KAEUFE || '').split(' ').filter(Boolean);
  const res = await brevo(env, '/contacts', { method: 'POST', body: JSON.stringify({ email, attributes: { KAEUFE: [...new Set([...alt, ...neu])].join(' ').slice(0, 2000) }, listIds: [liste.id], updateEnabled: true }) });
  if (!res.ok) throw new Error('Brevo ' + res.status + ' ' + (await res.text()).slice(0, 150));
}

let nlListe = null;
async function apiNewsletter(req, env) {
  let d; try { d = await req.json(); } catch { return json(400, { fehler: 'Ungültige Anfrage.' }); }
  if (d.website) return json(200, { ok: true }); // Honigtopf für Bots
  const email = String(d.email || '').trim().toLowerCase().slice(0, 200);
  if (!MAIL_RE.test(email)) return json(400, { fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  if (!nlListe) {
    const l = await brevo(env, '/contacts/lists?limit=50');
    if (!l.ok) throw new Error('Listen ' + l.status);
    const liste = ((await l.json()).lists || []).find((x) => x.name === 'Shop-Newsletter');
    if (!liste) throw new Error('Liste fehlt');
    nlListe = liste.id;
  }
  const r = await brevo(env, '/contacts/doubleOptinConfirmation', { method: 'POST', body: JSON.stringify({ email, includeListIds: [nlListe], templateId: 1, redirectionUrl: SHOP_URL + '/newsletter-bestaetigt.html' }) });
  if (!r.ok && r.status !== 204) throw new Error('DOI ' + r.status + ' ' + (await r.text()).slice(0, 150));
  return json(200, { ok: true });
}

async function kontoToken(env, email) {
  const p = b64u(new TextEncoder().encode(email + '|' + (Math.floor(Date.now() / 1000) + KONTO_TAGE * 86400)));
  const roh = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bm-konto:' + env.STRIPE_SECRET_KEY));
  const key = await crypto.subtle.importKey('raw', roh, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return p + '.' + b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(p))).slice(0, 32);
}

async function apiKonto(req, env) {
  let email = ''; try { email = String((await req.json()).email || '').trim(); } catch { /* leer */ }
  if (!MAIL_RE.test(email) || email.length > 200) return json(400, { fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  let k = await kaeufe(env, email);
  if (k && !k.ids.length && email !== email.toLowerCase()) { email = email.toLowerCase(); k = await kaeufe(env, email); }
  if (!k) throw new Error('Stripe nicht erreichbar');
  if (k.ids.length) {
    const link = DL_BASIS + '/k/' + (await kontoToken(env, email));
    const inhalt = `<h2 style="margin-top:0">Deine Materialien</h2>
<p>Hier ist dein persönlicher Zugang zu allen Materialien, die du mit <b>${esc(email)}</b> gekauft hast (${k.ids.length} ${k.ids.length === 1 ? 'Material' : 'Materialien'}):</p>
${knopf(link, 'Meine Materialien öffnen')}
<p>Der Link gilt ${KONTO_TAGE} Tage. Danach kannst du dir unter bildungsmanufaktur.shop/meine-materialien.html jederzeit einen neuen schicken lassen.</p>
<p style="font-size:14px;color:#555">Du hast diesen Link nicht angefordert? Dann kannst du diese E-Mail einfach ignorieren.</p>`;
    await sendeMail(env, { an: email, betreff: 'Dein Zugang zu „Meine Materialien“', html: rahmen(inhalt) });
  }
  return json(200, { ok: true });
}

async function apiWiderruf(req, env) {
  let d; try { d = await req.json(); } catch { return json(400, { fehler: 'Ungültige Anfrage.' }); }
  const name = String(d.name || '').trim().slice(0, 200);
  const vertrag = String(d.vertrag || '').trim().slice(0, 500);
  const email = String(d.email || '').trim().slice(0, 200);
  if (!name || !vertrag || !MAIL_RE.test(email)) return json(400, { fehler: 'Bitte alle Felder ausfüllen.' });
  const zeit = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'medium' }) + ' Uhr';
  const inhalt = `<h2 style="margin-top:0">Eingangsbestätigung deines Widerrufs</h2>
<p>Dein Widerruf ist am <b>${esc(zeit)}</b> bei mir eingegangen.</p>
<p><b>Inhalt deiner Widerrufserklärung:</b><br>Hiermit widerrufe ich den folgenden Vertrag.<br>Name: ${esc(name)}<br>Vertrag: ${esc(vertrag)}<br>E-Mail: ${esc(email)}</p>
<p>Ich prüfe den Widerruf und melde mich zur Rückzahlung bei dir. Bei digitalen Inhalten kann das Widerrufsrecht erloschen sein, wenn der Download mit deiner ausdrücklichen Zustimmung begonnen hat – auch dazu bekommst du eine Rückmeldung.</p>`;
  try { await sendeMail(env, { an: email, name, betreff: 'Eingangsbestätigung: Dein Widerruf', html: rahmen(inhalt), kopieAnShop: true }); }
  catch (e) { console.error(e.message); return json(502, { fehler: 'Die Bestätigung konnte gerade nicht verschickt werden.' }); }
  return json(200, { ok: true, zeit });
}
