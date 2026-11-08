import { NextResponse } from "next/server";
import { proposalView, resolveProposal } from "@/lib/civic";
import { getStore } from "@/lib/db";
import { currentHandle } from "@/lib/resident";

export const dynamic = "force-dynamic";

/** Proposta de pintura da prefeitura aberta na cidade (se houver). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const city = await getStore().getCity(slug);
  if (!city) return NextResponse.json({ proposal: null });
  return NextResponse.json({ proposal: await proposalView(city, await currentHandle()) }, { headers: { "Cache-Control": "no-store" } });
}

/** Morador vota sim/não. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const handle = await currentHandle();
  if (!handle) return NextResponse.json({ ok: false, message: "Entre na sua conta primeiro." }, { status: 401 });
  const store = getStore();
  const city = await store.getCity(slug);
  const house = await store.findClaimByHandle(handle);
  if (!city || house?.cityId !== city.id)
    return NextResponse.json({ ok: false, message: "Só moradores desta cidade votam." }, { status: 403 });
  const p = await resolveProposal(city);
  if (!p) return NextResponse.json({ ok: false, message: "A votação já terminou." }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (typeof body?.approve !== "boolean") return NextResponse.json({ ok: false, message: "Voto inválido." }, { status: 400 });
  await store.castHallVote(p.id, handle, body.approve);
  const view = await proposalView((await store.getCity(slug))!, handle);
  return NextResponse.json({ ok: true, proposal: view, decided: !view });
}
