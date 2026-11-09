import { randomInt } from "crypto";

/**
 * Código de acesso para quem esqueceu a senha: "ENT-7KQ2-M9XP".
 * Sem letras que confundem (0/O, 1/I/L). Vale uma vez, por 24h.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateLoginCode(): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `ENT-${part()}-${part()}`;
}

/** Normaliza o código digitado de qualquer jeito (ou null se não for um). */
export function normalizeLoginCode(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean.startsWith("ENT") || clean.length !== 11) return null;
  return `ENT-${clean.slice(3, 7)}-${clean.slice(7)}`;
}

export const LOGIN_CODE_HOURS = 24;
