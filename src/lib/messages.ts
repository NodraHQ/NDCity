import type { ClaimError } from "@/lib/db/types";

export const CLAIM_ERRORS: Record<ClaimError | "rate_limited" | "bad_request", string> = {
  city_not_found: "Cidade não encontrada.",
  invalid_lot: "Esse lote não existe.",
  lot_taken: "Alguém acabou de pegar esse lote! Escolha outro.",
  handle_has_house: "Você já tem uma casinha. É uma por pessoa!",
  rate_limited: "Muitas tentativas. Espere um minutinho e tente de novo.",
  bad_request: "Pedido inválido.",
};
