import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BuildingType } from "@/lib/buildings";
import type { Style } from "@/lib/styles";
import type { City, Claim, ClaimResult, Code, Entitlement, Feature, Message, MoveResult, Store } from "./types";

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
  async moveHouse({ handle, citySlug, lotIndex, lotCount }): Promise<MoveResult> {
    const res = check(
      await db().rpc("move_house", { p_handle: handle, p_city_slug: citySlug, p_lot_index: lotIndex, p_lot_count: lotCount }),
    ) as { ok: boolean; error?: string; claim?: ClaimRow; is_mayor?: boolean };
    if (!res.ok || !res.claim) return { ok: false, error: (res.error ?? "no_house") as never };
    return { ok: true, claim: toClaim(res.claim), isMayor: !!res.is_mayor };
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
};
