import { NextResponse } from "next/server";
import { normalizeCode } from "@/lib/codes";
import { getStore } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/resident";

/** "Já tenho casinha": entra com o mesmo código usado no resgate. */
export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere um minutinho." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (typeof body?.code !== "string") return NextResponse.json({ ok: false, message: "Digite seu código." }, { status: 400 });

  const store = getStore();
  const code = await store.getCode(normalizeCode(body.code));
  const house = code ? await store.findClaimByHandle(code.instagramHandle) : null;
  if (!code || !house) {
    return NextResponse.json({
      ok: false,
      message: code ? "Esse código ainda não foi usado. Toque em “Resgatar casinha”." : "Código não encontrado.",
    });
  }
  await startSession(code.instagramHandle);
  return NextResponse.json({ ok: true, handle: code.instagramHandle, citySlug: house.citySlug });
}
