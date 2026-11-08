/**
 * Configurações gerais do site.
 *
 * Hoje existe uma cidade só. Quando o mapa-múndi chegar, cada cidade
 * vai morar na tabela `cities` do banco e esta constante passa a ser
 * apenas a cidade "padrão" mostrada na página inicial.
 */
export const SITE_NAME = "Cidadezinha";

export const DEFAULT_CITY = {
  slug: "cidadezinha",
  name: "Cidadezinha",
  seed: "cidadezinha",
};

export const INSTAGRAM_PROFILE = process.env.NEXT_PUBLIC_INSTAGRAM_PROFILE ?? "";
