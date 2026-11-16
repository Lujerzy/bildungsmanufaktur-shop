#!/usr/bin/env python3
"""Erzeugt die statische Shop-Seite der Bildungsmanufaktur nach /home/claude/site."""
import html, json, os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'site')
PREIS_FEHLT = 'Preis folgt'
import hashlib
VER = hashlib.md5(b''.join(open(os.path.join(OUT, 'assets', p), 'rb').read() for p in ('css/site.css', 'js/site.js'))).hexdigest()[:8]
E = html.escape

from katalog import laden, euro, SCHUL_FAKTOR
P = laden()
BY = {m['eduki']: m for m in P}

import re as _re
DESC = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'beschreibungen.json')))
_EMO = _re.compile(r'^[\W_]+\s*', _re.U)
def _clean(z):
    z = _re.sub(r':?\s*https?://\S+', '', z).strip()
    return z
def beschreibung(eid):
    """liefert (unterzeile, lead, html, kurztext)"""
    d = DESC.get(eid)
    if not d: return '', '', '', ''
    zs = [_clean(z) for z in d['text'].split('\n')]
    zs = [z for z in zs if z and not z.startswith('⭐') and 'Folge der Bildungsmanufaktur' not in z]
    out = []
    for z in zs:
        if _re.sub(_EMO, '', z).strip().lower().startswith('passend dazu'): break
        out.append(z)
    if not out: return '', '', '', ''
    sub = _re.sub(r'^[^\wÄÖÜäöü„"]+|[^\w.!?)“"]+$', '', out[0]).strip()
    rest = out[1:]
    lead = rest[0] if rest and len(rest[0]) > 90 else ''
    if lead: rest = rest[1:]
    html_, liste = [], []
    def flush():
        if liste: html_.append('<ul class="ticks">' + ''.join(f'<li>{x}</li>' for x in liste) + '</ul>'); liste.clear()
    for z in rest:
        nackt = _re.sub(_EMO, '', z).strip()
        m = _re.match(r'^(Einsatz|Fördert|Umfang|Dauer|Klasse|Fächer|Differenzierung):\s*(.+)$', nackt)
        if m:
            flush(); html_.append(f'<p><b>{E(m.group(1))}:</b> {E(m.group(2))}</p>')
        elif len(nackt) < 42 and not nackt.endswith(('.', ':')) and (z != nackt or nackt.istitle() or nackt.split()[0] in ('Das', 'Im', 'So', 'Für', 'Was', 'Inhalt', 'Aufbau')) and not _re.search(r'\d', nackt[:2]):
            flush(); html_.append(f'<h3>{E(nackt)}</h3>')
        elif len(nackt) < 160 and not _re.search(r'[.!?]\s+\S', nackt):
            liste.append(E(nackt))
        else:
            flush(); html_.append(f'<p>{E(nackt)}</p>')
    flush()
    kurz = _re.split(r'(?<=[.!?])\s', lead or sub)[0] if (lead or sub) else ''
    if len(kurz) > 150: kurz = kurz[:147].rsplit(' ', 1)[0] + ' …'
    return sub, lead, '\n'.join(html_), kurz

for _m in P:
    _sub, _lead, _html, _kurz = beschreibung(_m['eduki'])
    _m['sub'], _m['lead'], _m['desc'] = _sub, _lead, _html
    if _kurz: _m['info'] = _kurz
BADGE_BG = {'Neu': '#E0605A', 'Sparpaket': '#D1497A', 'Reihe': '#2E8C9A', 'Gratis': '#3E9E6A'}

FAECHER = [('Deutsch', 'feder_tinte.webp', '#FBE1DF'), ('Mathematik', 'geodreieck.webp', '#DFE8F8'),
           ('Sachunterricht', 'arbeitsblaetter.webp', '#DDF2E5'), ('Verbraucherbildung', 'sparschwein.webp', '#FFF0CC'),
           ('Sport', 'fussball_schuh.webp', '#DAF0F2'), ('Ernährung & Gesundheit', 'ruehrschuessel.webp', '#FADDE8'),
           ('Weltkunde & Geschichte', 'globus.webp', '#DFE8F8'), ('Englisch', 'sprechblase.webp', '#ECE3F8'),
           ('Ethik & Religion', 'denkblase.webp', '#FFF0CC'), ('Klassenleben', 'abzeichen.webp', '#DAF0F2'),
           ('Kunst & Basteln', 'farbpalette_pinsel.webp', '#FADDE8'), ('Rätsel & Spiele', 'puzzle.webp', '#DDF2E5'),
           ('Saison & Feste', 'buecherstapel.webp', '#FBE1DF')]
FANZ = {}
for _m in P: FANZ[_m['fach']] = FANZ.get(_m['fach'], 0) + 1

NAV = [('/', 'Start'), ('/materialien.html', 'Materialien'), ('/materialien.html?art=Sparpaket', 'Sparpakete'),
       ('/gratis.html', 'Gratis'), ('/#ueber', 'Über mich')]


def head(title, desc, active=''):
    nav = '\n'.join(
        f'<a href="{h}"{" class=gratis" if l == "Gratis" else ""}{" aria-current=page" if l == active else ""}>{l}</a>'
        for h, l in NAV)
    return f'''<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)} | Bildungsmanufaktur</title>
<meta name="description" content="{E(desc)}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/titan-one.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css?v={VER}">
</head>
<body>
<div class="preview">Vorschau: Der Shop öffnet in Kürze – Bestellungen sind noch nicht möglich.</div>
<header class="site-head">
<div class="wrap">
<a class="logo" href="/"><img src="/assets/img/logo_quer.webp" alt="Bildungsmanufaktur – zur Startseite" width="900" height="339"></a>
<nav class="nav" aria-label="Hauptmenü">
{nav}
</nav>
<div class="head-tools">
<form action="/materialien.html" role="search"><label class="visually-hidden" for="q">Material suchen</label><input id="q" class="search" type="search" name="q" placeholder="Thema, Fach, Klasse …"></form>
<a class="cart-btn" href="/warenkorb.html" aria-label="Warenkorb"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h10.8L21 7H6.2"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg><span class="cart-count" data-n="0">0</span></a>
</div>
</div>
</header>
<main>
'''


