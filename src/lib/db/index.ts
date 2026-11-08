import "server-only";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

/** Usa o Supabase se as chaves estiverem configuradas; senão, a memória. */
export function getStore(): Store {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return supabaseStore;
  return memoryStore;
}

export type * from "./types";
