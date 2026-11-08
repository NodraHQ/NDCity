import "server-only";
import { generateCity } from "@/lib/city/generate";
import { getStore } from "@/lib/db";

/** Dados públicos de uma cidade, prontos para o mapa. */
export async function loadCityData(slug: string) {
  const store = getStore();
  const city = await store.getCity(slug);
  if (!city) return null;
  const claims = await store.listClaims(city.id);
  return {
    city: { slug: city.slug, name: city.name, seed: city.seed, mayorHandle: city.mayorHandle },
    houses: claims.map((c) => ({ lotIndex: c.lotIndex, handle: c.instagramHandle, type: c.buildingType })),
    storeKind: store.kind,
  };
}

export type CityData = NonNullable<Awaited<ReturnType<typeof loadCityData>>>;

export function lotCountFor(seed: string) {
  return generateCity(seed).lots.length;
}
