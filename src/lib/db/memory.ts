import { randomUUID } from "crypto";
import type {
  ActiveCity,
  City,
  Claim,
  ClaimInput,
  ClaimResult,
  Code,
  Election,
  Entitlement,
  HallProposal,
  HouseRow,
  LogEntry,
  Message,
  MoveResult,
  OfficeHolder,
  Purchase,
  Store,
  VisitRow,
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
  elections: Election[];
  candidates: { electionId: string; handle: string; createdAt: string }[];
  votes: { electionId: string; voter: string; candidate: string }[];
  offices: OfficeHolder[];
  proposals: HallProposal[];
  hallVotes: { proposalId: string; handle: string; approve: boolean }[];
  logs: LogEntry[];
  accounts: Map<string, string>;
  loginCodes: { code: string; handle: string; expiresAt: string; usedAt: string | null }[];
  visits: VisitRow[];
  purchases: Purchase[];
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
    elections: [],
    candidates: [],
    votes: [],
    offices: [],
    proposals: [],
    hallVotes: [],
    logs: [],
    accounts: new Map(),
    loginCodes: [],
    visits: [],
    purchases: [],
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
  for (const p of d.proposals) if (p.cityId === city.id && p.status === "open") p.status = "canceled";
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
  async claimDirect(input): Promise<ClaimResult> {
    const d = data();
    const city = d.cities.find((c) => c.slug === input.citySlug);
    if (!city) return { ok: false, error: "city_not_found" };
    if (input.lotIndex < 0 || input.lotIndex >= input.lotCount) return { ok: false, error: "invalid_lot" };
    if (d.claims.some((c) => c.instagramHandle === input.handle)) return { ok: false, error: "handle_has_house" };
    if (d.claims.some((c) => c.cityId === city.id && c.lotIndex === input.lotIndex)) return { ok: false, error: "lot_taken" };
    const claim: Claim = {
      id: randomUUID(),
      cityId: city.id,
      lotIndex: input.lotIndex,
      instagramHandle: input.handle,
      buildingType: input.buildingType,
      style: null,
      createdAt: now(),
    };
    d.claims.push(claim);
    let isMayor = false;
    if (!city.mayorHandle) {
      city.mayorHandle = input.handle;
      city.unlockedAt = claim.createdAt;
      isMayor = true;
    }
    return { ok: true, claim, isMayor };
  },
  async moveHouse({ handle, citySlug, lotIndex, lotCount, buildingType }): Promise<MoveResult> {
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
    if (buildingType) claim.buildingType = buildingType;
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
  async listAllHouses() {
    const d = data();
    return d.claims.map<HouseRow>((c) => {
      const city = d.cities.find((x) => x.id === c.cityId)!;
      return {
        handle: c.instagramHandle,
        type: c.buildingType,
        createdAt: c.createdAt,
        citySlug: city.slug,
        cityName: city.name,
        uf: city.uf,
        isMayor: city.mayorHandle === c.instagramHandle,
      };
    });
  },
  async countResidents(cityId) {
    return data().claims.filter((c) => c.cityId === cityId).length;
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
    d.accounts.delete(handle);
    d.loginCodes = d.loginCodes.filter((c) => c.handle !== handle);
    const openE = new Set(d.elections.filter((e) => e.status === "open").map((e) => e.id));
    d.candidates = d.candidates.filter((c) => !(openE.has(c.electionId) && c.handle === handle));
    d.votes = d.votes.filter((v) => !(openE.has(v.electionId) && (v.voter === handle || v.candidate === handle)));
    const openP = new Set(d.proposals.filter((p) => p.status === "open").map((p) => p.id));
    d.hallVotes = d.hallVotes.filter((v) => !(openP.has(v.proposalId) && v.handle === handle));
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

  async createElection(office, uf, endsAt) {
    const e: Election = { id: randomUUID(), office, uf, status: "open", endsAt, winnerHandle: null, createdAt: now() };
    data().elections.unshift(e);
    return e;
  },
  async listElections(status) {
    return data().elections.filter((e) => !status || e.status === status);
  },
  async getElection(id) {
    return data().elections.find((e) => e.id === id) ?? null;
  },
  async updateElection(id, patch) {
    const e = data().elections.find((x) => x.id === id);
    if (!e) return;
    e.status = patch.status;
    if (patch.winnerHandle !== undefined) e.winnerHandle = patch.winnerHandle;
  },
  async addCandidate(electionId, handle) {
    const d = data();
    if (!d.candidates.some((c) => c.electionId === electionId && c.handle === handle))
      d.candidates.push({ electionId, handle, createdAt: now() });
  },
  async removeCandidate(electionId, handle) {
    const d = data();
    d.candidates = d.candidates.filter((c) => !(c.electionId === electionId && c.handle === handle));
    d.votes = d.votes.filter((v) => !(v.electionId === electionId && v.candidate === handle));
  },
  async listCandidates(electionId) {
    return data()
      .candidates.filter((c) => c.electionId === electionId)
      .map(({ handle, createdAt }) => ({ handle, createdAt }));
  },
  async castVote(electionId, voter, candidate) {
    const d = data();
    d.votes = d.votes.filter((v) => !(v.electionId === electionId && v.voter === voter));
    d.votes.push({ electionId, voter, candidate });
  },
  async getVote(electionId, voter) {
    return data().votes.find((v) => v.electionId === electionId && v.voter === voter)?.candidate ?? null;
  },
  async countVotes(electionId) {
    const out: Record<string, number> = {};
    for (const v of data().votes) if (v.electionId === electionId) out[v.candidate] = (out[v.candidate] ?? 0) + 1;
    return out;
  },
  async listOffices() {
    return data().offices;
  },
  async setOffice(office, uf, handle) {
    const d = data();
    d.offices = d.offices.filter((o) => !(o.office === office && o.uf === uf));
    d.offices.push({ office, uf, handle, since: now() });
  },
  async clearOffice(office, uf) {
    const d = data();
    d.offices = d.offices.filter((o) => !(o.office === office && o.uf === uf));
  },

  async getOpenProposal(cityId) {
    return data().proposals.find((p) => p.cityId === cityId && p.status === "open") ?? null;
  },
  async createProposal(cityId, proposer, style, endsAt) {
    const p: HallProposal = { id: randomUUID(), cityId, proposer, style, status: "open", endsAt, createdAt: now() };
    data().proposals.push(p);
    return p;
  },
  async updateProposal(id, status) {
    const p = data().proposals.find((x) => x.id === id);
    if (p) p.status = status;
  },
  async castHallVote(proposalId, handle, approve) {
    const d = data();
    d.hallVotes = d.hallVotes.filter((v) => !(v.proposalId === proposalId && v.handle === handle));
    d.hallVotes.push({ proposalId, handle, approve });
  },
  async getHallVote(proposalId, handle) {
    return data().hallVotes.find((v) => v.proposalId === proposalId && v.handle === handle)?.approve ?? null;
  },
  async countHallVotes(proposalId) {
    let yes = 0;
    let no = 0;
    for (const v of data().hallVotes) if (v.proposalId === proposalId) v.approve ? yes++ : no++;
    return { yes, no };
  },

  async addLog(entry) {
    const d = data();
    d.logs.unshift({
      id: (d.logs[0]?.id ?? 0) + 1,
      createdAt: now(),
      actor: entry.actor,
      action: entry.action,
      handle: entry.handle ?? null,
      citySlug: entry.citySlug ?? null,
      details: entry.details ?? null,
    });
  },
  async listLogs({ limit, beforeId, action, handle }) {
    return data()
      .logs.filter((l) => (!beforeId || l.id < beforeId) && (!action || l.action === action) && (!handle || l.handle === handle || l.actor === handle))
      .slice(0, limit);
  },
  async trackVisit(visitorId, handle, path, view) {
    const d = data();
    const day = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    let v = d.visits.find((x) => x.visitorId === visitorId && x.day === day);
    if (!v) {
      v = { visitorId, day, firstAt: now(), lastAt: now(), views: 0, handle, lastPath: path };
      d.visits.push(v);
    }
    v.lastAt = now();
    v.handle = handle ?? v.handle;
    v.lastPath = path;
    if (view) v.views++;
  },
  async listVisits(sinceDay) {
    return data().visits.filter((v) => v.day >= sinceDay);
  },
  async getPasswordHash(handle) {
    return data().accounts.get(handle) ?? null;
  },
  async setPasswordHash(handle, hash) {
    data().accounts.set(handle, hash);
  },
  async createAccount(handle, hash) {
    const d = data();
    if (d.accounts.has(handle)) return false;
    d.accounts.set(handle, hash);
    return true;
  },
  async createLoginCode(code, handle, expiresAt) {
    data().loginCodes.push({ code, handle, expiresAt, usedAt: null });
  },
  async consumeLoginCode(code, handle) {
    const c = data().loginCodes.find(
      (x) => x.code === code && !x.usedAt && Date.parse(x.expiresAt) > Date.now() && (!handle || x.handle === handle),
    );
    if (!c) return null;
    c.usedAt = now();
    return c.handle;
  },
  async addPurchase(p) {
    data().purchases.unshift({ ...p, id: randomUUID(), createdAt: now() });
  },
  async listPurchases() {
    return data().purchases;
  },
};
