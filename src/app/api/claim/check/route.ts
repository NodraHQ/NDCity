import { NextResponse } from "next/server";
import { normalizeCode } from "@/lib/codes";
import { getStore } from "@/lib/db";
import { CLAIM_ERRORS } from "@/lib/messages";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Confere um código antes de a pessoa escolher o lote. */
export async function POST(req: Request) {
  if (!rateLimit(`check:${clientIp(req)}`, 15, 60_000))
    return NextResponse.json({ ok: false, message: CLAIM_ERRORS.rate_limited }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (typeof body?.code !== "string")
    return NextResponse.json({ ok: false, message: CLAIM_ERRORS.bad_request }, { status: 400 });

  const store = getStore();
  const code = await store.getCode(normalizeCode(body.code));
  if (!code) return NextResponse.json({ ok: false, message: CLAIM_ERRORS.code_not_found });
  if (code.usedAt || (await store.findClaimByHandle(code.instagramHandle)))
    return NextResponse.json({
      ok: false,
      alreadyResident: true,
      message: "Esse código já foi usado. Se a casinha é sua, toque em “Já tenho casinha” para entrar.",
    });

  return NextResponse.json({ ok: true, code: code.code, handle: code.instagramHandle });
}
