import { randomUUID } from "crypto";
import { DEFAULT_CITY } from "@/config/site";
import type { City, Claim, ClaimInput, ClaimResult, Code, Store } from "./types";

/**
 * Banco "de mentirinha" que vive na memória do servidor. Serve para
 * testar o site sem configurar o Supabase. Tudo some quando o servidor
 * reinicia, então NÃO use em produção.
 */
type Data = { cities: City[]; claims: Claim[]; codes: Code[] };

const g = globalThis as unknown as { __cidadezinhaMem?: Data };

function data(): Data {
  if (!g.__cidadezinhaMem) {
    g.__cidadezinhaMem = {
      cities: [
        {
          id: "city-1",
          slug: DEFAULT_CITY.slug,
          name: DEFAULT_CITY.name,
          seed: DEFAULT_CITY.seed,
          mayorHandle: null,
          unlockedAt: null,
        },
      ],
      claims: [],
      codes: [],
    };
  }
  return g.__cidadezinhaMem;
}

export const memoryStore: Store = {
  kind: "memory",
  async getCity(slug) {
    return data().cities.find((c) => c.slug === slug) ?? null;
  },
  async listClaims(cityId) {
    return data().claims.filter((c) => c.cityId === cityId);
  },
  async getCode(code) {
    return data().codes.find((c) => c.code === code) ?? null;
  },
  async findClaimByHandle(handle) {
    return data().claims.find((c) => c.instagramHandle === handle) ?? null;
  },
  async claim(input: ClaimInput): Promise<ClaimResult> {
    const d = data();
    const code = d.codes.find((c) => c.code === input.code);
    if (!code) return { ok: false, error: "code_not_found" };
    if (code.usedAt) return { ok: false, error: "code_used" };
    const city = d.cities.find((c) => c.slug === input.citySlug);
    if (!city) return { ok: false, error: "city_not_found" };
    if (input.lotIndex < 0 || input.lotIndex >= input.lotCount) return { ok: false, error: "invalid_lot" };
    if (d.claims.some((c) => c.instagramHandle === code.instagramHandle))
      return { ok: false, error: "handle_has_house" };
    if (d.claims.some((c) => c.cityId === city.id && c.lotIndex === input.lotIndex))
      return { ok: false, error: "lot_taken" };
    const claim: Claim = {
      id: randomUUID(),
      cityId: city.id,
      lotIndex: input.lotIndex,
      instagramHandle: code.instagramHandle,
      buildingType: input.buildingType,
      createdAt: new Date().toISOString(),
    };
    d.claims.push(claim);
    code.usedAt = claim.createdAt;
    code.claimId = claim.id;
    let isMayor = false;
    if (!city.mayorHandle) {
      city.mayorHandle = code.instagramHandle;
      city.unlockedAt = claim.createdAt;
      isMayor = true;
    }
    return { ok: true, claim, isMayor };
  },
  async createCode(code, handle) {
    const c: Code = { code, instagramHandle: handle, createdAt: new Date().toISOString(), usedAt: null, claimId: null };
    data().codes.unshift(c);
    return c;
  },
  async listCodes(limit = 200) {
    return data().codes.slice(0, limit);
  },
  async deleteCode(code) {
    const d = data();
    d.codes = d.codes.filter((c) => c.code !== code || c.usedAt);
  },
  async deleteClaim(id) {
    const d = data();
    d.claims = d.claims.filter((c) => c.id !== id);
  },
};
