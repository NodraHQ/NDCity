import "server-only";
import { audit } from "@/lib/audit";
import { generateCode, generateLoginCode, LOGIN_CODE_HOURS } from "@/lib/codes";
import { getStore } from "@/lib/db";

/**
 * Entrega de códigos, usada pelo admin e pela ferramenta de DM (bot):
 * - quem ainda não tem casa recebe um código de RESGATE (NDC-…);
 * - quem já tem casa recebe um código de ACESSO (ENT-…), que vale uma vez
 *   e expira em 24h. Serve para quem esqueceu a senha ou trocou de celular.
 */
export async function issueLoginCode(handle: string, source: "admin" | "bot") {
  const store = getStore();
  const expiresAt = new Date(Date.now() + LOGIN_CODE_HOURS * 3600_000).toISOString();
  for (let i = 0; i < 5; i++) {
    const code = generateLoginCode();
    try {
      await store.createLoginCode(code, handle, expiresAt, source);
      await audit({ actor: source === "admin" ? "admin" : "sistema", action: "codigo_acesso", handle, details: { origem: source } });
      return { code, expiresAt };
    } catch {
      // código repetido (muito raro): tenta outro
    }
  }
  throw new Error("não consegui gerar o código de acesso");
}

export async function issueClaimCode(handle: string, source: "admin" | "bot") {
  const store = getStore();
  // se já tem um código de resgate esperando, reaproveita (evita spam de códigos)
  const waiting = (await store.listCodes(500)).find((c) => c.instagramHandle === handle && !c.usedAt);
  if (waiting) return { code: waiting.code, reused: true };
  for (let i = 0; i < 5; i++) {
    try {
      const c = await store.createCode(generateCode(), handle);
      await audit({ actor: source === "admin" ? "admin" : "sistema", action: "codigo_gerado", handle, details: { codigo: c.code, origem: source } });
      return { code: c.code, reused: false };
    } catch {
      // repetido: tenta outro
    }
  }
  throw new Error("não consegui gerar o código");
}

/** O código certo para cada pessoa + a mensagem pronta para a DM. */
export async function codeForHandle(handle: string, source: "admin" | "bot", siteUrl: string) {
  const house = await getStore().findClaimByHandle(handle);
  if (house) {
    const { code, expiresAt } = await issueLoginCode(handle, source);
    return {
      kind: "acesso" as const,
      code,
      expiresAt,
      message: `Seu código de acesso do NDCity: ${code}\nEntre em ${siteUrl}, toque em “Já tenho casinha” e use seu @ + este código. Vale por ${24}h e só uma vez.`,
    };
  }
  const { code } = await issueClaimCode(handle, source);
  return {
    kind: "resgate" as const,
    code,
    expiresAt: null,
    message: `Seu código do NDCity: ${code}\nResgate sua casinha em ${siteUrl}: escolha sua cidade no mapa e toque em “Resgatar casinha”.`,
  };
}
