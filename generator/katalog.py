"""Liest eduki_katalog.tsv und ordnet jedem Material Stufe, Fach, Art und Preis zu."""
import re, unicodedata, os

HIER = os.path.dirname(os.path.abspath(__file__))
SCHUL_FAKTOR = 3

LOKAL = {  # eigene, schärfere Deckblätter, wo vorhanden
    '2425910': 'versicherungen.jpg', '2419366': 'werbung.jpg', '2437881': 'ausbildung.jpg', '2432399': 'mobil.jpg',
    '2437611': 'weihnachtspaket.jpg', '2437605': 'wissenspaket.jpg', '2437941': 'advent.jpg', '2437586': 'escape.jpg',
    '2438000': 'wintersuchsel.jpg', '1965098': 'waldtiere.jpg', '2441767': 'tierewelt.jpg', '2441758': 'tierebeiuns.jpg',
    '2437963': 'silvester.jpg',
}

# Stufe, wo der Titel sie nicht verrät (abgeleitet aus Reihe/Paket)
STUFE_FIX = {
    '2437579': '7/8', '2437586': '7/8', '2437551': '3/4', '2437544': '3/4', '2437572': '5/6', '2437560': '5/6',
    '2437441': '5/6', '2213674': '7/8', '2442108': '7', '2437448': '1–6', '2437427': '1–6', '2437445': '1–6',
    '2438004': '2–6', '2440117': '1–4', '2437985': '5–10', '2437992': '5–10', '2437988': '5–10', '2437522': '5–10',
    '2437527': '5–10', '2440135': '5–10', '2440140': '5–10', '2437941': '1–6', '2440153': '1–6', '2018260': '1–6',
    '2037029': '1–6', '2437430': '1–6', '2437429': '1–6', '2436306': '1–6', '2436270': '1–6', '2436291': '1–6',
}
SEK_REIHEN = ('Erste eigene Wohnung', 'Versicherungen', 'Endlich 18', 'Werbung', 'Führerschein', 'Ausbildung')

FACH_REGELN = [
    ('Verbraucherbildung', r'Wohnung|Versicherung|Endlich 18|Werbung durchschaut|Führerschein|Ausbildung|Konsum'),
    ('Sport', r'Sport|Badminton|Fitness|Fußball|Bewegt|Bewegungs'),
    ('Englisch', r'vocabulary'),
    ('Mathematik', r'Mathe|Einmaleins|umrechnen'),
    ('Ernährung & Gesundheit', r'Ernährung|schläfst'),
    ('Ethik & Religion', r'Chanukka|Lucia|Sternsinger|Myra|Weihnachten verstehen|Christkind'),
    ('Weltkunde & Geschichte', r'Geschichte|Kalenderreform|Weihnachtsfrieden|Saturnalien|Lichterfeste|weltweit|Migration|25\. Dezember|im Wandel|Escape: Knackt|Dezember Kl\. 7|Wissenspaket Dezember 7'),
    ('Sachunterricht', r'Insekt|Biene|Hummel|Ameise|Schmetterling|Marienkäfer|Libelle|Hornisse|Waldtiere (16|XXL)|Legekreis|Lese-Zuordnung|Herbst-(Tier-)?Quiz|Waldtiere zuordnen|Sachunterricht|Barbarazweige|Wintersonnenwende|Advent für Entdecker|Wissenspaket Dezember|Nikolaus von|Glücksbringer|Silvester & Neujahr: Glück|Silvester-Geschichte|Dezember-Quiz'),
    ('Deutsch', r'Elfchen|Wunschzettel|erzählen|Lückentext|Wortschlange|Silbenrätsel|Buchstabensalat|Lexikon|Geheimschrift'),
    ('Klassenleben', r'Schulstart|Geburtstag|Schuljahr|Sommerferien -|Ferienpass|Buddy Book|Das bin ich|Urkunden|Wichteln|Jahresrückblick|Osterferien'),
    ('Rätsel & Spiele', r'Suchsel|Kreuzwort|Rätsel|Labyrinth|Bingo|Sudoku|Quiz|Merkspiel|Schattenbilder|Logical|Escape|Erklärspiel|Wer bin ich|Stadt, Land|Wimmel|Quartett'),
    ('Kunst & Basteln', r'Ausmal|Mandala|[Bb]astel|Fensterbild|[Kk]arten|[Aa]nhänger|Zeichnen|Muttertag|Vatertag|Weihnachtsbaum: Alle'),
]
FACH_TINT = {'Verbraucherbildung': '#FFF0CC', 'Sport': '#DAF0F2', 'Englisch': '#ECE3F8', 'Mathematik': '#DFE8F8',
             'Ernährung & Gesundheit': '#FADDE8', 'Ethik & Religion': '#FFF0CC', 'Weltkunde & Geschichte': '#DFE8F8',
             'Sachunterricht': '#DDF2E5', 'Deutsch': '#FBE1DF', 'Klassenleben': '#ECE3F8', 'Rätsel & Spiele': '#DDF2E5',
             'Kunst & Basteln': '#FADDE8', 'Saison & Feste': '#FBE1DF'}

