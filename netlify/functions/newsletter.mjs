// Newsletter-Anmeldung mit Double-Opt-in über die Brevo-API (Liste „Shop-Newsletter“, Template #1)
const LISTE = 'Shop-Newsletter';
const TEMPLATE = 1;
let listId = null;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function brevo(pfad, opt = {}) {
  const r = await fetch('https://api.brevo.com/v3' + pfad, {
    ...opt,
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { fehler: 'Nur POST.' });
  let d;
  try { d = await req.json(); } catch { return json(400, { fehler: 'Ungültige Anfrage.' }); }
  if (d.website) return json(200, { ok: true }); // Honigtopf für Bots
  const email = String(d.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  try {
    if (!listId) {
      const l = await brevo('/contacts/lists?limit=50');
      if (!l.ok) throw new Error('Listen ' + l.status + ' ' + l.text);
      const liste = (JSON.parse(l.text).lists || []).find((x) => x.name === LISTE);
      if (!liste) throw new Error('Liste fehlt');
      listId = liste.id;
    }
    const r = await brevo('/contacts/doubleOptinConfirmation', {
      method: 'POST',
      body: JSON.stringify({ email, includeListIds: [listId], templateId: TEMPLATE, redirectionUrl: 'https://bildungsmanufaktur.shop/newsletter-bestaetigt.html' }),
    });
    if (!r.ok && r.status !== 204) throw new Error('DOI ' + r.status + ' ' + r.text);
  } catch (e) {
    console.error(e.message);
    return json(502, { fehler: 'Die Anmeldung hat gerade nicht geklappt. Bitte versuch es später noch einmal.' });
  }
  return json(200, { ok: true });
};

export const config = { path: '/api/newsletter' };
