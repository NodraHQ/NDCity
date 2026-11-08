import { NextResponse } from "next/server";
import { isProductId, PAYMENTS_ENABLED, PRODUCTS } from "@/lib/payments/products";
import { currentResident } from "@/lib/resident";

/**
 * Início de uma compra. Enquanto o gateway não for escolhido, devolve uma
 * instrução para falar com o perfil; o admin libera manualmente.
 * Com o gateway: criar a cobrança aqui e devolver o link/QR do Pix.
 */
export async function POST(req: Request) {
  const r = await currentResident();
  if (!r) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const pid: unknown = body?.product;
  if (!isProductId(pid)) return NextResponse.json({ ok: false, message: "Produto inválido." }, { status: 400 });
  const product = PRODUCTS[pid];
  if (!PAYMENTS_ENABLED) {
    return NextResponse.json({
      ok: false,
      pending: true,
      message: `O pagamento online chega em breve! Por enquanto, fale com a equipe do NDCity pedindo “${product.label}” que a gente libera.`,
    });
  }
  return NextResponse.json({ ok: false, message: "Gateway ainda não configurado." }, { status: 501 });
}
