import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { proposeHall } from "@/lib/civic";
import { getStore } from "@/lib/db";
import { currentResident } from "@/lib/resident";
import { sanitizeStyle } from "@/lib/styles";

/**
 * Personalizar a casa (recurso pago) ou propor a pintura da prefeitura
 * (o prefeito propõe, os moradores votam).
 */
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
    if (!style) return NextResponse.json({ ok: false, message: "Escolha alguma mudança." }, { status: 400 });
    const { approvedNow } = await proposeHall(city, r.handle, style);
    await audit({ actor: r.handle, action: "proposta_prefeitura", handle: r.handle, citySlug: city.slug, details: { aprovada_na_hora: approvedNow } });
    return NextResponse.json({
      ok: true,
      message: approvedNow
        ? "Aprovado! Como a maioria já concordou, a prefeitura foi pintada."
        : "Proposta enviada! Os moradores têm 24h para votar.",
    });
  } else {
    await store.setHouseStyle(r.handle, style);
    await audit({ actor: r.handle, action: "casa_pintada", handle: r.handle, citySlug: r.house.citySlug, details: { bandeira: !!style?.flag } });
  }
  return NextResponse.json({ ok: true });
}
