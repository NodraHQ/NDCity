import type { Feature } from "@/lib/db/types";

/**
 * Produtos pagos. Os preços são provisórios (exceto a mudança, R$ 5):
 * ajuste aqui. Quando o gateway for escolhido, ele cobra o valor daqui e,
 * ao confirmar o pagamento, chama grantEntitlement com estes dados.
 */
export const PRODUCTS = {
  chat_mensal: {
    feature: "chat" as Feature,
    label: "Chat da cidade (30 dias)",
    description: "Converse com os vizinhos da sua cidade por 30 dias.",
    priceCents: 990,
    days: 30,
    credits: 0,
  },
  personalizar: {
    feature: "customize" as Feature,
    label: "Personalização",
    description: "Escolha as cores da sua casa (e da prefeitura, se você for prefeito). Para sempre.",
    priceCents: 990,
    days: undefined,
    credits: 0,
  },
  mudanca: {
    feature: "move" as Feature,
    label: "Caminhão de mudança",
    description: "Leve sua casa para outra cidade. Se a cidade estiver vazia, você vira prefeito!",
    priceCents: 500,
    days: undefined,
    credits: 1,
  },
} as const;

export type ProductId = keyof typeof PRODUCTS;

export function isProductId(v: unknown): v is ProductId {
  return typeof v === "string" && v in PRODUCTS;
}

export const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Enquanto não há gateway, a compra é liberada manualmente pelo admin. */
export const PAYMENTS_ENABLED = false;
