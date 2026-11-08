import "server-only";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import type { Purchase } from "@/lib/db/types";
import type { MpPayment } from "./mercadopago";
import { isProductId, PRODUCTS } from "./products";

/**
 * Aplica o resultado de um pagamento do Mercado Pago numa compra.
 * Usado pelo aviso (webhook) e pela conferência da tela "aguardando Pix".
 * Seguro para rodar várias vezes: libera o recurso uma vez só.
 */
export async function applyPayment(payment: MpPayment, knownPurchase?: Purchase | null) {
  const store = getStore();
  const purchase = knownPurchase ?? (payment.external_reference ? await store.getPurchase(payment.external_reference) : null);
  if (!purchase || !isProductId(purchase.product) || payment.external_reference !== purchase.id) return "ignorado";
  const product = PRODUCTS[purchase.product];

  if (payment.status === "approved") {
    const amountOk = payment.currency_id === "BRL" && Math.round(payment.transaction_amount * 100) === purchase.amountCents;
    if (!amountOk) {
      await audit({ actor: "sistema", action: "pagamento_suspeito", handle: purchase.handle, details: { mp: String(payment.id), valor: payment.transaction_amount } });
      return "suspeito";
    }
    if (await store.markPurchasePaid(purchase.id, String(payment.id))) {
      await store.grantEntitlement(purchase.handle, product.feature, { days: product.days, credits: product.credits });
      await audit({
        actor: "sistema",
        action: "pagamento",
        handle: purchase.handle,
        details: { produto: product.label, valor: purchase.amountCents / 100, mercadopago: String(payment.id), teste: !payment.live_mode },
      });
    }
    return "pago";
  }
  if ((payment.status === "refunded" || payment.status === "charged_back") && purchase.status === "paid") {
    await store.setPurchaseStatus(purchase.id, "refunded");
    await audit({
      actor: "sistema",
      action: "estorno",
      handle: purchase.handle,
      details: { produto: product.label, valor: purchase.amountCents / 100, mercadopago: String(payment.id) },
    });
    return "estornado";
  }
  return payment.status;
}
