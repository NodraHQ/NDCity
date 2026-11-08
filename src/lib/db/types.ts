import type { BuildingType } from "@/lib/buildings";

export type City = {
  id: string;
  slug: string;
  name: string;
  seed: string;
  /** null = cidade bloqueada (ninguém resgatou ainda). */
  mayorHandle: string | null;
  unlockedAt: string | null;
};

export type Claim = {
  id: string;
  cityId: string;
  lotIndex: number;
  instagramHandle: string;
  buildingType: BuildingType;
  createdAt: string;
};

export type Code = {
  code: string;
  instagramHandle: string;
  createdAt: string;
  usedAt: string | null;
  claimId: string | null;
};

export type ClaimInput = {
  code: string;
  citySlug: string;
  lotIndex: number;
  lotCount: number;
  buildingType: BuildingType;
};

export type ClaimError =
  | "code_not_found"
  | "code_used"
  | "city_not_found"
  | "invalid_lot"
  | "lot_taken"
  | "handle_has_house";

export type ClaimResult =
  | { ok: true; claim: Claim; isMayor: boolean }
  | { ok: false; error: ClaimError };

export interface Store {
  readonly kind: "supabase" | "memory";
  getCity(slug: string): Promise<City | null>;
  listClaims(cityId: string): Promise<Claim[]>;
  getCode(code: string): Promise<Code | null>;
  findClaimByHandle(handle: string): Promise<Claim | null>;
  claim(input: ClaimInput): Promise<ClaimResult>;
  createCode(code: string, handle: string): Promise<Code>;
  listCodes(limit?: number): Promise<Code[]>;
  deleteCode(code: string): Promise<void>;
  deleteClaim(id: string): Promise<void>;
}
