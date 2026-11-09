import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { cancelPreapproval } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";
const denied = () => NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });

/** Assinaturas (mais recentes primeiro). O e-mail aparece mascarado. */
export async function GET() {
  if (!(await isAdmin())) return denied();
  const subs = await getStore().listSubscriptions();
  const mask = (e: string | null) => (e ? e.replace(/^(.{2}).*(@.*)$/, "$1•••$2") : null);
  return NextResponse.json({ ok: true, subscriptions: subs.map((s) => ({ ...s, payerEmail: mask(s.payerEmail) })) });
}

/** Cancelar a assinatura de alguém (ex.: abuso, ou se o limite do mês estourar). */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return denied();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const store = getStore();
  const sub = await store.getSubscription(id);
  if (!sub) return NextResponse.json({ ok: false, message: "Assinatura não encontrada." }, { status: 404 });
  try {
    if (sub.preapprovalId && sub.status !== "cancelled") await cancelPreapproval(sub.preapprovalId);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, message: "O Mercado Pago não respondeu. Tente de novo." }, { status: 502 });
  }
  await store.setSubscriptionStatus(sub.id, "cancelled");
  await audit({ actor: "admin", action: "assinatura_cancelled", handle: sub.handle, details: { assinatura: sub.id, por: "admin" } });
  return NextResponse.json({ ok: true });
}
