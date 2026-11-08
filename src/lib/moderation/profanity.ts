/**
 * Filtro simples de palavrões para o chat. Troca a palavra por asteriscos.
 * Pega variações com acento, maiúsculas e letras repetidas ("porraaa").
 */
const WORDS = [
  "porra", "caralho", "merda", "bosta", "puta", "puto", "putaria", "fdp", "foda", "foder", "fodase",
  "cu", "cuzao", "arrombado", "arrombada", "buceta", "boceta", "piroca", "xoxota",
  "viado", "sapatao", "traveco", "crioulo", "retardado",
  "vagabunda", "vagabundo", "vadia", "piranha", "corno", "otario", "babaca", "escroto", "escrota",
  "desgracado", "desgracada", "cacete", "punheta", "siririca", "pqp", "vsf", "tnc", "krl", "prr",
];

const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/(.)\1+/g, "$1");

const BAD = new Set(WORDS.map(normalize));

export function cleanMessage(text: string): string {
  return text.replace(/[\p{L}\p{N}@]+/gu, (word) => {
    const n = normalize(word);
    return BAD.has(n) || BAD.has(n.replace(/s$/, "")) ? "*".repeat(word.length) : word;
  });
}
