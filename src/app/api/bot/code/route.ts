import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { codeForHandle } from "@/lib/access";
import { isValidHandle, normalizeHandle } from "@/lib/handle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Endereço para a ferramenta de DM (ManyChat, ReplyKaro, Make, n8n, bot
 * próprio…). Ela manda o @ de quem escreveu e recebe o código certo:
 * - sem casa ainda: código de resgate (NDC-…)
 * - já tem casa: código de acesso (ENT-…, uso único, 24h)
 *
 * Aceita:
 *   GET  /api/bot/code?handle=fulano&key=CHAVE
 *   POST /api/bot/code  { "handle": "fulano" }  com  Authorization: Bearer CHAVE
 * Com &format=text devolve só a mensagem pronta para colar na DM.
 *
 * A ferramenta é que confere se a pessoa segue o perfil (ex.: "só para
 * seguidores") antes de chamar este endereço.
 */
function keyOk(given: string | null) {
  const real = process.env.BOT_SECRET;
  if (!real || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request, rawHandle: unknown, key: string | null, format: string | null) {
  if (!process.env.BOT_SECRET) return NextResponse.json({ ok: false, message: "BOT_SECRET não configurado." }, { status: 503 });
  if (!keyOk(key)) return NextResponse.json({ ok: false, message: "Chave inválida." }, { status: 401 });
  const h = normalizeHandle(String(rawHandle ?? ""));
  if (!isValidHandle(h)) return NextResponse.json({ ok: false, message: "@ inválido." }, { status: 400 });
  if (!rateLimit(`bot:${h}`, 5, 60 * 60_000))
    return NextResponse.json({ ok: false, message: "Muitos pedidos para esse @. Tente daqui a pouco." }, { status: 429 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const r = await codeForHandle(h, "bot", site);
  if (format === "text") return new NextResponse(r.message, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return NextResponse.json({ ok: true, handle: h, ...r });
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return handle(req, sp.get("handle") ?? sp.get("username"), sp.get("key"), sp.get("format"));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const auth = req.headers.get("authorization");
  const key = auth?.startsWith("Bearer ") ? auth.slice(7) : (body?.key ?? new URL(req.url).searchParams.get("key"));
  return handle(req, body?.handle ?? body?.username, key, body?.format ?? new URL(req.url).searchParams.get("format"));
}
