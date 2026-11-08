import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BuildingType } from "@/lib/buildings";
import type { Style } from "@/lib/styles";
import type {
  City,
  Claim,
  ClaimResult,
  Code,
  Election,
  Entitlement,
  Feature,
  HallProposal,
  HouseRow,
  LogEntry,
  Message,
  MoveResult,
  Office,
  Purchase,
  Store,
  VisitRow,
} from "./types";

/**
 * Acesso ao Supabase. Só roda no servidor, com a chave secreta.
 * As tabelas têm RLS ligado e nenhuma política pública, então ninguém
 * consegue mexer no banco direto pelo navegador.
 */
let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

type CityRow = {
  id: string;
  slug: string;
  name: string;
  seed: string;
  uf: string | null;
  layout_size: number;
  mayor_handle: string | null;
  unlocked_at: string | null;
  hall_style: Style | null;
};
type ClaimRow = {
  id: string;
  city_id: string;
  lot_index: number;
  instagram_handle: string;
  building_type: string;
  style: Style | null;
  created_at: string;
};
type CodeRow = { code: string; instagram_handle: string; created_at: string; used_at: string | null; claim_id: string | null };

const toCity = (r: CityRow): City => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  seed: r.seed,
  uf: r.uf,
  layoutSize: r.layout_size ?? 22,
  mayorHandle: r.mayor_handle,
  unlockedAt: r.unlocked_at,
  hallStyle: r.hall_style ?? null,
});
const toClaim = (r: ClaimRow): Claim => ({
  id: r.id,
  cityId: r.city_id,
  lotIndex: r.lot_index,
  instagramHandle: r.instagram_handle,
  buildingType: r.building_type as BuildingType,
  style: r.style ?? null,
  createdAt: r.created_at,
});
const toCode = (r: CodeRow): Code => ({
  code: r.code,
  instagramHandle: r.instagram_handle,
  createdAt: r.created_at,
  usedAt: r.used_at,
  claimId: r.claim_id,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export const supabaseStore: Store = {
  kind: "supabase",

  async getCity(slug) {
    const row = check(await db().from("cities").select("*").eq("slug", slug).maybeSingle());
    return row ? toCity(row as CityRow) : null;
  },
  async ensureCity(c) {
    check(
      await db()
        .from("cities")
        .upsert(
          {
            slug: c.slug,
            name: c.name,
            seed: c.seed,
            uf: c.uf,
            ibge_code: c.ibgeCode,
            lat: c.lat,
            lng: c.lng,
            timezone: c.timezone,
            layout_size: c.layoutSize,
          },
          { onConflict: "slug", ignoreDuplicates: true },
        ),
    );
    return (await this.getCity(c.slug))!;
  },
  async listActiveCities() {
    const cities = check(await db().from("cities").select("id, slug, name, mayor_handle").not("mayor_handle", "is", null)) as {
      id: string;
      slug: string;
      name: string;
      mayor_handle: string;
    }[];
    if (!cities.length) return [];
    const claims = check(await db().from("claims").select("city_id")) as { city_id: string }[];
    const counts = new Map<string, number>();
    for (const c of claims) counts.set(c.city_id, (counts.get(c.city_id) ?? 0) + 1);
    return cities
      .map((c) => ({ slug: c.slug, name: c.name, mayorHandle: c.mayor_handle, houses: counts.get(c.id) ?? 0 }))
      .filter((c) => c.houses > 0);
  },
  async setHallStyle(cityId, style) {
    check(await db().from("cities").update({ hall_style: style }).eq("id", cityId));
  },

  async listClaims(cityId) {
    const rows = check(await db().from("claims").select("*").eq("city_id", cityId));
    return (rows as ClaimRow[]).map(toClaim);
  },
  async findClaimByHandle(handle) {
    const row = check(await db().from("claims").select("*, cities(slug)").eq("instagram_handle", handle).maybeSingle()) as
      | (ClaimRow & { cities: { slug: string } | null })
      | null;
    return row ? { ...toClaim(row), citySlug: row.cities?.slug ?? "" } : null;
  },
  async claim(input): Promise<ClaimResult> {
    const res = check(
      await db().rpc("claim_house", {
        p_code: input.code,
        p_city_slug: input.citySlug,
        p_lot_index: input.lotIndex,
        p_lot_count: input.lotCount,
        p_building: input.buildingType,
      }),
    ) as { ok: boolean; error?: string; claim?: ClaimRow; is_mayor?: boolean };
    if (!res.ok || !res.claim) return { ok: false, error: (res.error ?? "code_not_found") as never };
    return { ok: true, claim: toClaim(res.claim), isMayor: !!res.is_mayor };
  },
  async moveHouse({ handle, citySlug, lotIndex, lotCount, buildingType }): Promise<MoveResult> {
    const res = check(
      await db().rpc("move_house", {
        p_handle: handle,
        p_city_slug: citySlug,
        p_lot_index: lotIndex,
        p_lot_count: lotCount,
        p_building: buildingType,
      }),
    ) as { ok: boolean; error?: string; claim?: ClaimRow; is_mayor?: boolean };
    if (!res.ok || !res.claim) return { ok: false, error: (res.error ?? "no_house") as never };
    return { ok: true, claim: toClaim(res.claim), isMayor: !!res.is_mayor };
  },
  async listAllHouses() {
    const rows = check(
      await db().from("claims").select("instagram_handle, building_type, created_at, cities(slug, name, uf, mayor_handle)").limit(20000),
    ) as unknown as {
      instagram_handle: string;
      building_type: string;
      created_at: string;
      cities: { slug: string; name: string; uf: string | null; mayor_handle: string | null } | null;
    }[];
    return rows.map<HouseRow>((r) => ({
      handle: r.instagram_handle,
      type: r.building_type as BuildingType,
      createdAt: r.created_at,
      citySlug: r.cities?.slug ?? "",
      cityName: r.cities?.name ?? "",
      uf: r.cities?.uf ?? null,
      isMayor: r.cities?.mayor_handle === r.instagram_handle,
    }));
  },
  async countResidents(cityId) {
    const res = await db().from("claims").select("id", { count: "exact", head: true }).eq("city_id", cityId);
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.count ?? 0;
  },
  async setHouseStyle(handle, style) {
    check(await db().from("claims").update({ style }).eq("instagram_handle", handle));
  },
  async removeHouse(handle) {
    const res = check(await db().rpc("remove_house", { p_handle: handle })) as { had_house?: boolean };
    return { hadHouse: !!res.had_house };
  },

  async getCode(code) {
    const row = check(await db().from("codes").select("*").eq("code", code).maybeSingle());
    return row ? toCode(row as CodeRow) : null;
  },
  async createCode(code, handle) {
    const row = check(await db().from("codes").insert({ code, instagram_handle: handle }).select("*").single());
    return toCode(row as CodeRow);
  },
  async listCodes(limit = 200) {
    const rows = check(await db().from("codes").select("*").order("created_at", { ascending: false }).limit(limit));
    return (rows as CodeRow[]).map(toCode);
  },
  async deleteCode(code) {
    check(await db().from("codes").delete().eq("code", code).is("used_at", null));
  },

  async createSession(tokenHash, handle) {
    check(await db().from("sessions").insert({ token_hash: tokenHash, handle }));
  },
  async getSessionHandle(tokenHash) {
    const row = check(await db().from("sessions").select("handle").eq("token_hash", tokenHash).maybeSingle()) as {
      handle: string;
    } | null;
    return row?.handle ?? null;
  },
  async deleteSession(tokenHash) {
    check(await db().from("sessions").delete().eq("token_hash", tokenHash));
  },

  async getEntitlements(handle) {
    const rows = check(await db().from("entitlements").select("*").eq("handle", handle)) as {
      handle: string;
      feature: Feature;
      expires_at: string | null;
      credits: number;
    }[];
    return rows.map<Entitlement>((r) => ({ handle: r.handle, feature: r.feature, expiresAt: r.expires_at, credits: r.credits }));
  },
  async grantEntitlement(handle, feature, { days, credits }) {
    check(await db().rpc("grant_entitlement", { p_handle: handle, p_feature: feature, p_days: days ?? null, p_credits: credits ?? 0 }));
  },

  async listMessages(cityId, afterId, limit) {
    const rows = check(
      await db()
        .from("messages")
        .select("id, handle, body, created_at")
        .eq("city_id", cityId)
        .gt("id", afterId)
        .order("id", { ascending: false })
        .limit(limit),
    ) as { id: number; handle: string; body: string; created_at: string }[];
    return rows.reverse().map<Message>((r) => ({ id: r.id, handle: r.handle, body: r.body, createdAt: r.created_at }));
  },
  async addMessage(cityId, handle, body) {
    const r = check(
      await db().from("messages").insert({ city_id: cityId, handle, body }).select("id, handle, body, created_at").single(),
    ) as { id: number; handle: string; body: string; created_at: string };
    return { id: r.id, handle: r.handle, body: r.body, createdAt: r.created_at };
  },

  async createElection(office, uf, endsAt) {
    const r = check(await db().from("elections").insert({ office, uf, ends_at: endsAt }).select("*").single()) as ElectionRow;
    return toElection(r);
  },
  async listElections(status) {
    let q = db().from("elections").select("*").order("created_at", { ascending: false }).limit(200);
    if (status) q = q.eq("status", status);
    return (check(await q) as ElectionRow[]).map(toElection);
  },
  async getElection(id) {
    const r = check(await db().from("elections").select("*").eq("id", id).maybeSingle()) as ElectionRow | null;
    return r ? toElection(r) : null;
  },
  async updateElection(id, patch) {
    const upd: Record<string, unknown> = { status: patch.status };
    if (patch.status !== "open") upd.closed_at = new Date().toISOString();
    if (patch.winnerHandle !== undefined) upd.winner_handle = patch.winnerHandle;
    check(await db().from("elections").update(upd).eq("id", id));
  },
  async addCandidate(electionId, handle) {
    check(await db().from("election_candidates").upsert({ election_id: electionId, handle }, { ignoreDuplicates: true }));
  },
  async removeCandidate(electionId, handle) {
    check(await db().from("election_candidates").delete().eq("election_id", electionId).eq("handle", handle));
    check(await db().from("election_votes").delete().eq("election_id", electionId).eq("candidate", handle));
  },
  async listCandidates(electionId) {
    const rows = check(await db().from("election_candidates").select("handle, created_at").eq("election_id", electionId)) as {
      handle: string;
      created_at: string;
    }[];
    return rows.map((r) => ({ handle: r.handle, createdAt: r.created_at }));
  },
  async castVote(electionId, voter, candidate) {
    check(await db().from("election_votes").upsert({ election_id: electionId, voter, candidate, created_at: new Date().toISOString() }));
  },
  async getVote(electionId, voter) {
    const r = check(
      await db().from("election_votes").select("candidate").eq("election_id", electionId).eq("voter", voter).maybeSingle(),
    ) as { candidate: string } | null;
    return r?.candidate ?? null;
  },
  async countVotes(electionId) {
    const rows = check(await db().from("election_votes").select("candidate").eq("election_id", electionId)) as { candidate: string }[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.candidate] = (out[r.candidate] ?? 0) + 1;
    return out;
  },
  async listOffices() {
    const rows = check(await db().from("offices").select("*")) as { office: Office; uf: string; holder_handle: string; since: string }[];
    return rows.map((r) => ({ office: r.office, uf: r.uf, handle: r.holder_handle, since: r.since }));
  },
  async setOffice(office, uf, handle, electionId) {
    check(
      await db()
        .from("offices")
        .upsert({ office, uf, holder_handle: handle, election_id: electionId, since: new Date().toISOString() }),
    );
  },
  async clearOffice(office, uf) {
    check(await db().from("offices").delete().eq("office", office).eq("uf", uf));
  },

  async getOpenProposal(cityId) {
    const r = check(
      await db().from("hall_proposals").select("*").eq("city_id", cityId).eq("status", "open").maybeSingle(),
    ) as ProposalRow | null;
    return r ? toProposal(r) : null;
  },
  async createProposal(cityId, proposer, style, endsAt) {
    const r = check(
      await db().from("hall_proposals").insert({ city_id: cityId, proposer, style, ends_at: endsAt }).select("*").single(),
    ) as ProposalRow;
    return toProposal(r);
  },
  async updateProposal(id, status) {
    check(await db().from("hall_proposals").update({ status, resolved_at: new Date().toISOString() }).eq("id", id));
  },
  async castHallVote(proposalId, handle, approve) {
    check(await db().from("hall_votes").upsert({ proposal_id: proposalId, handle, approve }));
  },
  async getHallVote(proposalId, handle) {
    const r = check(
      await db().from("hall_votes").select("approve").eq("proposal_id", proposalId).eq("handle", handle).maybeSingle(),
    ) as { approve: boolean } | null;
    return r ? r.approve : null;
  },
  async countHallVotes(proposalId) {
    const rows = check(await db().from("hall_votes").select("approve").eq("proposal_id", proposalId)) as { approve: boolean }[];
    return { yes: rows.filter((r) => r.approve).length, no: rows.filter((r) => !r.approve).length };
  },

  async addLog(entry) {
    check(
      await db().from("audit_log").insert({
        actor: entry.actor,
        action: entry.action,
        handle: entry.handle ?? null,
        city_slug: entry.citySlug ?? null,
        details: entry.details ?? null,
      }),
    );
  },
  async listLogs({ limit, beforeId, action, handle }) {
    let q = db().from("audit_log").select("*").order("id", { ascending: false }).limit(limit);
    if (beforeId) q = q.lt("id", beforeId);
    if (action) q = q.eq("action", action);
    if (handle) q = q.or(`handle.eq.${handle},actor.eq.${handle}`);
    const rows = check(await q) as {
      id: number;
      created_at: string;
      actor: string;
      action: string;
      handle: string | null;
      city_slug: string | null;
      details: Record<string, unknown> | null;
    }[];
    return rows.map<LogEntry>((r) => ({
      id: r.id,
      createdAt: r.created_at,
      actor: r.actor,
      action: r.action,
      handle: r.handle,
      citySlug: r.city_slug,
      details: r.details,
    }));
  },
  async trackVisit(visitorId, handle, path, view) {
    check(await db().rpc("track_visit", { p_vid: visitorId, p_handle: handle, p_path: path, p_view: view }));
  },
  async listVisits(sinceDay) {
    const rows = check(await db().from("visits").select("*").gte("day", sinceDay).limit(50000)) as {
      visitor_id: string;
      day: string;
      first_at: string;
      last_at: string;
      views: number;
      handle: string | null;
      last_path: string | null;
    }[];
    return rows.map<VisitRow>((r) => ({
      visitorId: r.visitor_id,
      day: r.day,
      firstAt: r.first_at,
      lastAt: r.last_at,
      views: r.views,
      handle: r.handle,
      lastPath: r.last_path,
    }));
  },
  async getPasswordHash(handle) {
    const r = check(await db().from("accounts").select("password_hash").eq("handle", handle).maybeSingle()) as {
      password_hash: string;
    } | null;
    return r?.password_hash ?? null;
  },
  async setPasswordHash(handle, hash) {
    check(await db().from("accounts").upsert({ handle, password_hash: hash, updated_at: new Date().toISOString() }));
  },
  async createLoginCode(code, handle, expiresAt, source) {
    check(await db().from("login_codes").insert({ code, handle, expires_at: expiresAt, source }));
  },
  async consumeLoginCode(code, handle) {
    let q = db()
      .from("login_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code", code)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString());
    if (handle) q = q.eq("handle", handle);
    const rows = check(await q.select("handle")) as { handle: string }[];
    return rows[0]?.handle ?? null;
  },
  async addPurchase(p) {
    check(
      await db().from("purchases").insert({
        handle: p.handle,
        product: p.product,
        amount_cents: p.amountCents,
        status: p.status,
        provider: p.provider,
        paid_at: p.status === "paid" ? new Date().toISOString() : null,
      }),
    );
  },
  async listPurchases() {
    const rows = check(await db().from("purchases").select("*").order("created_at", { ascending: false }).limit(5000)) as {
      id: string;
      handle: string;
      product: string;
      amount_cents: number;
      status: Purchase["status"];
      provider: string | null;
      created_at: string;
    }[];
    return rows.map<Purchase>((r) => ({
      id: r.id,
      handle: r.handle,
      product: r.product,
      amountCents: r.amount_cents,
      status: r.status,
      provider: r.provider,
      createdAt: r.created_at,
    }));
  },
};

type ElectionRow = {
  id: string;
  office: Office;
  uf: string | null;
  status: Election["status"];
  ends_at: string;
  winner_handle: string | null;
  created_at: string;
};
const toElection = (r: ElectionRow): Election => ({
  id: r.id,
  office: r.office,
  uf: r.uf,
  status: r.status,
  endsAt: r.ends_at,
  winnerHandle: r.winner_handle,
  createdAt: r.created_at,
});

type ProposalRow = {
  id: string;
  city_id: string;
  proposer: string;
  style: Style;
  status: HallProposal["status"];
  ends_at: string;
  created_at: string;
};
const toProposal = (r: ProposalRow): HallProposal => ({
  id: r.id,
  cityId: r.city_id,
  proposer: r.proposer,
  style: r.style,
  status: r.status,
  endsAt: r.ends_at,
  createdAt: r.created_at,
});
