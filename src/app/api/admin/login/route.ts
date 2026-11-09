import { NextResponse } from "next/server";
import { adminConfigured, checkPassword, setAdminCookie } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { clientIp, ipKey, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!adminConfigured())
    return NextResponse.json({ ok: false, message: "Configure a variável ADMIN_PASSWORD primeiro." }, { status: 500 });
  if (!rateLimit(`admin:${clientIp(req)}`, 8, 5 * 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere 5 minutos." }, { status: 429 });
  // limite guardado no banco (vale para todos os servidores): por aparelho/rede e no total
  const store = getStore();
  if (!(await store.hitRate(`admin:${ipKey(req)}`, 10, 15 * 60)) || !(await store.hitRate("admin:total", 60, 60 * 60)))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere um pouco e tente de novo." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (typeof body?.password !== "string" || !checkPassword(body.password))
    return NextResponse.json({ ok: false, message: "Senha errada." }, { status: 401 });
  await setAdminCookie();
  await audit({ actor: "admin", action: "admin_entrou" });
  return NextResponse.json({ ok: true });
}
