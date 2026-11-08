import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { checkSignature, getPayment, mercadoPagoConfigured } from "@/lib/payments/mercadopago";
import { isProductId, PRODUCTS } from "@/lib/payments/products";

export const dynamic = "force-dynamic";

/**
 * Aviso de pagamento do Mercado Pago. Nunca confia no conteúdo do aviso:
 * pega só o número do pagamento e pergunta direto à API se foi aprovado,
 * de qual compra é e qual o valor. Só então libera o recurso, uma vez só.
 */
async function handle(req: Request) {
  if (!mercadoPagoConfigured()) return NextResponse.json({ ok: true });
  const url = new URL(req.url);
  const body = await req.json().catch(() => null);
  const type = body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (type !== "payment" || !/^\d+$/.test(dataId)) return NextResponse.json({ ok: true, ignored: true });

  if (checkSignature(req, dataId) === "invalida") {
    console.warn("aviso do Mercado Pago com assinatura inválida", dataId);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const store = getStore();
  let payment;
  try {
    payment = await getPayment(dataId);
  } catch (e) {
    console.error("não consegui consultar o pagamento", dataId, e);
    return NextResponse.json({ ok: false }, { status: 502 }); // o Mercado Pago tenta de novo depois
  }
  const purchase = payment.external_reference ? await store.getPurchase(payment.external_reference) : null;
  if (!purchase || !isProductId(purchase.product)) return NextResponse.json({ ok: true, ignored: true });
  const product = PRODUCTS[purchase.product];

  if (payment.status === "approved") {
    const amountOk = payment.currency_id === "BRL" && Math.round(payment.transaction_amount * 100) === purchase.amountCents;
    if (!amountOk) {
      await audit({ actor: "sistema", action: "pagamento_suspeito", handle: purchase.handle, details: { mp: dataId, valor: payment.transaction_amount } });
      return NextResponse.json({ ok: true });
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
  } else if ((payment.status === "refunded" || payment.status === "charged_back") && purchase.status === "paid") {
    await store.setPurchaseStatus(purchase.id, "refunded");
    await audit({ actor: "sistema", action: "estorno", handle: purchase.handle, details: { produto: product.label, valor: purchase.amountCents / 100, mercadopago: String(payment.id) } });
  } else if ((payment.status === "rejected" || payment.status === "cancelled") && purchase.status === "pending") {
    await store.setPurchaseStatus(purchase.id, "canceled");
  }
  return NextResponse.json({ ok: true });
}

export const POST = handle;
export const GET = handle;
