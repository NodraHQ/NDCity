import raw from "@/data/cities.json";

/**
 * Os 5.570 municípios do Brasil (dados do IBGE). Cada um é uma cidade do
 * jogo, identificada pelo "slug" (ex.: "goiania-go").
 */
export type GeoCity = {
  slug: string;
  ibge: number;
  name: string;
  uf: string;
  lat: number;
  lng: number;
  capital: boolean;
  timezone: string;
};

type Row = [number, string, string, number, number, number, number];

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

let list: GeoCity[] | null = null;
let bySlug: Map<string, GeoCity> | null = null;

export function allCities(): GeoCity[] {
  if (!list) {
    list = (raw.cities as Row[]).map(([ibge, name, uf, lat, lng, capital, tz]) => ({
      slug: `${slugify(name)}-${uf.toLowerCase()}`,
      ibge,
      name,
      uf,
      lat,
      lng,
      capital: capital === 1,
      timezone: raw.timezones[tz],
    }));
  }
  return list;
}

export function findCity(slug: string): GeoCity | null {
  if (!bySlug) bySlug = new Map(allCities().map((c) => [c.slug, c]));
  return bySlug.get(slug) ?? null;
}

/** Busca por nome, sem ligar para acentos. Capitais primeiro. */
export function searchCities(query: string, limit = 8): GeoCity[] {
  const q = slugify(query);
  if (q.length < 2) return [];
  const starts: GeoCity[] = [];
  const contains: GeoCity[] = [];
  for (const c of allCities()) {
    const s = slugify(c.name);
    if (s.startsWith(q)) starts.push(c);
    else if (s.includes(q)) contains.push(c);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Capitais ganham uma cidade maior. */
export function layoutSizeFor(city: { capital: boolean } | null): number {
  return city?.capital ? 28 : 22;
}
