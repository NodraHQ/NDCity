import { NextResponse } from "next/server";
import { ensureCityRow, lotCountFor } from "@/lib/city-data";
import { getStore } from "@/lib/db";
import { currentResident } from "@/lib/resident";

const ERRORS: Record<string, string> = {
  no_house: "Você ainda não tem casinha.",
  no_credit: "Você precisa de um caminhão de mudança (recurso pago).",
  city_not_found: "Cidade não encontrada.",
  same_city: "Você já mora nessa cidade.",
  invalid_lot: "Esse lote não existe.",
  lot_taken: "Alguém acabou de pegar esse lote! Escolha outro.",
};

/** Mudança de cidade (gasta 1 crédito de mudança). */
export async function POST(req: Request) {
  const r = await currentResident();
  if (!r?.house) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { citySlug, lotIndex } = body ?? {};
  if (typeof citySlug !== "string" || !Number.isInteger(lotIndex))
    return NextResponse.json({ ok: false, message: "Pedido inválido." }, { status: 400 });

  const city = await ensureCityRow(citySlug);
  if (!city) return NextResponse.json({ ok: false, message: ERRORS.city_not_found }, { status: 404 });
  const res = await getStore().moveHouse({
    handle: r.handle,
    citySlug,
    lotIndex,
    lotCount: lotCountFor(city.seed, city.layoutSize),
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error, message: ERRORS[res.error] });
  return NextResponse.json({ ok: true, lotIndex: res.claim.lotIndex, isMayor: res.isMayor });
}
