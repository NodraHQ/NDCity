/** Normaliza um nome de usuário: tira o @ e espaços e deixa minúsculo. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Nomes que já existem (inclusive os antigos, até 30 caracteres). */
export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(handle);
}

/** Regra para contas novas: 3 a 20 caracteres, letras, números, ponto e _. */
export function isValidNewUsername(handle: string): boolean {
  return /^[a-z0-9._]{3,20}$/.test(handle) && !/^[._]|[._]$|\.\./.test(handle);
}
