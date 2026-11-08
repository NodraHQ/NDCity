import "server-only";
import { getStore } from "@/lib/db";
import type { NewLog } from "@/lib/db/types";

/**
 * Registra no histórico do admin. Nunca derruba a ação principal:
 * se o log falhar, só avisa no console do servidor.
 */
export async function audit(entry: NewLog) {
  try {
    await getStore().addLog(entry);
  } catch (e) {
    console.error("audit falhou", e);
  }
}
