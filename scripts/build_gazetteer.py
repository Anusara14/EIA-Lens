# Rebuild src/engine/gazetteer.json from Natural Earth (public domain):
#   curl -L -o places.geojson https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_10m_populated_places_simple.geojson
#   python scripts/build_gazetteer.py places.geojson src/engine/gazetteer.json
import json, sys
src, out = sys.argv[1], sys.argv[2]
g = json.load(open(src, encoding='utf-8'))
places, countries = [], {}
for f in g['features']:
    p = f['properties']
    name = (p.get('nameascii') or p.get('name') or '').strip()
    country = (p.get('adm0name') or '').strip()
    if len(name) < 3 or not country: continue
    places.append([name, round(p['latitude'], 4), round(p['longitude'], 4), country, int(p.get('pop_max') or 0)])
    c = countries.setdefault(country, [0, 0, 0])
    c[0] += p['latitude']; c[1] += p['longitude']; c[2] += 1
cent = {k: [round(v[0] / v[2], 3), round(v[1] / v[2], 3)] for k, v in countries.items()}
json.dump({'places': places, 'countries': cent}, open(out, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print(len(places), 'places', len(cent), 'countries')
