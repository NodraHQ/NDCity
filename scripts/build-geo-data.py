"""
Gera os dados do mapa do Brasil usados pelo site.

Entradas (dados públicos):
  - municipios.csv / estados.csv: github.com/kelvins/municipios-brasileiros (MIT, dados do IBGE)
  - brazil-states.geojson: github.com/codeforamerica/click_that_hood

Uso: python3 scripts/build-geo-data.py <municipios.csv> <estados.csv> <brazil-states.geojson>
Saída: src/data/brazil-map.json e src/data/cities.json
"""
import csv, json, sys, unicodedata, re
from PIL import Image, ImageDraw

mun_path, est_path, geo_path = sys.argv[1:4]
CELL = 0.1  # graus por pixel
LNG_MIN, LNG_MAX = -74.2, -28.6
LAT_MAX, LAT_MIN = 5.6, -34.0
W = round((LNG_MAX - LNG_MIN) / CELL)
H = round((LAT_MAX - LAT_MIN) / CELL)

def px(lng, lat):
    return ((lng - LNG_MIN) / CELL, (LAT_MAX - lat) / CELL)

estados = {}
with open(est_path, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        estados[r["codigo_uf"]] = r

geo = json.load(open(geo_path, encoding="utf-8"))
img = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(img)
states = []
for feat in geo["features"]:
    uf = feat["properties"]["sigla"]
    idx = len(states) + 1
    est = next(e for e in estados.values() if e["uf"] == uf)
    lx, ly = px(float(est["longitude"]), float(est["latitude"]))
    states.append({"uf": uf, "name": est["nome"], "region": est["regiao"], "x": round(lx), "y": round(ly)})
    g = feat["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        ring = [px(x, y) for x, y in poly[0]]
        if len(ring) >= 3:
            draw.polygon(ring, fill=idx)

rows = []
for y in range(H):
    runs, prev, count = [], None, 0
    for x in range(W):
        v = img.getpixel((x, y))
        if v == prev:
            count += 1
        else:
            if prev is not None:
                runs += [prev, count]
            prev, count = v, 1
    runs += [prev, count]
    rows.append(runs)

json.dump({"w": W, "h": H, "cell": CELL, "lngMin": LNG_MIN, "latMax": LAT_MAX, "states": states, "rows": rows},
          open("src/data/brazil-map.json", "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

uf_by_code = {k: v["uf"] for k, v in estados.items()}
tzs, cities = [], []
with open(mun_path, encoding="utf-8") as f:
    for r in csv.DictReader(f):
        tz = r["fuso_horario"]
        if tz not in tzs:
            tzs.append(tz)
        uf = uf_by_code[r["codigo_uf"]]
        cities.append([int(r["codigo_ibge"]), r["nome"], uf, round(float(r["latitude"]), 4),
                       round(float(r["longitude"]), 4), int(r["capital"]), tzs.index(tz)])
cities.sort(key=lambda c: (-c[5], c[1]))
slugs = set()
for c in cities:
    s = f"{slugify(c[1])}-{c[2].lower()}"
    assert s not in slugs, s
    slugs.add(s)
json.dump({"fields": ["ibge", "name", "uf", "lat", "lng", "capital", "tz"], "timezones": tzs, "cities": cities},
          open("src/data/cities.json", "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
print(f"mapa {W}x{H}, {len(states)} estados, {len(cities)} cidades, fusos: {tzs}")
