import type { BuildingType } from "@/lib/buildings";
import type { Style } from "@/lib/styles";

export type City = {
  id: string;
  slug: string;
  name: string;
  seed: string;
  uf: string | null;
  layoutSize: number;
  /** null = cidade bloqueada (ninguém mora lá ainda). */
  mayorHandle: string | null;
  unlockedAt: string | null;
  hallStyle: Style | null;
};

export type NewCity = {
  slug: string;
  name: string;
  seed: string;
  uf: string;
  ibgeCode: number;
  lat: number;
  lng: number;
  timezone: string;
  layoutSize: number;
};

export type ActiveCity = { slug: string; name: string; mayorHandle: string | null; houses: number };

export type Claim = {
  id: string;
  cityId: string;
  lotIndex: number;
  instagramHandle: string;
  buildingType: BuildingType;
  style: Style | null;
  createdAt: string;
};

export type Code = {
  code: string;
  instagramHandle: string;
  createdAt: string;
  usedAt: string | null;
  claimId: string | null;
};

export type Feature = "chat" | "customize" | "move";

export type Entitlement = {
  handle: string;
  feature: Feature;
  expiresAt: string | null;
  credits: number;
};

export type Message = { id: number; handle: string; body: string; createdAt: string };

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

export type ClaimResult = { ok: true; claim: Claim; isMayor: boolean } | { ok: false; error: ClaimError };

export type MoveError = "no_house" | "no_credit" | "city_not_found" | "same_city" | "invalid_lot" | "lot_taken";
export type MoveResult = { ok: true; claim: Claim; isMayor: boolean } | { ok: false; error: MoveError };

export interface Store {
  readonly kind: "supabase" | "memory";
  // cidades
  getCity(slug: string): Promise<City | null>;
  ensureCity(city: NewCity): Promise<City>;
  listActiveCities(): Promise<ActiveCity[]>;
  setHallStyle(cityId: string, style: Style | null): Promise<void>;
  // casinhas
  listClaims(cityId: string): Promise<Claim[]>;
  findClaimByHandle(handle: string): Promise<(Claim & { citySlug: string }) | null>;
  claim(input: ClaimInput): Promise<ClaimResult>;
  moveHouse(input: { handle: string; citySlug: string; lotIndex: number; lotCount: number }): Promise<MoveResult>;
  setHouseStyle(handle: string, style: Style | null): Promise<void>;
  /** Remove a casa e TODO o acesso do @ (códigos, logins) e passa a prefeitura adiante. */
  removeHouse(handle: string): Promise<{ hadHouse: boolean }>;
  // códigos
  getCode(code: string): Promise<Code | null>;
  createCode(code: string, handle: string): Promise<Code>;
  listCodes(limit?: number): Promise<Code[]>;
  deleteCode(code: string): Promise<void>;
  // login do morador
  createSession(tokenHash: string, handle: string): Promise<void>;
  getSessionHandle(tokenHash: string): Promise<string | null>;
  deleteSession(tokenHash: string): Promise<void>;
  // recursos pagos
  getEntitlements(handle: string): Promise<Entitlement[]>;
  grantEntitlement(handle: string, feature: Feature, opts: { days?: number; credits?: number }): Promise<void>;
  // chat
  listMessages(cityId: string, afterId: number, limit: number): Promise<Message[]>;
  addMessage(cityId: string, handle: string, body: string): Promise<Message>;
}