FOOT = '''</main>
<footer class="site-foot">
<div class="wrap cols">
<div class="brand"><span><img src="/assets/img/logo_quer.webp" alt="Bildungsmanufaktur" width="900" height="339"></span><p style="margin:0">Unterrichtsmaterial mit Köpfchen – für Klasse 1 bis 13.</p></div>
<nav aria-label="Shop"><b>Shop</b><a href="/materialien.html">Alle Materialien</a><a href="/materialien.html?art=Sparpaket">Sparpakete</a><a href="/gratis.html">Gratis</a><a href="/#ueber">Über mich</a></nav>
<nav aria-label="Rechtliches"><b>Rechtliches</b><a href="/impressum.html">Impressum</a><a href="/datenschutz.html">Datenschutz</a><a href="/agb.html">AGB &amp; Nutzungsrechte</a><a href="/widerrufsbelehrung.html">Widerrufsbelehrung</a><a class="widerruf-link" href="/widerruf.html">Vertrag widerrufen</a></nav>
<nav aria-label="Hilfe"><b>Hilfe</b><a href="/agb.html#lizenzen">Einzel- &amp; Schullizenz</a><a href="/kontakt.html">Kontakt &amp; Schulbestellung</a><a href="https://www.instagram.com/diebildungsmanufaktur">Instagram</a></nav>
</div>
<div class="wrap bottom"><span>© 2026 Bildungsmanufaktur · Lukas Jaskolka</span><span>Alle Preise sind Endpreise. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</span></div>
</footer>
<script src="/assets/js/site.js?v={VER}" defer></script>
</body>
</html>
'''
FOOT = FOOT.replace('{VER}', VER)


def page(path, title, desc, body, active='', extra=''):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w').write(head(title, desc, active) + body + extra + FOOT)


def card(m):
    badge = 'Gratis' if m['gratis'] else m['badge']
    tags = m['st'].split() + (['gratis'] if m['gratis'] else []) + (['paket'] if m['art'] == 'Sparpaket' else []) + (['saison'] if m['saison'] else [])
    url = f"/material/{m['id']}.html"
    b = f'<span class="badge" style="background:{BADGE_BG[badge]}">{badge}</span>' if badge else ''
    if m['gratis']:
        price, act = '<span class="price free">Gratis</span>', f'<a class="btn small green" href="{url}">Ansehen</a>'
    else:
        price = f'<span class="price">{euro(m["preis"])}</span>'
        act = f'<button type="button" class="btn small" data-add="{m["id"]}">In den Warenkorb</button>'
    return f'''<article class="card" data-tags="{' '.join(tags)}" data-stufe="{m['st']}" data-fach="{E(m['fach'])}" data-art="{m['art']}" data-preis="{'gratis' if m['gratis'] else 'bezahlt'}" data-saison="{'1' if m['saison'] else '0'}">
<a class="pic" href="{url}" style="background:{m['tint']}"><img src="{m['thumb']}" alt="Deckblatt {E(m['titel'])}" loading="lazy" decoding="async">{b}</a>
<div class="body"><div><span class="chip">{m['stufe']}</span> <span class="chip t">{E(m['fach'])}</span></div>
<h3><a href="{url}">{E(m['titel'])}</a></h3><p>{E(m['info'])}</p>
<div class="foot">{price}{act}</div></div>
</article>'''


# ---------------- Startseite ----------------
home_ids = ['2438493', '2437611', '2425910', '2441649', '2437941', '2433934', '2442098', '2419366', '2437586', '2442712', '2441758', '2437963']
faecher_html = '\n'.join(
    f'<a class="fach" href="/materialien.html?fach={E(n)}"><span class="i" style="background:{bg}"><img src="/assets/img/{i}" alt="" width="64" height="64"></span><span>{E(n)}<small>{FANZ.get(n, 0)} {"Material" if FANZ.get(n, 0) == 1 else "Materialien"}</small></span></a>'
    for n, i, bg in FAECHER if n != 'Saison & Feste')
