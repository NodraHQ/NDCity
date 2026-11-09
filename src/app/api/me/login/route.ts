import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { normalizeLoginCode } from "@/lib/codes";
import { getStore } from "@/lib/db";
import { isValidHandle, normalizeHandle } from "@/lib/handle";
import { verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/resident";

/**
 * Entrar: usuário + senha. Quem esqueceu a senha recebe do admin um código
 * de acesso (ENT-…, vale uma vez, por 24h) e usa no lugar da senha.
 */
export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere um minutinho." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const store = getStore();
  const handleIn = typeof body?.handle === "string" ? normalizeHandle(body.handle) : "";
  const secret = typeof body?.secret === "string" ? body.secret.trim() : "";
  if (!secret) return NextResponse.json({ ok: false, message: "Digite sua senha." }, { status: 400 });
  if (!isValidHandle(handleIn)) return NextResponse.json({ ok: false, message: "Digite seu nome de usuário." }, { status: 400 });

  let handle: string;
  let method: string;
  const loginCode = normalizeLoginCode(secret);
  if (loginCode) {
    const owner = await store.consumeLoginCode(loginCode, handleIn);
    if (!owner)
      return NextResponse.json({ ok: false, message: "Esse código de acesso não vale (confira o usuário, ou ele já foi usado ou expirou)." });
    handle = owner;
    method = "codigo_acesso";
  } else {
    if (!rateLimit(`login-handle:${handleIn}`, 8, 15 * 60_000))
      return NextResponse.json({ ok: false, message: "Muitas tentativas para esse usuário. Espere 15 minutos." }, { status: 429 });
    const hash = await store.getPasswordHash(handleIn);
    if (!hash || !(await verifyPassword(secret, hash))) return NextResponse.json({ ok: false, message: "Usuário ou senha errados." });
    handle = handleIn;
    method = "senha";
  }

  const house = await store.findClaimByHandle(handle);
  await startSession(handle);
  await audit({ actor: handle, action: "entrou", handle, citySlug: house?.citySlug ?? null, details: { jeito: method } });
  return NextResponse.json({ ok: true, handle, citySlug: house?.citySlug ?? null, hasPassword: true });
}
