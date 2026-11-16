// Gemeinsamer Brevo-Versand (transaktionale E-Mails)
export async function sendeMail({ an, name, betreff, html, kopieAnShop = false }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY fehlt');
  const body = {
    sender: { name: 'Bildungsmanufaktur', email: 'kontakt@bildungsmanufaktur.shop' },
    to: [{ email: an, name: name || an }],
    replyTo: { email: 'kontakt@bildungsmanufaktur.shop', name: 'Bildungsmanufaktur' },
    subject: betreff,
    htmlContent: html,
  };
  if (kopieAnShop) body.bcc = [{ email: 'kontakt@bildungsmanufaktur.shop' }];
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Brevo ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const rahmen = (inhalt) => `<div style="font-family:Arial,sans-serif;background:#FFF8EC;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border:2px solid #262830;border-radius:14px;padding:24px;color:#262830;font-size:16px;line-height:1.5">${inhalt}<p style="font-size:13px;color:#666;margin-top:24px">Bildungsmanufaktur · Lukas Jaskolka · Paul-Klee-Straße 72 · 24539 Neumünster · kontakt@bildungsmanufaktur.shop</p></div></div>`;
