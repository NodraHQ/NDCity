import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { hashPassword, validPassword } from "@/lib/password";
import { currentHandle } from "@/lib/resident";

/** Criar ou trocar a senha (precisa estar logado). */
export async function POST(req: Request) {
  const handle = await currentHandle();
  if (!handle) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!validPassword(body?.password)) return NextResponse.json({ ok: false, message: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  const store = getStore();
  const had = !!(await store.getPasswordHash(handle));
  await store.setPasswordHash(handle, await hashPassword(body.password));
  await audit({ actor: handle, action: had ? "senha_trocada" : "senha_criada", handle });
  return NextResponse.json({ ok: true });
}