body = f'''<section class="hero dots"><div class="wrap">
<div class="hero-text">
<p class="kicker">Von einem Lehrer · für Lehrkräfte</p>
<h1>Unterrichts&shy;material <span>mit Köpfchen</span></h1>
<p class="lead">Durchdachte Arbeitshefte, Rätsel und Saisonmaterial für Klasse 1 bis 13 – differenziert, mit Lösungen und sofort als PDF einsetzbar.</p>
<div class="hero-btns"><a class="btn" href="/materialien.html">Materialien entdecken</a><a class="btn light" href="/gratis.html">Gratis-Material</a></div>
<ul class="stickers"><li style="background:var(--gelb)">Sofort als PDF</li><li style="background:var(--tuerkis)">★ ★★ ★★★ differenziert</li><li style="background:var(--pink)">Immer mit Lösungen</li></ul>
</div>
<div class="collage" aria-hidden="true">
<span class="blob"></span>
<img class="c1" src="/assets/img/versicherungen.jpg" alt="">
<img class="c2" src="/assets/img/weihnachtspaket.jpg" alt="">
<img class="c3" src="/assets/img/kreuzwort.jpg" alt="">
<img class="fig" src="/assets/img/winkt.webp" alt="">
</div>
</div></section>

<section class="sec" id="stufen"><div class="wrap">
<h2>Für welche Klasse suchst du?</h2><p class="lead" style="margin-bottom:28px">Wähle deine Stufe – alles ist nach Klassen sortiert.</p>
<div class="grid3">
<a class="stufe" href="/materialien.html?stufe=gs" style="background:var(--gruen)"><span class="big-num" style="color:var(--green)">1–4</span><b>Grundschule</b><span>Jahreskreis, Sachthemen, Rätsel, Ausmalbilder und Bewegung – groß, bunt und kindgerecht.</span></a>
<a class="stufe" href="/materialien.html?stufe=sek" style="background:var(--tuerkis)"><span class="big-num" style="color:var(--petrol)">5–10</span><b>Sekundarstufe I</b><span>Arbeitshefte mit Bausteinen, Klassenarbeit A/B, Lösungen und Präsentation – ESA und MSA.</span></a>
<a class="stufe" href="/materialien.html?stufe=ober" style="background:var(--lila)"><span class="soon">im Aufbau</span><span class="big-num" style="color:#8A63C7">11–13</span><b>Oberstufe</b><span>Vertiefende Materialien für die Sekundarstufe II und berufliche Schulen.</span></a>
</div></div></section>

<section class="sec" id="faecher"><div class="wrap">
<h2>Fächer</h2><p class="lead" style="margin-bottom:28px">Von Deutsch bis Verbraucherbildung – über 190 Materialien, und das Angebot wächst jede Woche.</p>
<div class="faecher">{faecher_html}</div>
</div></section>

<section class="sec" id="materialien"><div class="wrap">
<div class="filterbar"><div><h2>Beliebt &amp; neu</h2><p class="lead">Klick dich durch – jedes Material mit Vorschau.</p></div>
<div class="pills" role="group" aria-label="Filter" data-filterbar>
<button type="button" class="pill" data-f="alle" aria-pressed="true">Alle</button><button type="button" class="pill" data-f="gs" aria-pressed="false">Grundschule</button><button type="button" class="pill" data-f="sek" aria-pressed="false">Sek I</button><button type="button" class="pill" data-f="paket" aria-pressed="false">Sparpakete</button><button type="button" class="pill" data-f="gratis" aria-pressed="false">Gratis</button>
</div></div>
<div class="cards" data-grid>{''.join(card(BY[i]) for i in home_ids)}</div>
<p style="text-align:center;margin-top:34px"><a class="btn light" href="/materialien.html">Alle Materialien ansehen</a></p>
</div></section>

<section class="sec" id="pakete"><div class="wrap">
<div class="box banner" style="background:var(--gelb)">
<div class="txt"><span class="badge-tag" style="background:#D1497A;color:#fff">Sparpakete</span>
<h2>Ganze Reihen im Paket – günstiger als einzeln</h2>
<p class="lead">Alle Module einer Reihe zusammen, dazu die Gesamtklassenarbeit und das Abschlussprojekt. Einmal kaufen, ein Halbjahr planen.</p>
<a class="btn petrol" style="align-self:flex-start" href="/materialien.html?art=Sparpaket">Zu den Paketen</a></div>
<div class="covers"><img src="/assets/img/wissenspaket.jpg" alt="Deckblatt Wissenspaket Dezember" style="transform:rotate(-4deg)" loading="lazy"><img src="/assets/img/weihnachtspaket.jpg" alt="Deckblatt Großes Weihnachtspaket" style="transform:rotate(4deg)" loading="lazy"></div>
</div></div></section>

<section class="sec"><div class="wrap">
<h2 style="text-align:center;margin-bottom:28px">So arbeitet die Bildungsmanufaktur</h2>
<div class="steps">
<div class="step" style="background:var(--koralle)"><span class="big-num" style="color:#E0605A">1</span><h3>Aus dem Klassenzimmer</h3><p>Jedes Material entsteht aus echtem Unterricht – erprobt statt ausgedacht.</p></div>
<div class="step" style="background:var(--blau)"><span class="big-num" style="color:#3F6FC4">2</span><h3>Differenziert</h3><p>Sterne für Basis, Standard und Experte – damit alle im selben Heft mitkommen.</p></div>
<div class="step" style="background:var(--gruen)"><span class="big-num" style="color:var(--green)">3</span><h3>Komplett</h3><p>Lösungen, Handreichung, Klassenarbeit A/B und Präsentation – alles dabei.</p></div>
<div class="step" style="background:var(--lila)"><span class="big-num" style="color:#8A63C7">4</span><h3>Sofort im Postfach</h3><p>Nach dem Kauf kommt der Download-Link direkt per E-Mail – samt Rechnung.</p></div>
</div></div></section>

<section class="sec" id="newsletter"><div class="wrap">
<div class="box banner dots" style="background-color:var(--tuerkis)">
<img src="/assets/img/daumen.webp" alt="" width="170" style="flex:0 0 auto">
<div class="txt"><h2>Gratis-Material direkt ins Postfach</h2>
<p class="lead">Neue Freebies, Saisonmaterial und Rabatte zuerst – etwa einmal im Monat, jederzeit abbestellbar.</p>
<form class="nl-form" id="nl-form" action="https://5e5ebe92.sibforms.com/serve/MUIFAFtfFQxc4OZqbBZnBC3gmGyWorqXdPxY_X8O6HHZHcLjeSXkoqRBORgSOpP7aM2LyuXVy2A-3KU6su6BGLug9cIv_ZzFHDreN1JdWstRo23fD6kLH3NVccK9cyelz_qG58W2ZqQLnAVDT6n9bSQd59b72PeSXJXngPEGzqavxZwLZnfR2VB-mbXFZ3MmTm7Q3dokfqic3IrvjQ==" method="post"><label class="visually-hidden" for="nl">E-Mail-Adresse</label><input id="nl" name="EMAIL" type="email" placeholder="deine@e-mail.de" autocomplete="email" required><input type="text" name="email_address_check" value="" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px"><input type="hidden" name="locale" value="de"><button class="btn green" type="submit">Anmelden</button></form>
<p class="nl-hinweis" style="font-size:13px;margin-top:8px">Mit der Anmeldung willigst du ein, den Newsletter per E-Mail zu bekommen. Du erhältst zuerst eine Bestätigungs-Mail (Double-Opt-in). Versand über Brevo, Details in der <a href="/datenschutz.html">Datenschutzerklärung</a>.</p>
<p id="nl-ok" role="status" style="display:none;font-weight:700">Fast geschafft! Bitte schau in dein Postfach und bestätige die Anmeldung.</p>
<script>document.getElementById('nl-form').addEventListener('submit',function(e){{e.preventDefault();var f=e.target;fetch(f.action,{{method:'POST',mode:'no-cors',body:new FormData(f)}}).then(function(){{f.style.display='none';document.getElementById('nl-ok').style.display='block';}}).catch(function(){{f.submit();}});}});</script>
</div></div></div></section>

<section class="sec" id="ueber"><div class="wrap about">
<div class="portrait"><div><img src="/assets/img/liest.webp" alt="Glühbirnen-Maskottchen liest ein Buch"></div></div>
<div class="txt"><span class="badge-tag">Hinter der Bildungsmanufaktur</span><h2>Hallo, ich bin Lukas!</h2>
<p>Ich bin Lehrer in Schleswig-Holstein und weiß, wie viele Abende in gute Vorbereitung fließen. Mit der Bildungsmanufaktur baue ich das Material, das ich mir selbst gewünscht hätte: klar aufgebaut, schön gestaltet und so vollständig, dass du es morgen früh kopieren kannst.</p>
<p>Vorher war ich Soldat bei der Marine und habe ein eigenes Fitnessstudio aufgebaut – deshalb steckt in vielen Materialien auch Bewegung und echter Lebensweltbezug.</p>
<div style="display:flex;flex-wrap:wrap;gap:12px"><a class="btn small light" href="https://www.instagram.com/diebildungsmanufaktur">@diebildungsmanufaktur</a></div>
</div></div></section>
'''
page('index.html', 'Unterrichtsmaterial mit Köpfchen', 'Durchdachte, differenzierte Unterrichtsmaterialien für Klasse 1 bis 13 – sofort als PDF.', body, 'Start')

