import "server-only";
import { audit } from "@/lib/audit";
import { generateLoginCode, LOGIN_CODE_HOURS } from "@/lib/codes";
import { getStore } from "@/lib/db";

/** Código de acesso (uso único, 24h) para quem esqueceu a senha. */
async function issueLoginCode(handle: string) {
  const store = getStore();
  const expiresAt = new Date(Date.now() + LOGIN_CODE_HOURS * 3600_000).toISOString();
  for (let i = 0; i < 5; i++) {
    const code = generateLoginCode();
    try {
      await store.createLoginCode(code, handle, expiresAt, "admin");
      await audit({ actor: "admin", action: "codigo_acesso", handle });
      return { code, expiresAt };
    } catch {
      // código repetido (muito raro): tenta outro
    }
  }
  throw new Error("não consegui gerar o código de acesso");
}

/** Admin gera o código de acesso + a mensagem pronta para mandar à pessoa. */
export async function codeForHandle(handle: string, siteUrl: string) {
  const store = getStore();
  const exists = (await store.getPasswordHash(handle)) || (await store.findClaimByHandle(handle));
  if (!exists) return { kind: "sem_conta" as const, code: null, expiresAt: null, message: "" };
  const { code, expiresAt } = await issueLoginCode(handle);
  return {
    kind: "acesso" as const,
    code,
    expiresAt,
    message: `Seu código de acesso do NDCity: ${code}\nEntre em ${siteUrl}, toque em “Entrar”, digite seu usuário e use este código no lugar da senha. Vale por 24h e só uma vez. Depois crie uma senha nova no menu.`,
  };
}
