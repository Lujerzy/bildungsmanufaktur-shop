// Stripe-Webhook: schickt nach erfolgreicher Zahlung den Download-Link per E-Mail.
import crypto from 'node:crypto';
import katalog from './katalog.json' with { type: 'json' };
import { sendeMail, esc, rahmen } from './mail.mjs';

const DL = 'https://bm-downloads.lukas-jaskolka.workers.dev/d/';

function signaturOk(roh, kopf, geheim) {
  if (!kopf || !geheim) return false;
  const teile = Object.fromEntries(kopf.split(',').map((t) => t.split('=')));
  const t = teile.t;
  const sigs = kopf.split(',').filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const soll = crypto.createHmac('sha256', geheim).update(`${t}.${roh}`).digest('hex');
  return sigs.some((s) => s.length === soll.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(soll)));
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('nur POST', { status: 405 });
  const roh = await req.text();
  if (!signaturOk(roh, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) return new Response('Signatur ungültig', { status: 400 });
  const ev = JSON.parse(roh);
  if (ev.type !== 'checkout.session.completed' && ev.type !== 'checkout.session.async_payment_succeeded') return new Response('ignoriert');
  const s = ev.data.object;
  if (s.payment_status !== 'paid') return new Response('noch nicht bezahlt');
  const email = s.customer_details?.email || s.customer_email;
  const name = s.customer_details?.name || '';
  const pos = (s.metadata?.positionen || '').split(',').filter(Boolean).map((p) => {
    const [id, l] = p.split(':');
    return `<li>${esc(katalog[id]?.titel || id)} (${l === 'S' ? 'Schullizenz' : 'Einzellizenz'})</li>`;
  }).join('');
  const link = DL + s.id;
  const inhalt = `<h2 style="margin-top:0">Danke für deine Bestellung!</h2>
<p>Deine Zahlung ist eingegangen. Hier sind deine Materialien:</p><ul>${pos}</ul>
<p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#E07A2E;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;border:2px solid #262830;display:inline-block">Zu deinen Downloads</a></p>
<p>Der Link gilt 30 Tage – lade die Dateien am besten gleich herunter und speichere sie. Die Rechnung kommt in einer separaten E-Mail von Stripe.</p>
<p style="font-size:14px;color:#555">Du hast vor dem Kauf zugestimmt, dass der Download sofort beginnt, und bestätigt, dass dein Widerrufsrecht damit erlischt. Diese E-Mail ist zugleich deine Vertragsbestätigung.</p>
<p>Viel Freude im Unterricht!<br>Lukas von der Bildungsmanufaktur</p>`;
  try {
    await sendeMail({ an: email, name, betreff: 'Deine Downloads von der Bildungsmanufaktur', html: rahmen(inhalt), kopieAnShop: true });
  } catch (e) {
    console.error(e.message);
    return new Response('Mail fehlgeschlagen', { status: 500 }); // Stripe versucht es später erneut
  }
  return new Response('ok');
};

export const config = { path: '/api/stripe-webhook' };
