import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/db";
import { normalizeHandle } from "@/lib/handle";

/** Remove a casinha e todo o acesso de um @ (ex.: abuso). */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const handle = normalizeHandle(new URL(req.url).searchParams.get("handle") ?? "");
  if (!handle) return NextResponse.json({ ok: false, message: "Digite um @." }, { status: 400 });
  const { hadHouse } = await getStore().removeHouse(handle);
  return NextResponse.json({
    ok: true,
    message: hadHouse
      ? `Casinha de @${handle} removida. Os códigos e logins dessa pessoa foram apagados.`
      : `@${handle} não tinha casinha, mas os códigos e logins foram apagados.`,
  });
}
