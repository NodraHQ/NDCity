import { NextResponse } from "next/server";
import { codeForHandle } from "@/lib/access";
import { isAdmin } from "@/lib/admin-auth";
import { isValidHandle, normalizeHandle } from "@/lib/handle";

/** Admin gera o código certo para um @ (resgate ou acesso) + mensagem pronta para DM. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const h = normalizeHandle(String(body?.handle ?? ""));
  if (!isValidHandle(h)) return NextResponse.json({ ok: false, message: "@ inválido." }, { status: 400 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  return NextResponse.json({ ok: true, handle: h, ...(await codeForHandle(h, "admin", site)) });
}
