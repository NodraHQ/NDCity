import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Login simples da página /admin: uma senha só (ADMIN_PASSWORD).
 * Depois de entrar, guardamos um "carimbo" no cookie que só o servidor
 * sabe fabricar. Trocar a senha desloga todo mundo.
 */
const COOKIE = "cidadezinha_admin";

function token(password: string) {
  return createHmac("sha256", password).update("cidadezinha-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function adminConfigured() {
  return !!process.env.ADMIN_PASSWORD;
}

export function checkPassword(password: string) {
  const real = process.env.ADMIN_PASSWORD;
  return !!real && safeEqual(token(password), token(real));
}

export async function setAdminCookie() {
  const jar = await cookies();
  jar.set(COOKIE, token(process.env.ADMIN_PASSWORD!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && safeEqual(value, token(real));
}
