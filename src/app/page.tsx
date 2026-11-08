import { notFound } from "next/navigation";
import CityView from "@/components/CityView";
import { DEFAULT_CITY } from "@/config/site";
import { loadCityData } from "@/lib/city-data";

export const dynamic = "force-dynamic";

/** Página inicial: mostra a cidade padrão. */
export default async function Home() {
  const data = await loadCityData(DEFAULT_CITY.slug);
  if (!data) notFound();
  return <CityView initial={data} />;
}
