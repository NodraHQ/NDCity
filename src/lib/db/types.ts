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

export type Feature = "chat" | "customize" | "move";

export type Entitlement = {
  handle: string;
  feature: Feature;
  expiresAt: string | null;
  credits: number;
};

export type Message = { id: number; handle: string; body: string; createdAt: string };

/** Casa ativa com dados da cidade (painel do admin). */
export type HouseRow = {
  handle: string;
  type: BuildingType;
  createdAt: string;
  citySlug: string;
  cityName: string;
  uf: string | null;
  isMayor: boolean;
};

export type LogEntry = {
  id: number;
  createdAt: string;
  actor: string;
  action: string;
  handle: string | null;
  citySlug: string | null;
  details: Record<string, unknown> | null;
};
export type NewLog = Omit<LogEntry, "id" | "createdAt" | "handle" | "citySlug" | "details"> & {
  handle?: string | null;
  citySlug?: string | null;
  details?: Record<string, unknown> | null;
};

export type VisitRow = { visitorId: string; day: string; firstAt: string; lastAt: string; views: number; handle: string | null; lastPath: string | null };

export type Purchase = {
  id: string;
  handle: string;
  product: string;
  amountCents: number;
  status: "pending" | "paid" | "canceled" | "refunded";
  provider: string | null;
  createdAt: string;
};

export type Office = "governor" | "president";

export type Election = {
  id: string;
  office: Office;
  uf: string | null;
  status: "open" | "closed" | "canceled";
  endsAt: string;
  winnerHandle: string | null;
  createdAt: string;
};

export type OfficeHolder = { office: Office; uf: string; handle: string; since: string };

export type HallProposal = {
  id: string;
  cityId: string;
  proposer: string;
  style: Style;
  status: "open" | "approved" | "rejected" | "canceled";
  endsAt: string;
  createdAt: string;
};

export type DirectClaimInput = {
  handle: string;
  citySlug: string;
  lotIndex: number;
  lotCount: number;
  buildingType: BuildingType;
};

export type ClaimError =
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
  /** Resgate de quem já tem conta. */
  claimDirect(input: DirectClaimInput): Promise<ClaimResult>;
  moveHouse(input: {
    handle: string;
    citySlug: string;
    lotIndex: number;
    lotCount: number;
    buildingType: BuildingType | null;
  }): Promise<MoveResult>;
  listAllHouses(): Promise<HouseRow[]>;
  countResidents(cityId: string): Promise<number>;
  setHouseStyle(handle: string, style: Style | null): Promise<void>;
  /** Remove a casa e TODO o acesso da pessoa (senha, logins) e passa a prefeitura adiante. */
  removeHouse(handle: string): Promise<{ hadHouse: boolean }>;
  // login do morador
  createSession(tokenHash: string, handle: string): Promise<void>;
  getSessionHandle(tokenHash: string): Promise<string | null>;
  deleteSession(tokenHash: string): Promise<void>;
  /** Desconecta todos os outros aparelhos da pessoa (ex.: ao trocar a senha). */
  deleteOtherSessions(handle: string, keepTokenHash: string | null): Promise<void>;
  // recursos pagos
  getEntitlements(handle: string): Promise<Entitlement[]>;
  grantEntitlement(handle: string, feature: Feature, opts: { days?: number; credits?: number }): Promise<void>;
  /** Gasta 1 crédito (mudança/pintura). Devolve false se não tinha. */
  useCredit(handle: string, feature: Feature): Promise<boolean>;
  /** Estorno: tira os dias/créditos que a compra tinha dado. */
  revokeEntitlement(handle: string, feature: Feature, opts: { days?: number; credits?: number }): Promise<void>;
  // chat
  listMessages(cityId: string, afterId: number, limit: number): Promise<Message[]>;
  addMessage(cityId: string, handle: string, body: string): Promise<Message>;
  /** Moderação: últimas mensagens (de uma cidade ou de todas). */
  listRecentMessages(opts: { citySlug?: string; limit: number }): Promise<(Message & { citySlug: string; cityName: string })[]>;
  deleteMessage(id: number): Promise<void>;
  // eleições
  createElection(office: Office, uf: string | null, endsAt: string): Promise<Election>;
  listElections(status?: Election["status"]): Promise<Election[]>;
  getElection(id: string): Promise<Election | null>;
  updateElection(id: string, patch: { status: Election["status"]; winnerHandle?: string | null }): Promise<void>;
  addCandidate(electionId: string, handle: string): Promise<void>;
  removeCandidate(electionId: string, handle: string): Promise<void>;
  listCandidates(electionId: string): Promise<{ handle: string; createdAt: string }[]>;
  castVote(electionId: string, voter: string, candidate: string): Promise<void>;
  getVote(electionId: string, voter: string): Promise<string | null>;
  countVotes(electionId: string): Promise<Record<string, number>>;
  listOffices(): Promise<OfficeHolder[]>;
  setOffice(office: Office, uf: string, handle: string, electionId: string | null): Promise<void>;
  clearOffice(office: Office, uf: string): Promise<void>;
  // prefeitura votada
  getOpenProposal(cityId: string): Promise<HallProposal | null>;
  createProposal(cityId: string, proposer: string, style: Style, endsAt: string): Promise<HallProposal>;
  updateProposal(id: string, status: HallProposal["status"]): Promise<void>;
  castHallVote(proposalId: string, handle: string, approve: boolean): Promise<void>;
  getHallVote(proposalId: string, handle: string): Promise<boolean | null>;
  countHallVotes(proposalId: string): Promise<{ yes: number; no: number }>;
  // histórico
  addLog(entry: NewLog): Promise<void>;
  listLogs(opts: { limit: number; beforeId?: number; action?: string; handle?: string }): Promise<LogEntry[]>;
  // acessos
  trackVisit(visitorId: string, handle: string | null, path: string, view: boolean): Promise<void>;
  listVisits(sinceDay: string): Promise<VisitRow[]>;
  // senha e códigos de acesso
  getPasswordHash(handle: string): Promise<string | null>;
  setPasswordHash(handle: string, hash: string): Promise<void>;
  /** Cria a conta. Devolve false se o @ já tem conta. */
  createAccount(handle: string, hash: string): Promise<boolean>;
  createLoginCode(code: string, handle: string, expiresAt: string, source: string): Promise<void>;
  /**
   * Usa o código (uma vez só). Devolve o @ ou null se não existe, já foi usado,
   * expirou ou (se `handle` vier) é de outro @, e nesse caso o código não é gasto.
   */
  consumeLoginCode(code: string, handle?: string): Promise<string | null>;
  // pagamentos
  addPurchase(p: Omit<Purchase, "id" | "createdAt">): Promise<void>;
  listPurchases(): Promise<Purchase[]>;
  createPendingPurchase(p: { handle: string; product: string; amountCents: number; provider: string }): Promise<Purchase>;
  setPurchaseCheckout(id: string, checkoutId: string): Promise<void>;
  getPurchase(id: string): Promise<Purchase | null>;
  /** Marca como paga só se ainda estava pendente. Devolve true se mudou (evita liberar duas vezes). */
  markPurchasePaid(id: string, providerRef: string): Promise<boolean>;
  setPurchaseStatus(id: string, status: Purchase["status"]): Promise<void>;
  // configurações
  getSetting<T>(key: string): Promise<T | null>;
  setSetting(key: string, value: unknown): Promise<void>;
}
