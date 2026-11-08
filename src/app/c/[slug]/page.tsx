import { notFound } from "next/navigation";
import CityView from "@/components/CityView";
import { loadCityData } from "@/lib/city-data";

export const dynamic = "force-dynamic";

/** Uma cidade específica: /c/nome-da-cidade (pronto para o mapa-múndi). */
export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadCityData(slug);
  if (!data) notFound();
  return <CityView initial={data} />;
}
