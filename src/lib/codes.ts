import { randomInt } from "crypto";

/**
 * Gera um código de resgate tipo "NDC-7KQ2-M9XP".
 * Sem letras que confundem (0/O, 1/I/L).
 *
 * Esta é a mesma função que o futuro bot do Instagram vai chamar
 * para mandar o código por DM automaticamente.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCode(): string {
  const part = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `NDC-${part()}-${part()}`;
}

/** Aceita o código digitado de qualquer jeito (minúsculo, sem traço...). */
export function normalizeCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = clean.startsWith("NDC") ? clean.slice(3) : clean;
  if (body.length !== 8) return raw.trim().toUpperCase();
  return `NDC-${body.slice(0, 4)}-${body.slice(4)}`;
}
