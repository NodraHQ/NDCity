import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Cidades com moradores (para pintar no mapa do Brasil). */
export async function GET() {
  const cities = await getStore().listActiveCities();
  return NextResponse.json({ cities }, { headers: { "Cache-Control": "no-store" } });
}
