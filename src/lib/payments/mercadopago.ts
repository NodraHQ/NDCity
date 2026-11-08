import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Mercado Pago (Checkout Pro), falando direto com a API, sem biblioteca.
 *
 * Variáveis na Vercel:
 *   MP_ACCESS_TOKEN    Access Token (o de produção começa com APP_USR-)
 *   MP_WEBHOOK_SECRET  chave secreta do aviso de pagamento (opcional, mas recomendada)
 */
const API = process.env.MP_API_BASE || "https://api.mercadopago.com";

export function mercadoPagoConfigured() {
  return !!process.env.MP_ACCESS_TOKEN;
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${JSON.stringify(json)?.slice(0, 300)}`);
  return json as T;
}

/** Cria a tela de pagamento. Só Pix (e saldo do Mercado Pago), pagamento à vista, expira em 30 min. */
export async function createCheckout(opts: {
  purchaseId: string;
  title: string;
  amountCents: number;
  siteUrl: string;
  returnPath: string;
}) {
  const back = (status: string) => `${opts.siteUrl}${opts.returnPath}?pagamento=${status}`;
  const pref = await mp<{ id: string; init_point: string; sandbox_init_point: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": opts.purchaseId },
    body: JSON.stringify({
      items: [{ id: opts.purchaseId, title: opts.title, quantity: 1, unit_price: opts.amountCents / 100, currency_id: "BRL" }],
      external_reference: opts.purchaseId,
      notification_url: `${opts.siteUrl}/api/payments/webhook`,
      back_urls: { success: back("ok"), pending: back("pendente"), failure: back("falhou") },
      // volta sozinho para o site depois de pagar (o Mercado Pago só aceita endereço https)
      ...(opts.siteUrl.startsWith("https://") ? { auto_return: "approved" } : {}),
      statement_descriptor: "NDCITY",
      payment_methods: {
        excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }, { id: "prepaid_card" }, { id: "atm" }],
        installments: 1,
      },
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60_000).toISOString(),
    }),
  });
  const testMode = process.env.MP_ACCESS_TOKEN?.startsWith("TEST-");
  return { checkoutId: pref.id, url: testMode ? pref.sandbox_init_point : pref.init_point };
}

export type MpPayment = {
  id: number;
  status: string; // approved, pending, rejected, refunded, charged_back, cancelled…
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  live_mode: boolean;
};

export function getPayment(id: string) {
  return mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

/** Pagamentos feitos para uma compra (pelo número da compra). */
export async function searchPaymentsByReference(reference: string) {
  const r = await mp<{ results: MpPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc`,
  );
  return r.results ?? [];
}

/**
 * Confere a assinatura do aviso (cabeçalho x-signature: "ts=...,v1=...").
 * Sem MP_WEBHOOK_SECRET configurado, devolve "sem chave": mesmo assim o site
 * nunca confia no aviso e sempre confirma o pagamento direto na API.
 */
export function checkSignature(req: Request, dataId: string): "ok" | "invalida" | "sem chave" {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return "sem chave";
  const header = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return "invalida";
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "invalida";
}
