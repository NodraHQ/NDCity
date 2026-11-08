import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { isValidNewUsername, normalizeHandle } from "@/lib/handle";
import { hashPassword, validPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/resident";

/**
 * Criar conta: nome de usuário + senha. A pessoa já sai logada e depois
 * escolhe a cidade e resgata a casinha.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`signup-try:${ip}`, 20, 60 * 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const handle = normalizeHandle(String(body?.handle ?? ""));
  if (!isValidNewUsername(handle))
    return NextResponse.json(
      { ok: false, message: "Nome de usuário inválido: use de 3 a 20 letras, números, ponto ou _ (sem começar ou terminar com ponto)." },
      { status: 400 },
    );
  if (!validPassword(body?.password))
    return NextResponse.json({ ok: false, message: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });

  const store = getStore();
  if (await store.findClaimByHandle(handle))
    return NextResponse.json({ ok: false, message: `O nome “${handle}” já está em uso. Escolha outro.` });
  // limite de contas novas por aparelho/rede, contra quem tenta pegar vários @
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60_000))
    return NextResponse.json({ ok: false, message: "Muitas contas criadas daqui. Tente mais tarde." }, { status: 429 });
  const created = await store.createAccount(handle, await hashPassword(body.password));
  if (!created) return NextResponse.json({ ok: false, message: `O nome “${handle}” já está em uso. Escolha outro.` });

  await startSession(handle);
  await audit({ actor: handle, action: "conta_criada", handle });
  return NextResponse.json({ ok: true, handle });
}
