import { randomUUID } from "crypto";
import type {
  ActiveCity,
  City,
  Claim,
  ClaimInput,
  ClaimResult,
  Code,
  Entitlement,
  Message,
  MoveResult,
  Store,
} from "./types";

/**
 * Banco "de mentirinha" que vive na memória do servidor. Serve para
 * testar o site sem o Supabase. Tudo some quando o servidor reinicia,
 * então NÃO use em produção. Imita as funções SQL do Supabase.
 */
type Data = {
  cities: City[];
  claims: Claim[];
  codes: Code[];
  sessions: Map<string, string>;
  entitlements: Entitlement[];
  messages: (Message & { cityId: string })[];
  nextMsg: number;
};

const g = globalThis as unknown as { __cidadezinhaMem?: Data };

function data(): Data {
  g.__cidadezinhaMem ??= {
    cities: [],
    claims: [],
    codes: [],
    sessions: new Map(),
    entitlements: [],
    messages: [],
    nextMsg: 1,
  };
  return g.__cidadezinhaMem;
}

const now = () => new Date().toISOString();

/** Mesma regra do refresh_mayor no banco. */
function refreshMayor(city: City) {
  const d = data();
  const residents = d.claims.filter((c) => c.cityId === city.id);
  if (city.mayorHandle && residents.some((c) => c.instagramHandle === city.mayorHandle)) return;
  const next = residents.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  city.mayorHandle = next?.instagramHandle ?? null;
  city.unlockedAt = next ? (city.unlockedAt ?? now()) : null;
  city.hallStyle = null;
}

