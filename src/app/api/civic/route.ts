import { NextResponse } from "next/server";
import { activeOffices, electionView, residenceOf, syncElections } from "@/lib/civic";
import { getStore } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { currentHandle } from "@/lib/resident";

export const dynamic = "force-dynamic";

/** Cargos ativos + eleições abertas (e as encerradas há pouco). */
export async function GET() {
  await syncElections();
  const handle = await currentHandle();
  const store = getStore();
  const all = await store.listElections();
  const weekAgo = Date.now() - 7 * 86400_000;
  const relevant = all.filter((e) => e.status === "open" || (e.status === "closed" && Date.parse(e.endsAt) > weekAgo));
  const [offices, elections] = await Promise.all([activeOffices(), Promise.all(relevant.map((e) => electionView(e, handle)))]);
  return NextResponse.json({ offices, elections }, { headers: { "Cache-Control": "no-store" } });
}

/** Candidatar-se, desistir ou votar. */
export async function POST(req: Request) {
  const handle = await currentHandle();
  if (!handle) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  if (!rateLimit(`civic:${handle}`, 20, 60_000))
    return NextResponse.json({ ok: false, message: "Calma! Tente de novo em um minuto." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const store = getStore();
  await syncElections();
  const e = typeof body?.electionId === "string" ? await store.getElection(body.electionId) : null;
  if (!e || e.status !== "open") return NextResponse.json({ ok: false, message: "Essa eleição não está aberta." }, { status: 400 });
  const home = await residenceOf(handle);
  if (!home || (e.office === "governor" && home.uf !== e.uf))
    return NextResponse.json(
      { ok: false, message: e.office === "governor" ? `Só moradores de ${e.uf} participam.` : "Só moradores participam." },
      { status: 403 },
    );

  if (body.action === "candidate") await store.addCandidate(e.id, handle);
  else if (body.action === "withdraw") await store.removeCandidate(e.id, handle);
  else if (body.action === "vote") {
    const candidates = await store.listCandidates(e.id);
    if (!candidates.some((c) => c.handle === body.candidate))
      return NextResponse.json({ ok: false, message: "Candidato não encontrado." }, { status: 400 });
    await store.castVote(e.id, handle, body.candidate);
  } else return NextResponse.json({ ok: false, message: "Ação inválida." }, { status: 400 });

  return NextResponse.json({ ok: true, election: await electionView(e, handle) });
}
