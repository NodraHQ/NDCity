import { NextResponse } from "next/server";
import { loadCityData } from "@/lib/city-data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const data = await loadCityData(slug);
  if (!data) return NextResponse.json({ error: "city_not_found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