# ---------------- Materialien ----------------
def opts(g, items):
    return ''.join(f'<button type="button" class="pill" data-g="{g}" data-v="{E(v)}" aria-pressed="false">{E(l)}</button>' for v, l in items)

fach_opts = [(f, f'{f} ({FANZ[f]})') for f, _, _ in FAECHER if f in FANZ]
body = f'''<section class="page-head dots"><div class="wrap"><div class="txt">
<nav class="crumbs" aria-label="Brotkrumen"><a href="/">Start</a> › <span>Alle Materialien</span></nav>
<h1>Alle Materialien</h1><p class="lead">Filtere nach Klasse, Fach und Materialart – jedes Material mit Vorschau.</p></div>
<img src="/assets/img/zeigt.webp" alt="" width="120"></div></section>
<div class="wrap shop">
<aside class="filters" aria-label="Filter" data-filters><details class="ftoggle" open><summary>Filter</summary><div class="fbody">
<fieldset><legend>Klassenstufe</legend><div class="opts">{opts('stufe', [('alle', 'Alle'), ('gs', 'Grundschule 1–4'), ('sek', 'Sek I 5–10'), ('ober', 'Oberstufe 11–13')])}</div></fieldset>
<fieldset><legend>Fach</legend><div class="opts">{opts('fach', fach_opts)}</div></fieldset>
<fieldset><legend>Preis</legend><div class="opts">{opts('preis', [('alle', 'Alle'), ('gratis', 'Gratis'), ('bezahlt', 'Kostenpflichtig')])}</div></fieldset>
<fieldset><legend>Materialart</legend><div class="opts">{opts('art', [(a, a) for a in ['Arbeitsheft', 'Arbeitsblätter', 'Sparpaket', 'Rätsel', 'Spiele', 'Ausmalbilder', 'Basteln & Deko', 'Bewegung & Spiele']])}</div></fieldset>
<fieldset><legend>Thema</legend><div class="opts">{opts('saison', [('1', 'Jahreskreis & Feste')])}</div></fieldset>
<button type="button" class="linkbtn" data-reset>Alle Filter zurücksetzen</button>
</div></details></aside>
<div class="results">
<p style="margin:0;font-family:Fredoka,sans-serif;font-weight:600;font-size:19px" data-count></p>
<div class="empty" data-empty hidden><img src="/assets/img/liest.webp" alt=""><div><h2 style="font-size:26px">Hier wird gerade gebaut</h2><p style="margin:0">Für diese Auswahl gibt es noch kein Material – das Angebot wächst jede Woche.</p></div></div>
<div class="cards" data-grid>{''.join(card(m) for m in P)}</div>
</div></div>
'''
page('materialien.html', 'Alle Materialien', 'Alle Unterrichtsmaterialien der Bildungsmanufaktur nach Klasse, Fach und Materialart.', body, 'Materialien')

# ---------------- Produktseiten ----------------
VS_EXTRA = {
    'sub': 'Welche Versicherungen gibt\'s – und brauche ich sie?',
    'text': 'Das Komplettpaket für den Einstieg in die Versicherungsreihe: Die Klasse lernt die wichtigsten Versicherungsarten kennen, versteht das Solidarprinzip, unterscheidet Personen- und Sachversicherungen sowie Pflicht- und freiwillige Versicherungen und wendet alles auf lebensnahe Fälle an. Differenziert in drei Niveaus, mit Klassenarbeit und Präsentation.',
    'ticks': ['8–10 Unterrichtsstunden, Bausteine auch einzeln einsetzbar', '42 Seiten: 5 Bausteine, Lösungen und Handreichung', 'Klassenarbeit Version A (★ ESA) und B (★★ MSA) mit Erwartungshorizont', 'Präsentation zur Stundenführung'],
    'bilder': [('versicherungen.jpg', 'Deckblatt'), ('vs_s3.jpg', 'Beispielseite: So arbeitest du mit diesem Heft'), ('vs_s5.jpg', 'Beispielseite: Versicherungen suchen'), ('vs_s7.jpg', 'Beispielseite: Fallbeispiele'), ('vs_s9.jpg', 'Beispielseite: Was ist eine Versicherung?'), ('vs_s12.jpg', 'Beispielseite: Die Idee der gemeinsamen Absicherung')],
    'bausteine': [('1', '#E0605A', 'var(--koralle)', 'Versicherungen kennenlernen', 'Mindmap zum Vorwissen, Suchsel, Zuordnung und 14 Fallbeispiele: Welche Versicherung passt?'),
                  ('2', '#D9960F', 'var(--gelb)', 'Was ist eine Versicherung?', 'Informationstext zum Grundprinzip, Begriffe erklären und eine eigene Definition formulieren – mit Tippkarte.'),
                  ('3', '#3F6FC4', 'var(--blau)', 'Das Versicherungsprinzip', 'Die Idee der gemeinsamen Absicherung, Klassenspiel „Gemeinsamer Topf“ und zwei Fallanalysen.'),
                  ('4', '#3E9E6A', 'var(--gruen)', 'Personen oder Sachen?', 'Versicherungen unterscheiden und Karten sortieren – mit Kopiervorlage.'),
                  ('5', '#8A63C7', 'var(--lila)', 'Pflicht oder freiwillig?', 'Informationstext, Zuordnen, Stellungnahme und ein Kreuzworträtsel.')],
    'facts': [('Klasse', '9/10 (Haupt- und Realschule, ESA/MSA)'), ('Fächer', 'Wirtschaft, Wirtschaft/Politik, Sozialkunde, Arbeitslehre, Verbraucherbildung'), ('Umfang', 'Arbeitsheft mit 42 Seiten, Präsentation, Quellen (alles PDF)'), ('Dauer', '8–10 Unterrichtsstunden'), ('Differenzierung', '★ Basis · ★★ Standard · ★★★ Experte')],
}
FAQ = [('Wie bekomme ich das Material?', 'Direkt nach der Bezahlung erscheint der Download-Link, und du bekommst ihn zusätzlich per E-Mail – zusammen mit deiner Rechnung.'),
       ('Was ist der Unterschied zwischen Einzel- und Schullizenz?', 'Mit der Einzellizenz nutzt du das Material für deine eigenen Klassen. Die Schullizenz gilt für alle Lehrkräfte einer Schule – ideal für Fachschaften.'),
       ('Kann meine Schule auf Rechnung kaufen?', 'Ja. Schreib mir kurz mit Schulname und Rechnungsadresse, dann bekommst du eine Rechnung zum Überweisen.')]

