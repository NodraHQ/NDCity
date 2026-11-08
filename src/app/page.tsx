import WorldView from "@/components/world/WorldView";
import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Página inicial: o mapa do Brasil. */
export default async function Home() {
  const cities = await getStore().listActiveCities();
  return <WorldView initialActive={cities.map(({ slug, houses, mayorHandle }) => ({ slug, houses, mayorHandle }))} />;
}
