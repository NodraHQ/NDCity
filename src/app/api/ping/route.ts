import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { currentHandle } from "@/lib/resident";

/**
 * Contador de acessos próprio: um cookie anônimo por navegador, uma linha
 * por dia. A página manda um "ping" ao abrir e a cada minuto (para saber
 * quem está online). Não guarda IP nem nada pessoal.
 */
const COOKIE = "ndcity_visitante";

export async function POST(req: Request) {
  const jar = await cookies();
  let vid = jar.get(COOKIE)?.value;
  if (!vid || !/^[\w-]{10,40}$/.test(vid)) {
    vid = randomBytes(12).toString("base64url");
    jar.set(COOKIE, vid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 400 });
  }
  if (!rateLimit(`ping:${vid}`, 6, 60_000)) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path.slice(0, 80) : "/";
  try {
    await getStore().trackVisit(vid, await currentHandle(), path, body?.view === true);
  } catch (e) {
    console.error("ping falhou", e);
  }
  return NextResponse.json({ ok: true });
}