for m in P:
    x = VS_EXTRA if m['eduki'] == '2425910' else None
    bilder = [('/assets/img/' + f, l) for f, l in x['bilder']] if x else [(m['src'], 'Deckblatt')]
    thumbs = ''
    if len(bilder) > 1:
        thumbs = '<div class="thumbs" role="group" aria-label="Vorschauseiten">' + ''.join(
            f'<button type="button" data-thumb="{f}" aria-label="{E(l)}" aria-pressed="{"true" if i == 0 else "false"}"><img src="{f}" alt="" loading="lazy"></button>'
            for i, (f, l) in enumerate(bilder)) + '</div>'
    if m['gratis']:
        kauf = f'<div class="info-box"><b>Kostenlos</b>Einfach herunterladen und loslegen – ohne Anmeldung.</div><p><a class="btn green" href="https://bm-downloads.lukas-jaskolka.workers.dev/gratis/{m["eduki"]}" rel="nofollow">Gratis herunterladen</a></p>'
    else:
        kauf = f'''<fieldset class="lic"><legend>Lizenz wählen</legend>
<label><input type="radio" name="lizenz" value="Einzellizenz" checked><span><span class="n">Einzellizenz</span><span class="d">Für dich und deine eigenen Klassen</span></span><span class="p">{euro(m["preis"])}</span></label>
<label><input type="radio" name="lizenz" value="Schullizenz"><span><span class="n">Schullizenz</span><span class="d">Für alle Lehrkräfte deiner Schule</span></span><span class="p">{euro(m["schul"])}</span></label>
</fieldset>
<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center"><button type="button" class="btn" data-add="{m['id']}">In den Warenkorb</button><span class="small muted">Sofort-Download als PDF nach dem Kauf</span></div>
<p class="small muted" style="margin:0">Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>'''
    ticks = ''.join(f'<li>{E(t)}</li>' for t in x['ticks']) if x else ''
    bausteine = ''
    if x:
        bs = ''.join(f'<div class="baustein" style="background:{hell}"><span class="big-num" style="color:{c}">{n}</span><div><h3>{E(t)}</h3><p>{E(d)}</p></div></div>' for n, c, hell, t, d in x['bausteine'])
        facts = ''.join(f'<dt>{E(a)}</dt><dd>{E(b)}</dd>' for a, b in x['facts'])
        bausteine = f'''<section class="white-band"><div class="wrap">
<div class="bausteine"><h2>Das steckt drin</h2>{bs}<p class="small" style="margin:0">Dazu: Lernkontrolle, Lernweg, Wortbank, Leistungsnachweise zur Wahl, Klassenarbeit A/B sowie Lösungen, Handreichung und Korrekturbögen.</p></div>
<div class="facts"><h2>Auf einen Blick</h2><dl>{facts}</dl></div></div></section>'''
    passend = [p for p in P if p['id'] != m['id'] and p['fach'] == m['fach'] and set(p['st'].split()) & set(m['st'].split())][:4]
    faq = ''.join(f'<details class="faq"><summary>{E(q)}</summary><p>{E(a)}</p></details>' for q, a in FAQ)
    body = f'''<div class="wrap" style="padding-top:24px"><nav class="crumbs" aria-label="Brotkrumen"><a href="/">Start</a> › <a href="/materialien.html">Materialien</a> › <a href="/materialien.html?fach={E(m['fach'])}">{E(m['fach'])}</a> › <span>{E(m['titel'])}</span></nav></div>
<div class="wrap product">
<div class="gallery"><div class="box main" style="background:{m['tint']}"><img data-main src="{bilder[0][0]}" alt="{E(bilder[0][1])} {E(m['titel'])}"></div>{thumbs}</div>
<div class="info">
<div><span class="chip">{m['stufe']}</span> <span class="chip t">{E(m['fach'])}</span> <span class="chip l">{m['art']}</span> <span class="chip">{m['umfang']}</span></div>
<h1>{E(m['titel'])}</h1>
{f'<p class="sub">{E(x["sub"] if x else m["sub"])}</p>' if (x or m['sub']) else ''}
<p style="margin:0;font-size:18px;line-height:1.6">{E(x['text'] if x else (m['lead'] or m['info']))}</p>
{kauf}
{f'<ul class="ticks">{ticks}</ul>' if ticks else ''}
</div></div>
{bausteine}
{f'<section class="sec"><div class="wrap desc"><h2>Beschreibung</h2>{m["desc"]}</div></section>' if (m['desc'] and not x) else ''}
<section class="sec"><div class="wrap"><h2>Häufige Fragen</h2>{faq}</div></section>
{f'<section class="sec"><div class="wrap"><h2>Passt dazu</h2><div class="cards">{"".join(card(p) for p in passend)}</div></div></section>' if passend else ''}
'''
    page(f"material/{m['id']}.html", m['titel'], m['info'], body, 'Materialien')

