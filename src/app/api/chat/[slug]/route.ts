import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { cleanMessage } from "@/lib/moderation/profanity";
import { rateLimit } from "@/lib/rate-limit";
import { currentResident } from "@/lib/resident";

export const dynamic = "force-dynamic";

/** Só quem mora na cidade e tem o chat ativo pode ler e escrever. */
async function guard(slug: string) {
  const r = await currentResident();
  if (!r?.house) return { error: NextResponse.json({ ok: false, reason: "login", message: "Entre na sua conta." }, { status: 401 }) };
  if (r.house.citySlug !== slug)
    return { error: NextResponse.json({ ok: false, reason: "not_resident", message: "Você só pode usar o chat da sua cidade." }, { status: 403 }) };
  if (!r.perks.chatUntil)
    return { error: NextResponse.json({ ok: false, reason: "subscription", message: "O chat é um recurso pago." }, { status: 402 }) };
  const city = await getStore().getCity(slug);
  if (!city) return { error: NextResponse.json({ ok: false, message: "Cidade não encontrada." }, { status: 404 }) };
  return { r, city };
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = await guard(slug);
  if ("error" in g) return g.error;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  const messages = await getStore().listMessages(g.city.id, after, 60);
  return NextResponse.json({ ok: true, messages, me: g.r.handle });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = await guard(slug);
  if ("error" in g) return g.error;
  if (!rateLimit(`chat:${g.r.handle}`, 5, 15_000))
    return NextResponse.json({ ok: false, message: "Calma! Espere uns segundos." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().replace(/\s+/g, " ").slice(0, 300) : "";
  if (!text) return NextResponse.json({ ok: false, message: "Mensagem vazia." }, { status: 400 });
  const message = await getStore().addMessage(g.city.id, g.r.handle, cleanMessage(text));
  return NextResponse.json({ ok: true, message });
}