SAISON = r'Weihnacht|Advent|Nikolaus|Silvester|Neujahr|Christ|Dezember|Winter|Herbst|Halloween|Ostern|Frühling|Muttertag|Vatertag|Sommerferien|Plätzchen|Barbara|Lucia|Chanukka|Sternsinger|Jul|Wichteln|Wunschzettel|Geschenk'


def slugify(t):
    t = t.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('Ä', 'ae').replace('Ö', 'oe').replace('Ü', 'ue').replace('ß', 'ss')
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:70].rstrip('-')


def stufe_von(id_, t):
    if id_ in STUFE_FIX:
        s = STUFE_FIX[id_]
    else:
        m = re.search(r'(?:Kl\.|Klasse)\s*(\d+)\s*(?:[–\-/&]|bis)\s*(\d+)', t) or re.search(r'\b(\d{1,2})\s*/\s*(\d{1,2})\b', t)
        if m:
            s = f'{m.group(1)}/{m.group(2)}' if int(m.group(2)) - int(m.group(1)) == 1 else f'{m.group(1)}–{m.group(2)}'
        elif (m := re.search(r'(?:Kl\.|Klasse)\s*(\d+)', t)):
            s = m.group(1)
        elif any(r in t for r in SEK_REIHEN) or 'eigene Wohnung' in t:
            s = '9/10'
        else:
            s = '1–4'
    a, b = (int(x) for x in re.findall(r'\d+', s)) if re.search(r'\D', s) else (int(s), int(s))
    st = []
    if a <= 4: st.append('gs')
    if b >= 5 and a <= 10: st.append('sek')
    if b >= 11: st.append('ober')
    label = 'Grundschule' if s == '1–4' else 'Kl. ' + s
    return label, st


def art_von(t, umfang, seiten, fach):
    if 'Material' in umfang: return 'Sparpaket'
    if fach == 'Sport' and not re.search(r'Rätsel', t): return 'Bewegung & Spiele'
    if re.search(r'Ausmal|Mandala', t): return 'Ausmalbilder'
    if fach == 'Kunst & Basteln' or re.search(r'[Bb]astel|Fensterbild|Anhänger|Girlande|Geburtstagskalender', t): return 'Basteln & Deko'
    if re.search(r'(?i)Suchsel|Kreuzwort|Rätsel|Labyrinth|Sudoku|Logical|Escape|Geheimschrift|Buchstabensalat|Wortschlange|Quiz', t): return 'Rätsel'
    if re.search(r'(?i)Bingo|Merkspiel|Spiel|Quartett|Schattenbilder|Wimmel|Wer bin ich|Stadt, Land', t): return 'Spiele'
    if seiten >= 40: return 'Arbeitsheft'
    return 'Arbeitsblätter'


def laden():
    P, slugs = [], set()
    for z in open(os.path.join(HIER, 'eduki_katalog.tsv'), encoding='utf-8'):
        if not z.strip(): continue
        eid, titel, umfang, preis, cov = z.rstrip('\n').split('\t')
        preis = float(preis.replace(',', '.'))
        fach = next((f for f, rx in FACH_REGELN if re.search(rx, titel, re.I)), 'Saison & Feste')
        stufe, st = stufe_von(eid, titel)
        seiten = int(re.match(r'\d+', umfang).group()) if 'Seite' in umfang else 0
        art = art_von(titel, umfang, seiten, fach)
        slug = slugify(re.sub(r'\s*\|\s*Grundschule$', '', titel))
        while slug in slugs: slug += '-2'
        slugs.add(slug)
        if cov.startswith('c/'): src = 'https://eduki.com/covers/de/' + cov[2:]
        else: src = 'https://eduki.com/bundle-covers/' + cov[2:]
        thumb = 'https://eduki.com/images/convert?background=255,255,255&height=440&quality=85&type=webp&url=' + src
        if eid in LOKAL: src = thumb = '/assets/img/' + LOKAL[eid]
        anzahl = umfang.split()[0]
        info = (f'Sparpaket mit {anzahl} Materialien – günstiger als einzeln.' if art == 'Sparpaket'
                else f'{umfang} als PDF zum Ausdrucken und sofort Einsetzen.')
        P.append(dict(id=slug, eduki=eid, titel=titel, stufe=stufe, st=' '.join(st), fach=fach, art=art, info=info,
                      umfang=umfang, src=src, thumb=thumb, tint=FACH_TINT[fach], gratis=preis == 0, preis=preis,
                      schul=round(preis * SCHUL_FAKTOR, 2), saison=bool(re.search(SAISON, titel)),
                      badge='Sparpaket' if art == 'Sparpaket' else ('Neu' if int(eid) >= 2441000 else '')))
    return P


def euro(x):
    return f'{x:.2f}'.replace('.', ',') + ' €'


if __name__ == '__main__':
    from collections import Counter
    P = laden()
    print(len(P), Counter(m['fach'] for m in P))
    print(Counter(m['art'] for m in P)); print(Counter(m['st'] for m in P))
    for m in P: print(m['eduki'], m['stufe'], m['st'], '|', m['fach'], '|', m['art'], '|', m['titel'])
