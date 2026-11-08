import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { normalizeCode, normalizeLoginCode } from "@/lib/codes";
import { getStore } from "@/lib/db";
import { isValidHandle, normalizeHandle } from "@/lib/handle";
import { verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/resident";

/**
 * Entrar. Jeitos de entrar:
 * 1. @ + senha (o normal);
 * 2. código de acesso ENT-… (uso único, gerado pelo admin para quem esqueceu a senha);
 * 3. o código antigo de resgate NDC-…, só para quem entrou antes da conta
 *    normal existir e ainda não criou senha.
 */
export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere um minutinho." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const store = getStore();
  const handleIn = typeof body?.handle === "string" ? normalizeHandle(body.handle) : "";
  const secret = typeof body?.secret === "string" ? body.secret.trim() : "";
  if (!secret) return NextResponse.json({ ok: false, message: "Digite sua senha ou código." }, { status: 400 });

  let handle: string | null = null;
  let method = "";

  const loginCode = normalizeLoginCode(secret);
  if (loginCode) {
    handle = await store.consumeLoginCode(loginCode, handleIn || undefined);
    if (!handle)
      return NextResponse.json({
        ok: false,
        message: "Esse código de acesso não vale (confira o usuário, ou ele já foi usado ou expirou).",
      });
    method = "codigo_acesso";
  } else if (/^NDC/i.test(secret.replace(/[^A-Za-z]/g, ""))) {
    const code = await store.getCode(normalizeCode(secret));
    if (!code) return NextResponse.json({ ok: false, message: "Código não encontrado." });
    if (await store.getPasswordHash(code.instagramHandle))
      return NextResponse.json({ ok: false, message: "Você já criou uma senha: entre com seu usuário + senha." });
    handle = code.instagramHandle;
    method = "codigo_resgate";
  } else {
    if (!isValidHandle(handleIn)) return NextResponse.json({ ok: false, message: "Digite seu nome de usuário." }, { status: 400 });
    if (!rateLimit(`login-handle:${handleIn}`, 8, 15 * 60_000))
      return NextResponse.json({ ok: false, message: "Muitas tentativas para esse usuário. Espere 15 minutos." }, { status: 429 });
    const hash = await store.getPasswordHash(handleIn);
    if (!hash || !(await verifyPassword(secret, hash))) return NextResponse.json({ ok: false, message: "Usuário ou senha errados." });
    handle = handleIn;
    method = "senha";
  }

  const house = await store.findClaimByHandle(handle);
  const hasPassword = !!(await store.getPasswordHash(handle));
  if (!house && !hasPassword) return NextResponse.json({ ok: false, message: "Esse usuário não existe. Toque em “Criar conta”." });
  await startSession(handle);
  await audit({ actor: handle, action: "entrou", handle, citySlug: house?.citySlug ?? null, details: { jeito: method } });
  return NextResponse.json({ ok: true, handle, citySlug: house?.citySlug ?? null, hasPassword });
}
