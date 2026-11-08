import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { lotCountFor } from "@/lib/city-data";
import { activeOffices } from "@/lib/civic";
import { getStore } from "@/lib/db";
import { allCities, findCity, layoutSizeFor } from "@/lib/geo/cities";

export const dynamic = "force-dynamic";

/** Casas ativas + ocupação por cidade e estado + autoridades. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const store = getStore();
  const [houses, offices] = await Promise.all([store.listAllHouses(), activeOffices()]);

  const byCity = new Map<string, { slug: string; name: string; uf: string | null; houses: number; mayor: string | null }>();
  for (const h of houses) {
    const c = byCity.get(h.citySlug) ?? { slug: h.citySlug, name: h.cityName, uf: h.uf, houses: 0, mayor: null };
    c.houses++;
    if (h.isMayor) c.mayor = h.handle;
    byCity.set(h.citySlug, c);
  }
  const cities = [...byCity.values()]
    .map((c) => {
      const lots = lotCountFor(c.slug, layoutSizeFor(findCity(c.slug)));
      return { ...c, lots, pct: Math.round((c.houses / lots) * 1000) / 10 };
    })
    .sort((a, b) => b.houses - a.houses);

  const municipios = new Map<string, number>();
  for (const c of allCities()) municipios.set(c.uf, (municipios.get(c.uf) ?? 0) + 1);
  const states = [...municipios.entries()]
    .map(([uf, total]) => {
      const mine = cities.filter((c) => c.uf === uf);
      return {
        uf,
        municipios: total,
        occupied: mine.length,
        houses: mine.reduce((n, c) => n + c.houses, 0),
        pct: Math.round((mine.length / total) * 1000) / 10,
        governor: offices.governors[uf] ?? null,
      };
    })
    .sort((a, b) => b.houses - a.houses || a.uf.localeCompare(b.uf));

  return NextResponse.json({
    ok: true,
    houses: houses.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    cities,
    states,
    president: offices.president,
  });
}
