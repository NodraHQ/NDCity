/** Normaliza um @ do Instagram: tira o @, espaços e deixa minúsculo. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Regras do Instagram: letras, números, ponto e sublinhado, até 30. */
export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(handle);
}
