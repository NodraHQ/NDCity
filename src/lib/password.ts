import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

/** Senhas guardadas só como hash (scrypt com sal aleatório). */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return ["scrypt", salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const test = await scrypt(password, Buffer.from(salt, "base64"), 32);
  const real = Buffer.from(hash, "base64");
  return real.length === test.length && timingSafeEqual(real, test);
}

export function validPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 6 && p.length <= 72;
}
