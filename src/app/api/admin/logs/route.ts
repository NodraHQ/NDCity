import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/db";
import { normalizeHandle } from "@/lib/handle";

export const dynamic = "force-dynamic";

/** Histórico: tudo o que mudou, do mais novo para o mais antigo. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const before = Number(sp.get("before")) || undefined;
  const action = sp.get("action") || undefined;
  const handle = sp.get("handle") ? normalizeHandle(sp.get("handle")!) : undefined;
  const logs = await getStore().listLogs({ limit: 50, beforeId: before, action, handle });
  return NextResponse.json({ ok: true, logs });
}
