import "server-only";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import type { Subscription } from "@/lib/db/types";
import { type MpAuthorizedPayment, getPreapproval, listAuthorizedPayments } from "./mercadopago";
import { PRODUCTS } from "./products";

/**
 * Assinatura mensal do chat (cartão, renova sozinha, cancelável).
 * Cada mensalidade aprovada dá 30 dias de chat (somados ao que já tinha).
 */
const PRODUCT = PRODUCTS.chat_mensal;
const PROVIDER = "mercadopago_assinatura";

const STATUS: Record<string, Subscription["status"]> = {
  pending: "pending",
  authorized: "authorized",
  paused: "paused",
  cancelled: "cancelled",
};

/** Uma mensalidade cobrada: libera o chat uma vez só por pagamento. */
export async function applyAuthorizedPayment(sub: Subscription, ap: MpAuthorizedPayment) {
  if (ap.payment?.status !== "approved") return false;
  if (ap.currency_id !== "BRL" || Math.round(ap.transaction_amount * 100) !== PRODUCT.priceCents) {
    await audit({ actor: "sistema", action: "pagamento_suspeito", handle: sub.handle, details: { assinatura: sub.id, valor: ap.transaction_amount } });
    return false;
  }
  const store = getStore();
  const isNew = await store.recordPaidPurchase({
    handle: sub.handle,
    product: "chat_mensal",
    amountCents: PRODUCT.priceCents,
    provider: PROVIDER,
    providerRef: String(ap.payment.id),
  });
  if (!isNew) return false;
  await store.grantEntitlement(sub.handle, "chat", { days: PRODUCT.days });
  await audit({
    actor: "sistema",
    action: "assinatura_paga",
    handle: sub.handle,
    details: { produto: "Chat (assinatura)", valor: PRODUCT.priceCents / 100, mercadopago: String(ap.payment.id) },
  });
  return true;
}

/**
 * Confere a assinatura direto no Mercado Pago: status e mensalidades pagas.
 * Funciona mesmo se o aviso automático (webhook) não chegar.
 */
export async function syncSubscription(sub: Subscription) {
  if (!sub.preapprovalId) return sub;
  const store = getStore();
  const pre = await getPreapproval(sub.preapprovalId);
  if (pre.external_reference !== sub.id) return sub;
  const status = STATUS[pre.status] ?? sub.status;
  if (status !== sub.status) {
    await store.setSubscriptionStatus(sub.id, status);
    await audit({
      actor: "sistema",
      action: status === "authorized" && sub.status === "pending" ? "assinatura_ativada" : `assinatura_${status}`,
      handle: sub.handle,
      details: { assinatura: sub.id },
    });
  }
  if (status !== "pending") {
    for (const ap of await listAuthorizedPayments(sub.preapprovalId)) await applyAuthorizedPayment(sub, ap);
  }
  return { ...sub, status };
}
