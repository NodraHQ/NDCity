import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/db";
import { findCity } from "@/lib/geo/cities";
import { PRODUCTS, isProductId } from "@/lib/payments/products";

export const dynamic = "force-dynamic";

/** Dia no horário de Brasília (AAAA-MM-DD). */
const brDay = (d: Date | string) => new Date(new Date(d).getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Acessos, gente online, casas novas e dinheiro movimentado. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const store = getStore();
  const today = brDay(new Date());
  const since = brDay(new Date(Date.now() - 29 * 86400_000));
  const [visits, houses, purchases] = await Promise.all([store.listVisits(since), store.listAllHouses(), store.listPurchases()]);

  const fiveMin = Date.now() - 5 * 60_000;
  const online = visits.filter((v) => Date.parse(v.lastAt) > fiveMin);
  const onlineResidents = [...new Set(online.map((v) => v.handle).filter(Boolean))] as string[];

  const days: { day: string; visitors: number; views: number; houses: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = brDay(new Date(Date.now() - i * 86400_000));
    const vs = visits.filter((v) => v.day === day);
    days.push({
      day,
      visitors: vs.length,
      views: vs.reduce((n, v) => n + v.views, 0),
      houses: houses.filter((h) => brDay(h.createdAt) === day).length,
    });
  }

  const weekAgo = brDay(new Date(Date.now() - 6 * 86400_000));
  const pathCount = new Map<string, number>();
  for (const v of visits) if (v.day >= weekAgo && v.lastPath) pathCount.set(v.lastPath, (pathCount.get(v.lastPath) ?? 0) + 1);
  const topPages = [...pathCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => {
      const slug = path.startsWith("/c/") ? path.slice(3) : null;
      const c = slug ? findCity(slug) : null;
      return { path, label: c ? `${c.name} · ${c.uf}` : path === "/" ? "Mapa do Brasil" : path, count };
    });

  const paid = purchases.filter((p) => p.status === "paid");
  const month = today.slice(0, 7);
  const sum = (list: typeof paid) => list.reduce((n, p) => n + p.amountCents, 0);
  const byProduct = Object.entries(
    paid.reduce<Record<string, { count: number; cents: number }>>((acc, p) => {
      const k = isProductId(p.product) ? PRODUCTS[p.product].label : p.product;
      acc[k] ??= { count: 0, cents: 0 };
      acc[k].count++;
      acc[k].cents += p.amountCents;
      return acc;
    }, {}),
  ).map(([label, v]) => ({ label, ...v }));

  return NextResponse.json({
    ok: true,
    online: { visitors: online.length, residents: onlineResidents },
    today: days[days.length - 1],
    last30: { visitors: new Set(visits.map((v) => v.visitorId)).size, views: visits.reduce((n, v) => n + v.views, 0) },
    days,
    topPages,
    revenue: {
      totalCents: sum(paid),
      monthCents: sum(paid.filter((p) => brDay(p.createdAt).startsWith(month))),
      last30Cents: sum(paid.filter((p) => brDay(p.createdAt) >= since)),
      count: paid.length,
      byProduct,
      recent: paid.slice(0, 15).map((p) => ({
        handle: p.handle,
        label: isProductId(p.product) ? PRODUCTS[p.product].label : p.product,
        cents: p.amountCents,
        at: p.createdAt,
        provider: p.provider,
      })),
    },
  });
}
