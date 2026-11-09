import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { cancelPreapproval } from "@/lib/payments/mercadopago";
import { currentResident } from "@/lib/resident";

/** Cancela a assinatura: não cobra mais; o chat continua até o fim do mês já pago. */
export async function POST() {
  const r = await currentResident();
  if (!r) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  const store = getStore();
  const sub = await store.getLiveSubscription(r.handle);
  if (!sub) return NextResponse.json({ ok: false, message: "Você não tem assinatura ativa." });
  try {
    if (sub.preapprovalId) await cancelPreapproval(sub.preapprovalId);
  } catch (e) {
    console.error("cancelamento no Mercado Pago falhou", e);
    return NextResponse.json({ ok: false, message: "Não consegui cancelar agora. Tente de novo em instantes." }, { status: 502 });
  }
  await store.setSubscriptionStatus(sub.id, "cancelled");
  await audit({ actor: r.handle, action: "assinatura_cancelled", handle: r.handle, details: { assinatura: sub.id, por: "morador" } });
  return NextResponse.json({ ok: true, chatUntil: r.perks.chatUntil });
}
