import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { checkSignature, getPayment, mercadoPagoConfigured } from "@/lib/payments/mercadopago";
import { applyPayment } from "@/lib/payments/fulfill";
import { getAuthorizedPayment } from "@/lib/payments/mercadopago";
import { applyAuthorizedPayment, syncSubscription } from "@/lib/payments/subscriptions";

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
  if (!/^[\w-]{1,64}$/.test(dataId)) return NextResponse.json({ ok: true, ignored: true });

  // assinatura: mudou de situação (ativada, pausada, cancelada)
  if (type === "subscription_preapproval") {
    if (checkSignature(req, dataId) === "invalida") return NextResponse.json({ ok: false }, { status: 401 });
    const sub = await getStore().getSubscriptionByPreapproval(dataId);
    if (sub) {
      try {
        await syncSubscription(sub);
      } catch (e) {
        console.error("aviso de assinatura falhou", e);
        return NextResponse.json({ ok: false }, { status: 502 });
      }
    }
    return NextResponse.json({ ok: true });
  }
  // assinatura: mensalidade cobrada
  if (type === "subscription_authorized_payment") {
    if (checkSignature(req, dataId) === "invalida") return NextResponse.json({ ok: false }, { status: 401 });
    try {
      const ap = await getAuthorizedPayment(dataId);
      const sub = await getStore().getSubscriptionByPreapproval(ap.preapproval_id);
      if (sub) await applyAuthorizedPayment(sub, ap);
    } catch (e) {
      console.error("aviso de mensalidade falhou", e);
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

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
  const result = await applyPayment(payment);
  if (result === "rejected" || result === "cancelled") {
    const purchase = payment.external_reference ? await store.getPurchase(payment.external_reference) : null;
    if (purchase?.status === "pending") await store.setPurchaseStatus(purchase.id, "canceled");
  }
  return NextResponse.json({ ok: true });
}

export const POST = handle;
export const GET = handle;
