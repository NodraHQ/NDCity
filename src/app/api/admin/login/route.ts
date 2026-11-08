import { NextResponse } from "next/server";
import { adminConfigured, checkPassword, setAdminCookie } from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!adminConfigured())
    return NextResponse.json({ ok: false, message: "Configure a variável ADMIN_PASSWORD primeiro." }, { status: 500 });
  if (!rateLimit(`admin:${clientIp(req)}`, 8, 5 * 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere 5 minutos." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (typeof body?.password !== "string" || !checkPassword(body.password))
    return NextResponse.json({ ok: false, message: "Senha errada." }, { status: 401 });
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
