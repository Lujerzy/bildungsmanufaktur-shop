"""Baut cloudflare/worker.js aus worker.template.js + Katalog (Titel, Slugs, Gratis) + pakete.json."""
import json, os, sys
HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
from katalog import laden

P = laden(alle=True)
man = {'dateien': {}, 'pakete': json.load(open(os.path.join(HIER, '..', 'cloudflare', 'pakete.json'), encoding='utf-8')),
       'titel': {m['eduki']: m['titel'] for m in P}, 'slug': {m['id']: m['eduki'] for m in P},
       'gratis': [m['eduki'] for m in P if m['gratis']]}
t = open(os.path.join(HIER, '..', 'cloudflare', 'worker.template.js'), encoding='utf-8').read()
open(os.path.join(HIER, '..', 'cloudflare', 'worker.js'), 'w', encoding='utf-8').write(
    t.replace('__MANIFEST__', json.dumps(man, ensure_ascii=False, separators=(',', ':'))))
print('worker.js:', len(man['titel']), 'Titel,', len(man['pakete']), 'Pakete,', len(man['gratis']), 'gratis')
