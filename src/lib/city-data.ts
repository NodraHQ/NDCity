import "server-only";
import { generateCity } from "@/lib/city/generate";
import { getStore } from "@/lib/db";
import { findCity, layoutSizeFor } from "@/lib/geo/cities";

/**
 * Dados públicos de uma cidade, prontos para o mapa. A cidade pode ser
 * um município real (dados do IBGE, mesmo que ninguém more lá ainda) ou
 * uma cidade antiga que só existe no banco (ex.: "cidadezinha").
 */
export async function loadCityData(slug: string) {
  const store = getStore();
  const geo = findCity(slug);
  const city = await store.getCity(slug);
  if (!city && !geo) return null;
  const claims = city ? await store.listClaims(city.id) : [];
  return {
    city: {
      slug,
      name: geo?.name ?? city!.name,
      uf: geo?.uf ?? city?.uf ?? null,
      seed: city?.seed ?? slug,
      layoutSize: city?.layoutSize ?? layoutSizeFor(geo),
      lat: geo?.lat ?? -15.78,
      lng: geo?.lng ?? -47.93,
      timezone: geo?.timezone ?? "America/Sao_Paulo",
      mayorHandle: city?.mayorHandle ?? null,
      hallStyle: city?.hallStyle ?? null,
    },
    houses: claims.map((c) => ({ lotIndex: c.lotIndex, handle: c.instagramHandle, type: c.buildingType, style: c.style })),
    storeKind: store.kind,
  };
}

export type CityData = NonNullable<Awaited<ReturnType<typeof loadCityData>>>;

/** Garante que a cidade existe no banco (criada no primeiro resgate). */
export async function ensureCityRow(slug: string) {
  const store = getStore();
  const existing = await store.getCity(slug);
  if (existing) return existing;
  const geo = findCity(slug);
  if (!geo) return null;
  return store.ensureCity({
    slug,
    name: geo.name,
    seed: slug,
    uf: geo.uf,
    ibgeCode: geo.ibge,
    lat: geo.lat,
    lng: geo.lng,
    timezone: geo.timezone,
    layoutSize: layoutSizeFor(geo),
  });
}

export function lotCountFor(seed: string, size: number) {
  return generateCity(seed, size).lots.length;
}
