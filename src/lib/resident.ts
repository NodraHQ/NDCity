import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getStore } from "@/lib/db";
import type { Entitlement, Feature } from "@/lib/db/types";

/**
 * Login do morador. Quando a pessoa resgata (ou entra com o código dela),
 * criamos um token aleatório, guardamos só o hash no banco e o token num
 * cookie que o navegador não deixa scripts lerem.
 */
const COOKIE = "cidadezinha_morador";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(handle: string) {
  const token = randomBytes(32).toString("base64url");
  await getStore().createSession(hash(token), handle);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await getStore().deleteSession(hash(token));
  jar.delete(COOKIE);
}

/** @ do morador logado (ou null). */
export async function currentHandle(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return getStore().getSessionHandle(hash(token));
}

export type Perks = { chatUntil: string | null; customize: boolean; moveCredits: number };

export function perksFrom(ents: Entitlement[]): Perks {
  const get = (f: Feature) => ents.find((e) => e.feature === f);
  const chat = get("chat");
  const chatActive = !!chat?.expiresAt && Date.parse(chat.expiresAt) > Date.now();
  return {
    chatUntil: chatActive ? chat!.expiresAt : null,
    customize: !!get("customize"),
    moveCredits: get("move")?.credits ?? 0,
  };
}

/** Tudo sobre quem está logado: @, casa e recursos liberados. */
export async function currentResident() {
  const handle = await currentHandle();
  if (!handle) return null;
  const store = getStore();
  const [house, ents] = await Promise.all([store.findClaimByHandle(handle), store.getEntitlements(handle)]);
  return { handle, house, perks: perksFrom(ents) };
}

export type Resident = NonNullable<Awaited<ReturnType<typeof currentResident>>>;
