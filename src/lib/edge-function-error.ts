import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * supabase-js's functions.invoke() puts a non-2xx response's JSON body in
 * `error.context` (a raw Response), not in `data` — so the `{ error: "..." }`
 * message our edge functions return has to be parsed out explicitly, or every
 * failure looks like a generic, undiagnosable error to the user.
 */
export async function extractEdgeFunctionError(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // Response body wasn't JSON — fall through to the fallback message.
    }
  }
  return fallback;
}
