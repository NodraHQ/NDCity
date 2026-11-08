import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { closeElection, electionView, syncElections } from "@/lib/civic";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { STATE_FLAG_UFS } from "@/lib/flags";

export const dynamic = "force-dynamic";
const denied = () => NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return denied();
  await syncElections();
  const store = getStore();
  const elections = await Promise.all((await store.listElections()).slice(0, 50).map((e) => electionView(e, null)));
  return NextResponse.json({ ok: true, elections, offices: await store.listOffices() });
}

/** Criar evento de eleição. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return denied();
  const body = await req.json().catch(() => null);
  const office = body?.office;
  const uf = typeof body?.uf === "string" ? body.uf.toUpperCase() : null;
  const days = Number(body?.days);
  if (office !== "governor" && office !== "president") return NextResponse.json({ ok: false, message: "Cargo inválido." }, { status: 400 });
  if (office === "governor" && (!uf || !STATE_FLAG_UFS.includes(uf)))
    return NextResponse.json({ ok: false, message: "Escolha o estado." }, { status: 400 });
  if (!(days >= 1 && days <= 60)) return NextResponse.json({ ok: false, message: "Duração entre 1 e 60 dias." }, { status: 400 });
  const store = getStore();
  const open = await store.listElections("open");
  if (open.some((e) => e.office === office && (office === "president" || e.uf === uf)))
    return NextResponse.json({ ok: false, message: "Já existe uma eleição aberta para esse cargo." }, { status: 409 });
  const e = await store.createElection(office, office === "governor" ? uf : null, new Date(Date.now() + days * 86400_000).toISOString());
  await audit({ actor: "admin", action: "eleicao_criada", details: { cargo: office === "president" ? "presidente" : `governador ${uf}`, dias: days } });
  return NextResponse.json({ ok: true, election: e });
}

/** Encerrar agora / cancelar uma eleição, ou tirar alguém do cargo. */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return denied();
  const body = await req.json().catch(() => null);
  const store = getStore();
  if (body?.action === "clear_office") {
    await store.clearOffice(body.office, body.uf ?? "");
    await audit({ actor: "admin", action: "cargo_removido", details: { cargo: body.office === "president" ? "presidente" : `governador ${body.uf}` } });
    return NextResponse.json({ ok: true });
  }
  const e = typeof body?.id === "string" ? await store.getElection(body.id) : null;
  if (!e || e.status !== "open") return NextResponse.json({ ok: false, message: "Eleição não está aberta." }, { status: 400 });
  if (body.action === "close") {
    const winner = await closeElection(e);
    return NextResponse.json({ ok: true, winner });
  }
  if (body.action === "cancel") {
    await store.updateElection(e.id, { status: "canceled" });
    await audit({ actor: "admin", action: "eleicao_cancelada", details: { cargo: e.office === "president" ? "presidente" : `governador ${e.uf}` } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, message: "Ação inválida." }, { status: 400 });
}