# ---------------- Warenkorb ----------------
katalog = {m['id']: {'titel': m['titel'], 'stufe': m['stufe'], 'img': m['thumb'], 'preis': m['preis'], 'schul': m['schul']} for m in P if not m['gratis']}
body = '''<div class="wrap" style="padding-top:28px"><nav class="crumbs"><a href="/">Start</a> › <span>Warenkorb</span></nav><h1 style="margin-top:12px">Dein Warenkorb</h1></div>
<div class="wrap cart">
<div class="cart-items">
<div class="empty" data-cart-empty hidden><img src="/assets/img/zeigt.webp" alt=""><div style="display:flex;flex-direction:column;gap:12px"><b style="font-family:Fredoka,sans-serif;font-size:22px">Dein Warenkorb ist leer.</b><a class="btn" style="align-self:flex-start" href="/materialien.html">Materialien entdecken</a></div></div>
<div data-cart style="display:flex;flex-direction:column;gap:16px"></div>
<div class="info-box"><b>Für Schulen: Kauf auf Rechnung</b>Deine Schule möchte per Überweisung zahlen? Schick mir Schulname, Rechnungsadresse und die gewünschten Materialien – du bekommst eine Rechnung. <a href="/kontakt.html">Anfrage senden</a></div>
</div>
<aside class="box summary" aria-label="Zusammenfassung">
<h2 style="font-size:26px">Zusammenfassung</h2>
<div style="display:flex;justify-content:space-between"><span data-cart-n>0 Materialien</span><span data-cart-sum>0,00 €</span></div>
<div style="display:flex;justify-content:space-between;font-family:Fredoka,sans-serif;font-weight:600;font-size:22px"><span>Gesamt</span><span data-cart-sum>0,00 €</span></div>
<p class="small muted" style="margin:0">Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>
<label for="mail">E-Mail für Download und Rechnung</label><input id="mail" type="email" autocomplete="email" placeholder="deine@e-mail.de" data-mail>
<label class="consent"><input type="checkbox" data-consent><span>Ich stimme ausdrücklich zu, dass der Download vor Ablauf der Widerrufsfrist beginnt. Mir ist bekannt, dass ich dadurch mein Widerrufsrecht verliere.</span></label>
<p class="small" style="margin:0">Es gelten die <a href="/agb.html">AGB</a> und die <a href="/datenschutz.html">Datenschutzerklärung</a>.</p>
<button type="button" class="btn" data-checkout>Zahlungspflichtig bestellen</button>
<p class="small muted" style="margin:0;text-align:center" data-checkout-msg>Sichere Bezahlung über Stripe: Karte, Apple Pay, Google Pay, PayPal.</p>
</aside></div>
'''
page('warenkorb.html', 'Warenkorb', 'Dein Warenkorb bei der Bildungsmanufaktur.', body, '',
     '<script>window.BM_KATALOG=' + json.dumps(katalog, ensure_ascii=False) + '</script>\n')

# ---------------- Gratis ----------------
body = f'''<section class="page-head dots" style="background-color:var(--gruen)"><div class="wrap"><div class="txt">
<nav class="crumbs"><a href="/">Start</a> › <span>Gratis</span></nav><h1>Gratis-Material zum Ausprobieren</h1>
<p class="lead">Suchsel, Ausmalbilder und kleine Spiele – kostenlos. So lernst du die Bildungsmanufaktur kennen.</p></div>
<img src="/assets/img/winkt.webp" alt="" width="130"></div></section>
<section class="sec"><div class="wrap"><div class="cards">{''.join(card(m) for m in P if m['gratis'])}</div></div></section>
'''
page('gratis.html', 'Gratis-Material', 'Kostenlose Unterrichtsmaterialien: Suchsel, Ausmalbilder und Spiele.', body, 'Gratis')

# ---------------- Rechtliches ----------------
LEGAL_NOTE = '<div class="note"><b>Entwurf:</b> Diese Texte werden vor dem Shop-Start final geprüft. Platzhalter stehen in [eckigen Klammern].</div>'
def legal(path, title, inner):
    links = ''.join(f'<a class="pill" href="/{p}"{" aria-current=page" if p == path else ""}>{l}</a>' for p, l in [('impressum.html', 'Impressum'), ('datenschutz.html', 'Datenschutz'), ('agb.html', 'AGB & Nutzungsrechte'), ('widerrufsbelehrung.html', 'Widerrufsbelehrung'), ('kontakt.html', 'Kontakt')])
    body = f'<div class="wrap legal"><nav class="crumbs"><a href="/">Start</a> › <span>{title}</span></nav><nav class="legal-nav" aria-label="Rechtliches">{links}</nav>{LEGAL_NOTE}<article><h1 style="font-size:36px">{title}</h1>{inner}</article></div>'
    page(path, title, title + ' – Bildungsmanufaktur', body)

legal('impressum.html', 'Impressum', '''<h3>Angaben gemäß § 5 DDG</h3><p>Lukas Jaskolka<br>Bildungsmanufaktur<br>Paul-Klee-Straße 72<br>24539 Neumünster</p>
<h3>Kontakt</h3><p>E-Mail: <a href="mailto:kontakt@bildungsmanufaktur.shop">kontakt@bildungsmanufaktur.shop</a></p>
<h3>Umsatzsteuer</h3><p>Kleinunternehmer gemäß § 19 UStG – es wird keine Umsatzsteuer ausgewiesen.</p>
<h3>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3><p>Lukas Jaskolka, Anschrift wie oben</p>
<h3>Verbraucherstreitbeilegung</h3><p>Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>''')

legal('datenschutz.html', 'Datenschutzerklärung', '''<h3>1. Verantwortlicher</h3><p>Lukas Jaskolka, Bildungsmanufaktur, Paul-Klee-Straße 72, 24539 Neumünster, kontakt@bildungsmanufaktur.shop</p>
<h3>2. Hosting</h3><p>Diese Website wird bei Netlify, Inc. (USA) gehostet. Beim Aufruf werden technisch notwendige Daten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Seite) in Server-Logfiles verarbeitet, um die Seite sicher bereitzustellen (Art. 6 Abs. 1 lit. f DSGVO). Netlify ist unter dem EU-US Data Privacy Framework zertifiziert; ergänzend gelten die EU-Standardvertragsklauseln.</p>
<h3>3. Warenkorb</h3><p>Der Warenkorb wird nur lokal in deinem Browser gespeichert (Local Storage) und nicht an mich übertragen.</p>
<h3>4. Bestellung, Zahlung und Download</h3><p>Für Bestellungen verarbeite ich Name, E-Mail-Adresse, Bestelldaten und – bei Schulen – die Rechnungsadresse (Art. 6 Abs. 1 lit. b DSGVO); Rechnungsdaten bewahre ich nach den steuerrechtlichen Pflichten auf (Art. 6 Abs. 1 lit. c DSGVO).</p>
<p><b>Zahlung:</b> Die Bezahlung wickelt Stripe Payments Europe Ltd. (Irland) ab. Dafür werden deine Zahlungs- und Bestelldaten an Stripe übermittelt; Kartendaten gibst du direkt bei Stripe ein, sie erreichen mich nicht. Stripe kann Daten auch in die USA übertragen (EU-US Data Privacy Framework, Standardvertragsklauseln). Wählst du PayPal, wird PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) eingebunden.</p>
<p><b>Download:</b> Die Dateien liegen in einem Speicher von Cloudflare, Inc. (USA). Beim Herunterladen werden technisch nötige Daten (IP-Adresse, Zeitpunkt, Download-Link) verarbeitet; der Link prüft bei Stripe, ob die Bestellung bezahlt ist (Art. 6 Abs. 1 lit. b DSGVO). Cloudflare ist unter dem EU-US Data Privacy Framework zertifiziert.</p>
<p><b>E-Mails zur Bestellung:</b> Den Download-Link und Eingangsbestätigungen (z. B. beim Widerruf) verschicke ich über Brevo (Sendinblue GmbH, Berlin) an die von dir angegebene E-Mail-Adresse (Art. 6 Abs. 1 lit. b und c DSGVO).</p>
<h3>4a. Widerruf über die Website</h3><p>Nutzt du die Funktion „Vertrag widerrufen“, verarbeite ich Name, Angaben zum Vertrag und E-Mail-Adresse, um den Widerruf zu bearbeiten und dir den Eingang zu bestätigen (Art. 6 Abs. 1 lit. c DSGVO i. V. m. § 356a BGB).</p>
<h3>5. Newsletter</h3><p>Für den Newsletter brauche ich deine E-Mail-Adresse und deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die per Bestätigungs-E-Mail eingeholt wird (Double-Opt-in). Zum Nachweis der Einwilligung werden Zeitpunkt der Anmeldung und Bestätigung gespeichert. Das Anmeldeformular und der Versand laufen über Brevo (Sendinblue GmbH, Köpenicker Str. 126, 10179 Berlin), mit der ich einen Auftragsverarbeitungsvertrag habe; die Daten werden in der EU verarbeitet. Brevo kann auswerten, ob ein Newsletter geöffnet und welche Links geklickt wurden. Abmelden geht jederzeit über den Link in jedem Newsletter oder per E-Mail an kontakt@bildungsmanufaktur.shop.</p>
<h3>6. Schriften und Cookies</h3><p>Alle Schriften werden lokal von diesem Server geladen. Es werden keine Tracking- oder Werbe-Cookies eingesetzt.</p>
<h3>7. Speicherdauer</h3><p>Bestell- und Rechnungsdaten werden nach den gesetzlichen Aufbewahrungsfristen gelöscht, Newsletter-Daten nach deiner Abmeldung.</p>
<h3>8. Deine Rechte</h3><p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit, Widerspruch und Widerruf einer Einwilligung. Beschweren kannst du dich bei einer Datenschutz-Aufsichtsbehörde, z. B. dem Unabhängigen Landeszentrum für Datenschutz Schleswig-Holstein (ULD).</p>''')

