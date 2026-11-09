import type { Feature } from "@/lib/db/types";

/**
 * Produtos pagos e preços (definidos pelo dono): chat R$ 5/mês,
 * personalização R$ 1, mudança R$ 5. Para mudar, ajuste aqui. O valor
 * cobrado no Mercado Pago sai daqui. Quando o gateway for escolhido, ele cobra o valor daqui e,
 * ao confirmar o pagamento, chama grantEntitlement com estes dados.
 */
export const PRODUCTS = {
  chat_mensal: {
    feature: "chat" as Feature,
    label: "Chat da cidade (30 dias)",
    description: "Converse com os vizinhos da sua cidade por 30 dias.",
    priceCents: 500,
    days: 30,
    credits: 0,
  },
  personalizar: {
    feature: "customize" as Feature,
    label: "Pintura",
    description: "1 pintura: cores, modelo pronto e bandeira para a sua casa (ou, se você for prefeito, uma proposta de pintura da prefeitura). Teste à vontade na prévia: só conta quando você salva.",
    priceCents: 100,
    days: undefined,
    credits: 1,
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

// O pagamento online liga sozinho quando MP_ACCESS_TOKEN está configurado
// na Vercel (ver src/lib/payments/mercadopago.ts). Sem ele, o botão de
// comprar pede para falar com a equipe e o admin libera manualmente.
