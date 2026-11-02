import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig } from "@/server/env";

/**
 * Supabase client bound to the current request's cookies. Runs with the
 * user's JWT, so row-level security applies to every query. Returns null
 * when Supabase is not configured.
 */
export async function createSupabaseServerClient() {
  // Read cookies first so every caller is request-time, even when the build
  // environment has no Supabase settings.
  const cookieStore = await cookies();
  const cfg = supabaseConfig();
  if (!cfg) return null;
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}

export type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