legal('agb.html', 'AGB & Nutzungsrechte', '''<h3>§ 1 Geltungsbereich</h3><p>Diese Bedingungen gelten für alle Bestellungen digitaler Unterrichtsmaterialien über diese Website zwischen Lukas Jaskolka, Bildungsmanufaktur, und Verbraucher:innen, Lehrkräften und Schulen.</p>
<h3>§ 2 Vertragsschluss</h3><p>Die Darstellung der Materialien ist noch kein bindendes Angebot. Mit dem Klick auf „Zahlungspflichtig bestellen“ gibst du ein verbindliches Angebot ab. Der Vertrag kommt zustande, wenn ich die Bestellung per E-Mail bestätige oder den Download bereitstelle.</p>
<h3>§ 3 Preise und Zahlung</h3><p>Alle Preise sind Endpreise. Als Kleinunternehmer nach § 19 UStG weise ich keine Umsatzsteuer aus. Bezahlt wird über die im Bestellprozess angebotenen Zahlungsarten; Schulen können auf Rechnung kaufen.</p>
<h3>§ 4 Bereitstellung</h3><p>Nach Zahlungseingang erhältst du einen Download-Link auf der Bestätigungsseite und per E-Mail. Der Link ist 30 Tage gültig.</p>
<h3 id="lizenzen">§ 5 Nutzungsrechte</h3><ul><li><b>Einzellizenz:</b> Eine Lehrkraft darf das Material für den eigenen Unterricht nutzen und für die eigenen Lerngruppen kopieren – auch digital in geschlossenen Lernplattformen der eigenen Klassen.</li><li><b>Schullizenz:</b> Alle Lehrkräfte einer Schule (ein Standort) dürfen das Material im selben Umfang nutzen.</li><li><b>Nicht erlaubt:</b> Weitergabe außerhalb der Lizenz, öffentliches Hochladen (z. B. auf Websites, Tauschbörsen oder Plattformen), Weiterverkauf und die Veröffentlichung veränderter Fassungen.</li></ul><p>Alle Inhalte sind urheberrechtlich geschützt.</p>
<h3>§ 6 Widerrufsrecht</h3><p>Verbraucher:innen haben ein Widerrufsrecht nach Maßgabe der <a href="/widerrufsbelehrung.html">Widerrufsbelehrung</a>. Den Widerruf kannst du auch über die Seite <a href="/widerruf.html">„Vertrag widerrufen“</a> erklären.</p>
<h3>§ 7 Gewährleistung und Haftung</h3><p>Es gelten die gesetzlichen Gewährleistungsrechte. Ich hafte unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit; im Übrigen nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren Schaden.</p>
<h3>§ 8 Schlussbestimmungen</h3><p>Es gilt deutsches Recht. Gegenüber Verbraucher:innen gilt diese Rechtswahl nur, soweit dadurch nicht zwingende Schutzvorschriften ihres Aufenthaltsstaates entzogen werden.</p>''')

legal('widerrufsbelehrung.html', 'Widerrufsbelehrung', '''<h3>Widerrufsrecht</h3>
<p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
<p>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</p>
<p>Um Ihr Widerrufsrecht auszuüben, müssen Sie mir (Lukas Jaskolka, Bildungsmanufaktur, Paul-Klee-Straße 72, 24539 Neumünster, E-Mail: kontakt@bildungsmanufaktur.shop) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
<p>Sie können Ihr Widerrufsrecht auch online unter <a href="/widerruf.html">bildungsmanufaktur.shop/widerruf.html</a> über die Schaltfläche „Vertrag widerrufen“ ausüben. Wenn Sie diese Widerrufsfunktion nutzen, übermittle ich Ihnen unverzüglich (z. B. per E-Mail) eine Eingangsbestätigung mit Informationen zum Inhalt Ihrer Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.</p>
<p>Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.</p>
<h3>Folgen des Widerrufs</h3>
<p>Wenn Sie diesen Vertrag widerrufen, habe ich Ihnen alle Zahlungen, die ich von Ihnen erhalten habe, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei mir eingegangen ist. Für diese Rückzahlung verwende ich dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.</p>
<h3>Vorzeitiges Erlöschen des Widerrufsrechts</h3>
<p>Bei einem Vertrag über die Bereitstellung digitaler Inhalte, die nicht auf einem körperlichen Datenträger geliefert werden (Download), erlischt das Widerrufsrecht, wenn ich mit der Vertragserfüllung begonnen habe, nachdem Sie ausdrücklich zugestimmt haben, dass ich mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist beginne, Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Ausführung des Vertrags Ihr Widerrufsrecht verlieren, und ich Ihnen eine Bestätigung des Vertrags auf einem dauerhaften Datenträger zur Verfügung gestellt habe.</p>
<h3>Muster-Widerrufsformular</h3>
<p>(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
<p>– An Lukas Jaskolka, Bildungsmanufaktur, Paul-Klee-Straße 72, 24539 Neumünster, E-Mail: kontakt@bildungsmanufaktur.shop:<br>
– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)/die Bereitstellung der folgenden digitalen Inhalte (*)<br>
– Bestellt am (*)/erhalten am (*)<br>
– Name des/der Verbraucher(s)<br>
– Anschrift des/der Verbraucher(s)<br>
– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)<br>
– Datum</p>
<p>(*) Unzutreffendes streichen.</p>''')

