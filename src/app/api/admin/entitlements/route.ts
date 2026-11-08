import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/db";
import { normalizeHandle } from "@/lib/handle";
import { isProductId, PRODUCTS } from "@/lib/payments/products";
import { perksFrom } from "@/lib/resident";

/** Liberar recurso pago manualmente (enquanto não há gateway). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const handle = normalizeHandle(String(body?.handle ?? ""));
  const pid: unknown = body?.product;
  if (!handle || !isProductId(pid))
    return NextResponse.json({ ok: false, message: "Preencha o @ e o produto." }, { status: 400 });
  const p = PRODUCTS[pid];
  const store = getStore();
  await store.grantEntitlement(handle, p.feature, { days: p.days, credits: p.credits });
  const perks = perksFrom(await store.getEntitlements(handle));
  return NextResponse.json({ ok: true, message: `Liberado “${p.label}” para @${handle}.`, perks });
}

/** Ver o que um @ tem liberado. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  const handle = normalizeHandle(new URL(req.url).searchParams.get("handle") ?? "");
  return NextResponse.json({ ok: true, perks: perksFrom(await getStore().getEntitlements(handle)) });
}
