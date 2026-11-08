import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/db";
import { normalizeHandle } from "@/lib/handle";

/** Remove a casinha de um @ (ex.: alguém com nome ofensivo). */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const handle = normalizeHandle(new URL(req.url).searchParams.get("handle") ?? "");
  const store = getStore();
  const claim = await store.findClaimByHandle(handle);
  if (!claim) return NextResponse.json({ ok: false, message: "Esse @ não tem casinha." }, { status: 404 });
  await store.deleteClaim(claim.id);
  return NextResponse.json({ ok: true });
}
