import { NextResponse } from "next/server";
import { isBuildingType } from "@/lib/buildings";
import { lotCountFor } from "@/lib/city-data";
import { normalizeCode } from "@/lib/codes";
import { getStore } from "@/lib/db";
import { CLAIM_ERRORS } from "@/lib/messages";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Resgata a casinha: código + lote + tipo de construção. */
export async function POST(req: Request) {
  if (!rateLimit(`claim:${clientIp(req)}`, 10, 60_000))
    return NextResponse.json({ ok: false, message: CLAIM_ERRORS.rate_limited }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { code, citySlug, lotIndex, buildingType } = body ?? {};
  if (typeof code !== "string" || typeof citySlug !== "string" || !Number.isInteger(lotIndex) || !isBuildingType(buildingType))
    return NextResponse.json({ ok: false, message: CLAIM_ERRORS.bad_request }, { status: 400 });

  const store = getStore();
  const city = await store.getCity(citySlug);
  if (!city) return NextResponse.json({ ok: false, message: CLAIM_ERRORS.city_not_found }, { status: 404 });

  const result = await store.claim({
    code: normalizeCode(code),
    citySlug,
    lotIndex,
    lotCount: lotCountFor(city.seed),
    buildingType,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, message: CLAIM_ERRORS[result.error] });

  return NextResponse.json({
    ok: true,
    handle: result.claim.instagramHandle,
    lotIndex: result.claim.lotIndex,
    isMayor: result.isMayor,
  });
}
