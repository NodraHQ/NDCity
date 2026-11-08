import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { monthUsage } from "@/lib/payments/limit";
import { mercadoPagoConfigured } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";
const denied = () => NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });

/** Limite mensal de vendas + quanto já foi vendido no mês. */
export async function GET() {
  if (!(await isAdmin())) return denied();
  const usage = await monthUsage();
  return NextResponse.json({
    ok: true,
    ...usage,
    mercadoPago: mercadoPagoConfigured(),
    testMode: process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") ?? false,
    webhookSecret: !!process.env.MP_WEBHOOK_SECRET,
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return denied();
  const body = await req.json().catch(() => null);
  const reais = Number(body?.capReais);
  if (!(reais >= 0 && reais <= 1_000_000)) return NextResponse.json({ ok: false, message: "Valor inválido." }, { status: 400 });
  const cents = Math.round(reais * 100);
  await getStore().setSetting("monthly_cap_cents", cents);
  await audit({ actor: "admin", action: "limite_alterado", details: { valor: reais } });
  return NextResponse.json({ ok: true, capCents: cents });
}