export const memoryStore: Store = {
  kind: "memory",

  async getCity(slug) {
    return data().cities.find((c) => c.slug === slug) ?? null;
  },
  async ensureCity(input) {
    const d = data();
    let city = d.cities.find((c) => c.slug === input.slug);
    if (!city) {
      city = {
        id: randomUUID(),
        slug: input.slug,
        name: input.name,
        seed: input.seed,
        uf: input.uf,
        layoutSize: input.layoutSize,
        mayorHandle: null,
        unlockedAt: null,
        hallStyle: null,
      };
      d.cities.push(city);
    }
    return city;
  },
  async listActiveCities() {
    const d = data();
    return d.cities
      .map<ActiveCity>((c) => ({
        slug: c.slug,
        name: c.name,
        mayorHandle: c.mayorHandle,
        houses: d.claims.filter((x) => x.cityId === c.id).length,
      }))
      .filter((c) => c.houses > 0);
  },
  async setHallStyle(cityId, style) {
    const city = data().cities.find((c) => c.id === cityId);
    if (city) city.hallStyle = style;
  },

  async listClaims(cityId) {
    return data().claims.filter((c) => c.cityId === cityId);
  },
  async findClaimByHandle(handle) {
    const d = data();
    const claim = d.claims.find((c) => c.instagramHandle === handle);
    if (!claim) return null;
    return { ...claim, citySlug: d.cities.find((c) => c.id === claim.cityId)?.slug ?? "" };
  },
  async claim(input: ClaimInput): Promise<ClaimResult> {
    const d = data();
    const code = d.codes.find((c) => c.code === input.code);
    if (!code) return { ok: false, error: "code_not_found" };
    if (code.usedAt) return { ok: false, error: "code_used" };
    const city = d.cities.find((c) => c.slug === input.citySlug);
    if (!city) return { ok: false, error: "city_not_found" };
    if (input.lotIndex < 0 || input.lotIndex >= input.lotCount) return { ok: false, error: "invalid_lot" };
    if (d.claims.some((c) => c.instagramHandle === code.instagramHandle)) return { ok: false, error: "handle_has_house" };
    if (d.claims.some((c) => c.cityId === city.id && c.lotIndex === input.lotIndex)) return { ok: false, error: "lot_taken" };
    const claim: Claim = {
      id: randomUUID(),
      cityId: city.id,
      lotIndex: input.lotIndex,
      instagramHandle: code.instagramHandle,
      buildingType: input.buildingType,
      style: null,
      createdAt: now(),
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
  async moveHouse({ handle, citySlug, lotIndex, lotCount }): Promise<MoveResult> {
    const d = data();
    const claim = d.claims.find((c) => c.instagramHandle === handle);
    if (!claim) return { ok: false, error: "no_house" };
    const ent = d.entitlements.find((e) => e.handle === handle && e.feature === "move");
    if (!ent || ent.credits < 1) return { ok: false, error: "no_credit" };
    const city = d.cities.find((c) => c.slug === citySlug);
    if (!city) return { ok: false, error: "city_not_found" };
    if (city.id === claim.cityId) return { ok: false, error: "same_city" };
    if (lotIndex < 0 || lotIndex >= lotCount) return { ok: false, error: "invalid_lot" };
    if (d.claims.some((c) => c.cityId === city.id && c.lotIndex === lotIndex)) return { ok: false, error: "lot_taken" };
    const oldCity = d.cities.find((c) => c.id === claim.cityId);
    claim.cityId = city.id;
    claim.lotIndex = lotIndex;
    claim.createdAt = now();
    ent.credits -= 1;
    if (oldCity) refreshMayor(oldCity);
    let isMayor = false;
    if (!city.mayorHandle) {
      city.mayorHandle = handle;
      city.unlockedAt = now();
      isMayor = true;
    }
    return { ok: true, claim, isMayor };
  },
  async setHouseStyle(handle, style) {
    const claim = data().claims.find((c) => c.instagramHandle === handle);
    if (claim) claim.style = style;
  },
  async removeHouse(handle) {
    const d = data();
    const claim = d.claims.find((c) => c.instagramHandle === handle);
    d.claims = d.claims.filter((c) => c.instagramHandle !== handle);
    d.codes = d.codes.filter((c) => c.instagramHandle !== handle);
    for (const [k, v] of d.sessions) if (v === handle) d.sessions.delete(k);
    for (const city of d.cities) refreshMayor(city);
    return { hadHouse: !!claim };
  },

  async getCode(code) {
    return data().codes.find((c) => c.code === code) ?? null;
  },
  async createCode(code, handle) {
    const c: Code = { code, instagramHandle: handle, createdAt: now(), usedAt: null, claimId: null };
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

  async createSession(tokenHash, handle) {
    data().sessions.set(tokenHash, handle);
  },
  async getSessionHandle(tokenHash) {
    return data().sessions.get(tokenHash) ?? null;
  },
  async deleteSession(tokenHash) {
    data().sessions.delete(tokenHash);
  },

  async getEntitlements(handle) {
    return data().entitlements.filter((e) => e.handle === handle);
  },
  async grantEntitlement(handle, feature, { days, credits }) {
    const d = data();
    let e = d.entitlements.find((x) => x.handle === handle && x.feature === feature);
    if (!e) {
      e = { handle, feature, expiresAt: null, credits: 0 };
      d.entitlements.push(e);
    }
    if (days != null) {
      const base = Math.max(Date.now(), e.expiresAt ? Date.parse(e.expiresAt) : 0);
      e.expiresAt = new Date(base + days * 86400000).toISOString();
    } else {
      e.expiresAt = null;
    }
    e.credits += credits ?? 0;
  },

  async listMessages(cityId, afterId, limit) {
    const msgs = data().messages.filter((m) => m.cityId === cityId && m.id > afterId);
    return msgs.slice(-limit).map(({ cityId: _c, ...m }) => m);
  },
  async addMessage(cityId, handle, body) {
    const d = data();
    const m = { id: d.nextMsg++, cityId, handle, body, createdAt: now() };
    d.messages.push(m);
    if (d.messages.length > 5000) d.messages.shift();
    return { id: m.id, handle, body, createdAt: m.createdAt };
  },
};
