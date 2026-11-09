import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";
const denied = () => NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });

/** Últimas mensagens dos chats (de todas as cidades ou de uma). */
export async function GET(req: Request) {
  if (!(await isAdmin())) return denied();
  const city = new URL(req.url).searchParams.get("city") || undefined;
  return NextResponse.json({ ok: true, messages: await getStore().listRecentMessages({ citySlug: city, limit: 200 }) });
}

/** Apagar uma mensagem. */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return denied();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false }, { status: 400 });
  const handle = new URL(req.url).searchParams.get("handle");
  await getStore().deleteMessage(id);
  await audit({ actor: "admin", action: "mensagem_apagada", handle, details: { id } });
  return NextResponse.json({ ok: true });
}
