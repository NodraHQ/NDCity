import "server-only";
import { getStore } from "@/lib/db";
import type { City, Election, HallProposal } from "@/lib/db/types";
import { findCity } from "@/lib/geo/cities";
import type { Style } from "@/lib/styles";

/**
 * Política da cidade: eleições para governador/presidente e a votação dos
 * moradores sobre a pintura da prefeitura.
 *
 * Eleição: o admin cria; moradores do estado (governador) ou do Brasil
 * (presidente) se candidatam e votam (1 voto, pode trocar enquanto aberta).
 * Ao fim, quem tiver mais votos assume; empate = quem se candidatou antes.
 * O cargo só aparece enquanto a pessoa estiver ativa (tem casa, e no caso
 * do governador, casa no mesmo estado).
 */

export const PROPOSAL_HOURS = 24;

async function ufOfCitySlug(slug: string): Promise<string | null> {
  return findCity(slug)?.uf ?? (await getStore().getCity(slug))?.uf ?? null;
}

/** Onde a pessoa mora: { citySlug, uf } ou null. */
export async function residenceOf(handle: string) {
  const house = await getStore().findClaimByHandle(handle);
  if (!house) return null;
  return { citySlug: house.citySlug, cityId: house.cityId, uf: await ufOfCitySlug(house.citySlug) };
}

export async function closeElection(e: Election) {
  const store = getStore();
  const [candidates, votes] = await Promise.all([store.listCandidates(e.id), store.countVotes(e.id)]);
  const ranked = candidates
    .map((c) => ({ ...c, votes: votes[c.handle] ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
  const winner = ranked[0] && ranked[0].votes > 0 ? ranked[0].handle : null;
  await store.updateElection(e.id, { status: "closed", winnerHandle: winner });
  if (winner) await store.setOffice(e.office, e.uf ?? "", winner, e.id);
  return winner;
}

/** Fecha as eleições cujo prazo acabou. */
export async function syncElections() {
  const open = await getStore().listElections("open");
  const now = Date.now();
  for (const e of open) if (Date.parse(e.endsAt) <= now) await closeElection(e);
}

/** Cargos com gente ativa: presidente e governadores por estado. */
export async function activeOffices() {
  await syncElections();
  const offices = await getStore().listOffices();
  let president: string | null = null;
  const governors: Record<string, string> = {};
  for (const o of offices) {
    const home = await residenceOf(o.handle);
    if (!home) continue;
    if (o.office === "president") president = o.handle;
    else if (home.uf === o.uf) governors[o.uf] = o.handle;
  }
  return { president, governors };
}

export function canParticipate(e: Election, home: { uf: string | null } | null) {
  if (!home || e.status !== "open") return false;
  return e.office === "president" || home.uf === e.uf;
}

export async function electionView(e: Election, handle: string | null) {
  const store = getStore();
  const [candidates, votes, myVote, home] = await Promise.all([
    store.listCandidates(e.id),
    store.countVotes(e.id),
    handle ? store.getVote(e.id, handle) : Promise.resolve(null),
    handle ? residenceOf(handle) : Promise.resolve(null),
  ]);
  return {
    id: e.id,
    office: e.office,
    uf: e.uf,
    status: e.status,
    endsAt: e.endsAt,
    winner: e.winnerHandle,
    candidates: candidates
      .map((c) => ({ handle: c.handle, votes: votes[c.handle] ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.handle.localeCompare(b.handle)),
    myVote,
    canParticipate: canParticipate(e, home),
    isCandidate: !!handle && candidates.some((c) => c.handle === handle),
  };
}

export type ElectionView = Awaited<ReturnType<typeof electionView>>;

// ------------------------------------------------------- prefeitura votada

/** Decide a proposta aberta se já der (maioria absoluta ou prazo vencido). */
export async function resolveProposal(city: City): Promise<HallProposal | null> {
  const store = getStore();
  const p = await store.getOpenProposal(city.id);
  if (!p) return null;
  if (p.proposer !== city.mayorHandle) {
    await store.updateProposal(p.id, "canceled");
    return null;
  }
  const [{ yes, no }, residents] = await Promise.all([store.countHallVotes(p.id), store.countResidents(city.id)]);
  const expired = Date.parse(p.endsAt) <= Date.now();
  let result: "approved" | "rejected" | null = null;
  if (yes * 2 > residents) result = "approved";
  else if (no * 2 >= residents) result = "rejected";
  else if (expired) result = yes > no ? "approved" : "rejected";
  if (!result) return p;
  await store.updateProposal(p.id, result);
  if (result === "approved") await store.setHallStyle(city.id, p.style);
  return null;
}

export async function proposeHall(city: City, mayor: string, style: Style) {
  const store = getStore();
  const old = await store.getOpenProposal(city.id);
  if (old) await store.updateProposal(old.id, "canceled");
  const p = await store.createProposal(city.id, mayor, style, new Date(Date.now() + PROPOSAL_HOURS * 3600_000).toISOString());
  await store.castHallVote(p.id, mayor, true);
  const still = await resolveProposal(city);
  return { approvedNow: !still };
}

export async function proposalView(city: City, handle: string | null) {
  const store = getStore();
  const p = await resolveProposal(city);
  if (!p) return null;
  const [counts, residents, myVote, home] = await Promise.all([
    store.countHallVotes(p.id),
    store.countResidents(city.id),
    handle ? store.getHallVote(p.id, handle) : Promise.resolve(null),
    handle ? residenceOf(handle) : Promise.resolve(null),
  ]);
  return {
    id: p.id,
    proposer: p.proposer,
    style: p.style,
    endsAt: p.endsAt,
    yes: counts.yes,
    no: counts.no,
    residents,
    myVote,
    canVote: !!home && home.cityId === city.id,
  };
}

export type ProposalView = NonNullable<Awaited<ReturnType<typeof proposalView>>>;
