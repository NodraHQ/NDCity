import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { isBuildingType } from "@/lib/buildings";
import { ensureCityRow, lotCountFor } from "@/lib/city-data";
import { getStore } from "@/lib/db";
import { CLAIM_ERRORS } from "@/lib/messages";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { currentHandle } from "@/lib/resident";

/** Resgata a casinha de quem já criou a conta: cidade + lote + tipo. */
export async function POST(req: Request) {
  if (!rateLimit(`claim:${clientIp(req)}`, 10, 60_000))
    return NextResponse.json({ ok: false, message: CLAIM_ERRORS.rate_limited }, { status: 429 });
  const handle = await currentHandle();
  if (!handle) return NextResponse.json({ ok: false, message: "Crie sua conta ou entre primeiro." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { citySlug, lotIndex, buildingType } = body ?? {};
  if (typeof citySlug !== "string" || !Number.isInteger(lotIndex) || !isBuildingType(buildingType))
    return NextResponse.json({ ok: false, message: CLAIM_ERRORS.bad_request }, { status: 400 });

  const city = await ensureCityRow(citySlug);
  if (!city) return NextResponse.json({ ok: false, message: CLAIM_ERRORS.city_not_found }, { status: 404 });

  const result = await getStore().claimDirect({
    handle,
    citySlug,
    lotIndex,
    lotCount: lotCountFor(city.seed, city.layoutSize),
    buildingType,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, message: CLAIM_ERRORS[result.error] });

  await audit({ actor: handle, action: "chegou", handle, citySlug, details: { tipo: buildingType, prefeito: result.isMayor } });
  return NextResponse.json({ ok: true, handle, lotIndex: result.claim.lotIndex, isMayor: result.isMayor });
}
