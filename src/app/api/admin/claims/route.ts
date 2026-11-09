import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { cancelPreapproval } from "@/lib/payments/mercadopago";
import { normalizeHandle } from "@/lib/handle";

/** Remove a casinha e todo o acesso de um @ (ex.: abuso). */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const handle = normalizeHandle(new URL(req.url).searchParams.get("handle") ?? "");
  if (!handle) return NextResponse.json({ ok: false, message: "Digite um @." }, { status: 400 });
  const before = await getStore().findClaimByHandle(handle);
  const sub = await getStore().getLiveSubscription(handle);
  if (sub?.preapprovalId)
    await cancelPreapproval(sub.preapprovalId).catch((e) => console.error("não consegui cancelar a assinatura", e));
  const { hadHouse } = await getStore().removeHouse(handle);
  await audit({ actor: "admin", action: "removido", handle, citySlug: before?.citySlug ?? null, details: { tinha_casa: hadHouse } });
  return NextResponse.json({
    ok: true,
    message: hadHouse
      ? `Casinha de @${handle} removida. Os códigos e logins dessa pessoa foram apagados.`
      : `@${handle} não tinha casinha, mas os códigos e logins foram apagados.`,
  });
}
