import "server-only";
import { getStore } from "@/lib/db";

/**
 * Limite mensal de vendas (proteção para quem recebe no CPF).
 * Quando o total do mês chega no limite, o botão de comprar para sozinho
 * até o dia 1º do mês seguinte. O valor é editado no admin.
 */
export const DEFAULT_CAP_CENTS = 200_000; // R$ 2.000

const brMonth = (d: Date | string) => new Date(new Date(d).getTime() - 3 * 3600_000).toISOString().slice(0, 7);

export async function getMonthlyCap(): Promise<number> {
  const v = await getStore().getSetting<number>("monthly_cap_cents");
  return typeof v === "number" && v >= 0 ? v : DEFAULT_CAP_CENTS;
}

/** Vendido no mês (pago) + reservado (compras abertas há menos de 40 min, ainda sem pagar). */
export async function monthUsage() {
  const purchases = await getStore().listPurchases();
  const month = brMonth(new Date());
  const recent = Date.now() - 40 * 60_000;
  let paid = 0;
  let reserved = 0;
  for (const p of purchases) {
    if (brMonth(p.createdAt) !== month) continue;
    if (p.status === "paid" && p.provider !== "cortesia") paid += p.amountCents;
    else if (p.status === "pending" && Date.parse(p.createdAt) > recent) reserved += p.amountCents;
  }
  const cap = await getMonthlyCap();
  return { paidCents: paid, reservedCents: reserved, capCents: cap, month };
}

/** Pode vender mais este valor sem passar do limite? */
export async function canSell(amountCents: number) {
  const u = await monthUsage();
  return u.paidCents + u.reservedCents + amountCents <= u.capCents;
}
