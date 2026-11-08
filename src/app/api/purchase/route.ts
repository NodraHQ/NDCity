import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { canSell } from "@/lib/payments/limit";
import { createCheckout, mercadoPagoConfigured } from "@/lib/payments/mercadopago";
import { isProductId, PRODUCTS } from "@/lib/payments/products";
import { rateLimit } from "@/lib/rate-limit";
import { currentResident } from "@/lib/resident";

/**
 * Começa uma compra: cria a compra "pendente" e devolve o link do Mercado
 * Pago. O recurso só é liberado quando o Mercado Pago confirma o pagamento
 * (ver /api/payments/webhook).
 */
export async function POST(req: Request) {
  const r = await currentResident();
  if (!r) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const pid: unknown = body?.product;
  if (!isProductId(pid)) return NextResponse.json({ ok: false, message: "Produto inválido." }, { status: 400 });
  const product = PRODUCTS[pid];

  if (!mercadoPagoConfigured())
    return NextResponse.json({
      ok: false,
      pending: true,
      message: `O pagamento online chega em breve! Por enquanto, fale com a equipe do NDCity pedindo “${product.label}” que a gente libera.`,
    });
  if (!rateLimit(`purchase:${r.handle}`, 6, 10 * 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere uns minutos." }, { status: 429 });
  if (!(await canSell(product.priceCents)))
    return NextResponse.json({
      ok: false,
      pending: true,
      message: "As vendas estão pausadas neste mês 🙏 Elas voltam no dia 1º do mês que vem.",
    });

  const store = getStore();
  const purchase = await store.createPendingPurchase({ handle: r.handle, product: pid, amountCents: product.priceCents, provider: "mercadopago" });
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const returnPath = typeof body?.returnPath === "string" && /^\/[\w\-/]*$/.test(body.returnPath) ? body.returnPath : "/";
    const { checkoutId, url } = await createCheckout({
      purchaseId: purchase.id,
      title: `NDCity · ${product.label}`,
      amountCents: product.priceCents,
      siteUrl: site,
      returnPath,
    });
    await store.setPurchaseCheckout(purchase.id, checkoutId);
    await audit({ actor: r.handle, action: "compra_iniciada", handle: r.handle, details: { produto: product.label, valor: product.priceCents / 100 } });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("checkout falhou", e);
    await store.setPurchaseStatus(purchase.id, "canceled");
    return NextResponse.json({ ok: false, message: "Não consegui abrir o pagamento agora. Tente de novo em instantes." }, { status: 502 });
  }
}
