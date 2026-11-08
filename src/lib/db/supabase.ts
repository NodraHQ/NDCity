import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BuildingType } from "@/lib/buildings";
import type { City, Claim, ClaimResult, Code, Store } from "./types";

/**
 * Acesso ao Supabase. Só roda no servidor, com a chave secreta.
 * As tabelas têm RLS ligado e nenhuma política pública, então ninguém
 * consegue mexer no banco direto pelo navegador.
 */
let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

type CityRow = { id: string; slug: string; name: string; seed: string; mayor_handle: string | null; unlocked_at: string | null };
type ClaimRow = { id: string; city_id: string; lot_index: number; instagram_handle: string; building_type: string; created_at: string };
type CodeRow = { code: string; instagram_handle: string; created_at: string; used_at: string | null; claim_id: string | null };

const toCity = (r: CityRow): City => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  seed: r.seed,
  mayorHandle: r.mayor_handle,
  unlockedAt: r.unlocked_at,
});
const toClaim = (r: ClaimRow): Claim => ({
  id: r.id,
  cityId: r.city_id,
  lotIndex: r.lot_index,
  instagramHandle: r.instagram_handle,
  buildingType: r.building_type as BuildingType,
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
  async listClaims(cityId) {
    const rows = check(await db().from("claims").select("*").eq("city_id", cityId));
    return (rows as ClaimRow[]).map(toClaim);
  },
  async getCode(code) {
    const row = check(await db().from("codes").select("*").eq("code", code).maybeSingle());
    return row ? toCode(row as CodeRow) : null;
  },
  async findClaimByHandle(handle) {
    const row = check(await db().from("claims").select("*").eq("instagram_handle", handle).maybeSingle());
    return row ? toClaim(row as ClaimRow) : null;
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
  async removeHouse(handle) {
    const res = check(await db().rpc("remove_house", { p_handle: handle })) as { had_house?: boolean };
    return { hadHouse: !!res.had_house };
  },
};
