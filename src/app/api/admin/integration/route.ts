import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Dados para configurar a ferramenta de DM (só o admin vê a chave). */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const key = process.env.BOT_SECRET ?? null;
  return NextResponse.json({ ok: true, configured: !!key, site, endpoint: `${site}/api/bot/code`, key });
}
