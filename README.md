# Bildungsmanufaktur – Shop

Statische Shop-Seite für bildungsmanufaktur.shop (Hosting: Netlify).

- `site/` – fertige Website (wird von Netlify veröffentlicht)
- `generator/` – Python-Generator: `python3 generator/build.py` erzeugt `site/` neu
  - `eduki_katalog.tsv` – alle Materialien (ID, Titel, Umfang, Preis, Cover)
  - `beschreibungen.json` – Produkttexte
  - `katalog.py` – Zuordnung von Stufe, Fach, Art und Preis (Schullizenz = Einzelpreis × 3)
