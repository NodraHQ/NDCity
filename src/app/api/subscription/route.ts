import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { canSell } from "@/lib/payments/limit";
import { createPreapproval, mercadoPagoConfigured } from "@/lib/payments/mercadopago";
import { PRODUCTS } from "@/lib/payments/products";
import { syncSubscription } from "@/lib/payments/subscriptions";
import { rateLimit } from "@/lib/rate-limit";
import { currentResident } from "@/lib/resident";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

/** Começa a assinatura mensal do chat (cartão, renova sozinha, cancelável). */
export async function POST(req: Request) {
  const r = await currentResident();
  if (!r) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  if (!mercadoPagoConfigured()) return NextResponse.json({ ok: false, message: "Assinatura ainda não disponível." }, { status: 503 });
  if (!rateLimit(`sub:${r.handle}`, 5, 10 * 60_000))
    return NextResponse.json({ ok: false, message: "Muitas tentativas. Espere uns minutos." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, message: "Digite o e-mail da sua conta do Mercado Pago." }, { status: 400 });

  const store = getStore();
  const live = await store.getLiveSubscription(r.handle);
  if (live && live.status !== "pending")
    return NextResponse.json({ ok: false, message: "Você já tem uma assinatura do chat. Para mudar, cancele a atual pelo menu." });
  if (live) await store.setSubscriptionStatus(live.id, "cancelled"); // tentativa antiga não concluída
  const product = PRODUCTS.chat_mensal;
  if (!(await canSell(product.priceCents)))
    return NextResponse.json({ ok: false, message: "As vendas estão pausadas neste mês 🙏 Elas voltam no dia 1º do mês que vem." });

  const sub = await store.createSubscription({ handle: r.handle, product: "chat_mensal", payerEmail: email });
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const returnPath = typeof body?.returnPath === "string" && /^\/[\w\-/]*$/.test(body.returnPath) ? body.returnPath : "/";
    const { preapprovalId, url } = await createPreapproval({
      subscriptionId: sub.id,
      email,
      title: "NDCity · Chat da cidade (mensal)",
      amountCents: product.priceCents,
      siteUrl: site,
      returnPath,
    });
    await store.setSubscriptionPreapproval(sub.id, preapprovalId);
    await audit({ actor: r.handle, action: "assinatura_iniciada", handle: r.handle, details: { valor: product.priceCents / 100 } });
    return NextResponse.json({ ok: true, url, subscriptionId: sub.id });
  } catch (e) {
    console.error("assinatura falhou", e);
    await store.setSubscriptionStatus(sub.id, "cancelled");
    const msg = String(e).includes("different site") || String(e).includes("real or test users")
      ? "O Mercado Pago não aceitou esse e-mail. Use o e-mail da sua conta do Mercado Pago."
      : "Não consegui abrir a assinatura agora. Tente de novo em instantes.";
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}

/** Situação da assinatura (e confere no Mercado Pago, sem pressa). */
export async function GET() {
  const r = await currentResident();
  if (!r) return NextResponse.json({ ok: false }, { status: 401 });
  const store = getStore();
  let sub = await store.getLiveSubscription(r.handle);
  if (sub && mercadoPagoConfigured() && rateLimit(`subsync:${sub.id}`, 1, 4000)) {
    try {
      sub = await syncSubscription(sub);
    } catch (e) {
      console.error("conferência da assinatura falhou", e);
    }
  }
  const perks = (await import("@/lib/resident")).perksFrom(await store.getEntitlements(r.handle));
  return NextResponse.json({ ok: true, subscription: sub ? { id: sub.id, status: sub.status } : null, chatUntil: perks.chatUntil });
}
