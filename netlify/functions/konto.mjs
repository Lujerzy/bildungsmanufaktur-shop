// "Meine Materialien": schickt Käufer:innen einen Zugangslink (ohne Passwort) zu allen Käufen.
import crypto from 'node:crypto';
import { sendeMail, esc, rahmen } from './mail.mjs';

const KONTO = 'https://bm-downloads.lukas-jaskolka.workers.dev/k/';
const TAGE = 7;
const json = (status, d) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
const b64 = (b) => Buffer.from(b).toString('base64url');

export function token(email, schluessel) {
  const key = crypto.createHash('sha256').update('bm-konto:' + schluessel).digest();
  const p = b64(email + '|' + (Math.floor(Date.now() / 1000) + TAGE * 86400));
  return p + '.' + crypto.createHmac('sha256', key).update(p).digest('base64url').slice(0, 32);
}

export async function kaeufe(email, schluessel) {
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100&status=complete&customer_details[email]=' + encodeURIComponent(email), { headers: { Authorization: `Bearer ${schluessel}` } });
  const d = await r.json();
  if (!r.ok) throw new Error('Stripe ' + (d.error && d.error.message));
  return d.data.filter((s) => s.payment_status === 'paid');
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { fehler: 'nur POST' });
  let email = '';
  try { email = String((await req.json()).email || '').trim(); } catch { /* leer */ }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json(400, { fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  const sk = process.env.STRIPE_SECRET_KEY;
  try {
    let liste = await kaeufe(email, sk);
    if (!liste.length && email !== email.toLowerCase()) liste = await kaeufe(email.toLowerCase(), sk);
    if (liste.length) {
      const link = KONTO + token(email, sk);
      const inhalt = `<h2 style="margin-top:0">Deine Materialien</h2>
<p>Hier ist dein persönlicher Zugang zu allen Materialien, die du mit <b>${esc(email)}</b> gekauft hast (${liste.length} ${liste.length === 1 ? 'Bestellung' : 'Bestellungen'}):</p>
<p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#E07A2E;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;border:2px solid #262830;display:inline-block">Meine Materialien öffnen</a></p>
<p>Der Link gilt ${TAGE} Tage. Danach kannst du dir unter bildungsmanufaktur.shop/meine-materialien.html jederzeit einen neuen schicken lassen.</p>
<p style="font-size:14px;color:#555">Du hast diesen Link nicht angefordert? Dann kannst du diese E-Mail einfach ignorieren.</p>`;
      await sendeMail({ an: email, betreff: 'Dein Zugang zu „Meine Materialien“', html: rahmen(inhalt) });
    }
    return json(200, { ok: true });
  } catch (e) {
    console.error('Konto', e.message);
    return json(502, { fehler: 'Das hat nicht geklappt.' });
  }
};

export const config = { path: '/api/konto' };
