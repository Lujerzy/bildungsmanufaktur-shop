// Erstellt eine Stripe-Checkout-Sitzung. Preise kommen nur aus katalog.json (nicht aus dem Browser).
import katalog from './katalog.json' with { type: 'json' };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { fehler: 'Nur POST erlaubt.' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(503, { fehler: 'Die Bezahlung ist noch nicht freigeschaltet.' });
  let daten;
  try { daten = await req.json(); } catch { return json(400, { fehler: 'Ungültige Anfrage.' }); }
  const { items = [], email = '', zustimmung = false } = daten;
  if (!zustimmung) return json(400, { fehler: 'Bitte bestätige den Hinweis zum Widerrufsrecht.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  const pos = items.filter((i) => katalog[i.id]).slice(0, 50);
  if (!pos.length) return json(400, { fehler: 'Dein Warenkorb ist leer.' });

  const origin = new URL(req.url).origin;
  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('customer_email', email);
  p.set('locale', 'de');
  p.set('success_url', `${origin}/danke.html?session_id={CHECKOUT_SESSION_ID}`);
  p.set('cancel_url', `${origin}/warenkorb.html`);
  p.set('payment_intent_data[description]', 'Bildungsmanufaktur – digitale Unterrichtsmaterialien');
  p.set('metadata[zustimmung_download]', 'ja');
  p.set('metadata[positionen]', pos.map((i) => `${i.id}:${i.lizenz === 'Schullizenz' ? 'S' : 'E'}`).join(',').slice(0, 490));
  p.set('invoice_creation[enabled]', 'true');
  p.set('invoice_creation[invoice_data][footer]', 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
  pos.forEach((i, n) => {
    const m = katalog[i.id];
    const schul = i.lizenz === 'Schullizenz';
    const cent = Math.round((schul ? m.schul : m.preis) * 100);
    p.set(`line_items[${n}][quantity]`, '1');
    p.set(`line_items[${n}][price_data][currency]`, 'eur');
    p.set(`line_items[${n}][price_data][unit_amount]`, String(cent));
    p.set(`line_items[${n}][price_data][product_data][name]`, `${m.titel} (${schul ? 'Schullizenz' : 'Einzellizenz'})`);
    p.set(`line_items[${n}][price_data][product_data][metadata][material]`, i.id);
  });

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p,
  });
  const s = await r.json();
  if (!r.ok) { console.error('Stripe-Fehler', s.error && s.error.message); return json(502, { fehler: 'Die Bezahlung konnte nicht gestartet werden. Bitte versuch es gleich noch einmal.', code: (s.error && (s.error.code || s.error.type)) || String(r.status), hinweis: ((s.error && s.error.message) || '').replace(/(sk|rk)_(live|test)_[A-Za-z0-9*]+/g, (k) => k.slice(0, 8) + '…' + k.slice(-4)).slice(0, 200) }); }
  return json(200, { url: s.url });
};

export const config = { path: '/api/checkout' };
