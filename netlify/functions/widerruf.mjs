// Elektronische Widerrufsfunktion (§ 356a BGB): nimmt den Widerruf an und schickt sofort eine Eingangsbestätigung.
import { sendeMail, esc, rahmen } from './mail.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { fehler: 'Nur POST erlaubt.' });
  let d;
  try { d = await req.json(); } catch { return json(400, { fehler: 'Ungültige Anfrage.' }); }
  const name = String(d.name || '').trim().slice(0, 200);
  const vertrag = String(d.vertrag || '').trim().slice(0, 500);
  const email = String(d.email || '').trim().slice(0, 200);
  if (!name || !vertrag || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { fehler: 'Bitte alle Felder ausfüllen.' });
  const zeit = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'medium' }) + ' Uhr';
  const inhalt = `<h2 style="margin-top:0">Eingangsbestätigung deines Widerrufs</h2>
<p>Dein Widerruf ist am <b>${esc(zeit)}</b> bei mir eingegangen.</p>
<p><b>Inhalt deiner Widerrufserklärung:</b><br>Hiermit widerrufe ich den folgenden Vertrag.<br>Name: ${esc(name)}<br>Vertrag: ${esc(vertrag)}<br>E-Mail: ${esc(email)}</p>
<p>Ich prüfe den Widerruf und melde mich zur Rückzahlung bei dir. Bei digitalen Inhalten kann das Widerrufsrecht erloschen sein, wenn der Download mit deiner ausdrücklichen Zustimmung begonnen hat – auch dazu bekommst du eine Rückmeldung.</p>`;
  try {
    await sendeMail({ an: email, name, betreff: 'Eingangsbestätigung: Dein Widerruf', html: rahmen(inhalt), kopieAnShop: true });
  } catch (e) {
    console.error(e.message);
    return json(502, { fehler: 'Die Bestätigung konnte gerade nicht verschickt werden.' });
  }
  return json(200, { ok: true, zeit });
};

export const config = { path: '/api/widerruf' };
