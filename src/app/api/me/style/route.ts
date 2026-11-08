import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentResident } from "@/lib/resident";
import { sanitizeStyle } from "@/lib/styles";

/** Personalizar a casa ou a prefeitura (recurso pago). */
export async function POST(req: Request) {
  const r = await currentResident();
  if (!r?.house) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  if (!r.perks.customize)
    return NextResponse.json({ ok: false, message: "A personalização é um recurso pago." }, { status: 402 });

  const body = await req.json().catch(() => null);
  const style = sanitizeStyle(body?.style);
  const store = getStore();
  if (body?.target === "hall") {
    const city = await store.getCity(r.house.citySlug);
    if (!city || city.mayorHandle !== r.handle)
      return NextResponse.json({ ok: false, message: "Só o prefeito pode pintar a prefeitura." }, { status: 403 });
    await store.setHallStyle(city.id, style);
  } else {
    await store.setHouseStyle(r.handle, style);
  }
  return NextResponse.json({ ok: true });
}
