import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * True when a Supabase RPC error means the function does not exist yet
 * (PostgREST code PGRST202). Used to fall back to a legacy code path when a
 * transactional RPC hasn't been applied to the database yet.
 */
export function isMissingRpc(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === "PGRST202" || /could not find the function|does not exist/i.test(e?.message || "");
}
