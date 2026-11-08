import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { applyPayment } from "@/lib/payments/fulfill";
import { mercadoPagoConfigured, searchPaymentsByReference } from "@/lib/payments/mercadopago";
import { rateLimit } from "@/lib/rate-limit";
import { currentHandle } from "@/lib/resident";

export const dynamic = "force-dynamic";

/**
 * A tela "aguardando seu Pix" pergunta aqui a cada poucos segundos.
 * Se a compra ainda está pendente, confere direto no Mercado Pago (caso o
 * aviso automático atrase ou falhe) e libera na hora.
 */
export async function GET(req: Request) {
  const handle = await currentHandle();
  if (!handle) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const store = getStore();
  let purchase = await store.getPurchase(id);
  if (!purchase || purchase.handle !== handle) return NextResponse.json({ ok: false }, { status: 404 });

  if (purchase.status === "pending" && mercadoPagoConfigured() && rateLimit(`pstatus:${id}`, 1, 4000)) {
    try {
      for (const payment of await searchPaymentsByReference(purchase.id)) {
        if ((await applyPayment(payment, purchase)) === "pago") break;
      }
      purchase = (await store.getPurchase(id)) ?? purchase;
    } catch (e) {
      console.error("conferência no Mercado Pago falhou", e);
    }
  }
  return NextResponse.json({ ok: true, status: purchase.status });
}