legal('kontakt.html', 'Kontakt & Schulbestellung', '''<p>Fragen zu einem Material, einer Lizenz oder einer Rechnung? Schreib mir an <a href="mailto:kontakt@bildungsmanufaktur.shop">kontakt@bildungsmanufaktur.shop</a>.</p>
<h3>Kauf auf Rechnung für Schulen</h3><p>Bitte schick mir den Namen der Schule, die Rechnungsadresse, die gewünschten Materialien und ob du eine Einzel- oder Schullizenz brauchst. Du bekommst eine Rechnung zum Überweisen; nach Zahlungseingang folgt der Download-Link.</p>''')

body = '''<div class="wrap legal"><nav class="crumbs"><a href="/">Start</a> › <span>Vertrag widerrufen</span></nav>
<h1 style="margin:14px 0">Vertrag widerrufen</h1>
<p>Hier kannst du einen Kauf widerrufen. Bitte beachte: Bei digitalen Inhalten erlischt das Widerrufsrecht, sobald der Download mit deiner ausdrücklichen Zustimmung begonnen hat – Details stehen in der <a href="/widerrufsbelehrung.html">Widerrufsbelehrung</a>.</p>
<form class="box form" data-widerruf>
<label for="wn">Dein Name</label><input id="wn" name="name" type="text" autocomplete="name" required>
<label for="wb">Welcher Vertrag? (Bestelldatum, Material oder Bestellnummer)</label><input id="wb" name="vertrag" type="text" required>
<label for="wm">E-Mail-Adresse für die Eingangsbestätigung</label><input id="wm" name="email" type="email" autocomplete="email" required>
<button type="submit" class="btn" style="align-self:flex-start">Widerruf bestätigen</button>
<p class="small muted" style="margin:0" data-widerruf-msg>Du bekommst sofort eine Eingangsbestätigung per E-Mail mit Datum und Uhrzeit.</p>
</form></div>
<script>(function(){var f=document.querySelector('[data-widerruf]');var m=document.querySelector('[data-widerruf-msg]');
f.addEventListener('submit',function(e){e.preventDefault();var b=f.querySelector('button');b.disabled=true;b.textContent='Wird gesendet …';
fetch('/api/widerruf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.name.value,vertrag:f.vertrag.value,email:f.email.value})})
.then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.fehler||'Fehler');return d;});})
.then(function(d){f.innerHTML='<h3 style="margin:0">Dein Widerruf ist eingegangen.</h3><p>Eingang: '+d.zeit+'. Die Bestätigung ist per E-Mail unterwegs.</p>';})
.catch(function(err){b.disabled=false;b.textContent='Widerruf bestätigen';m.style.color='#C0392B';m.textContent=err.message+' Alternativ per E-Mail an kontakt@bildungsmanufaktur.shop.';});});})();</script>'''
page('widerruf.html', 'Vertrag widerrufen', 'Vertrag widerrufen – Bildungsmanufaktur', body)

body = '''<div class="wrap legal" style="text-align:center"><img src="/assets/img/daumen.webp" alt="" width="150">
<h1 style="margin:14px 0">Danke für deine Bestellung!</h1>
<p class="lead" data-danke>Deine Zahlung ist eingegangen. Hier geht es direkt zu deinen Dateien:</p>
<p><a class="btn green" data-dl href="#" style="font-size:20px">Zu deinen Downloads</a></p>
<p class="small muted">Der Link gilt 30 Tage. Speichere ihn dir am besten als Lesezeichen. Die Rechnung kommt per E-Mail.</p>
<p class="small muted">Keine Mail da? Schau bitte im Spam-Ordner nach oder schreib an <a href="mailto:kontakt@bildungsmanufaktur.shop">kontakt@bildungsmanufaktur.shop</a>.</p>
<p style="margin-top:20px"><a class="btn" href="/materialien.html">Weiter stöbern</a></p></div>
<script>try{localStorage.removeItem('bm-warenkorb')}catch(e){}
var sid=new URLSearchParams(location.search).get('session_id');var a=document.querySelector('[data-dl]');
if(sid&&/^cs_(test|live)_[A-Za-z0-9]+$/.test(sid)){a.href='https://bm-downloads.lukas-jaskolka.workers.dev/d/'+sid;}else{a.parentNode.style.display='none';}</script>'''
page('danke.html', 'Danke für deine Bestellung', 'Bestellung abgeschlossen', body)
fk = {m['id']: {'titel': m['titel'], 'preis': m['preis'], 'schul': m['schul'], 'eduki': m['eduki']} for m in P if not m['gratis']}
_fd = os.path.join(os.path.dirname(OUT), 'netlify', 'functions')
os.makedirs(_fd, exist_ok=True)
open(os.path.join(_fd, 'katalog.json'), 'w').write(json.dumps(fk, ensure_ascii=False))

page('404.html', 'Seite nicht gefunden', 'Seite nicht gefunden',
     '<div class="wrap legal" style="text-align:center"><img src="/assets/img/zeigt.webp" alt="" width="140"><h1>Hoppla – diese Seite gibt es nicht.</h1><p style="margin-top:16px"><a class="btn" href="/">Zur Startseite</a></p></div>')

open(os.path.join(OUT, 'robots.txt'), 'w').write('User-agent: *\nDisallow: /\n')
open(os.path.join(os.path.dirname(OUT), 'netlify.toml'), 'w').write('''[build]
  publish = "site"

[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/img/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"
''')
print('fertig:', sum(len(f) for _, _, f in os.walk(OUT)), 'Dateien')
