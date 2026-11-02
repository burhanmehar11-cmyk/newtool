import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once. Missing values produce a clear
 * "not configured" state; nothing silently falls back to demo data.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  BETA_ALLOWED_EMAILS: z.string().optional(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  BETA_ALLOWED_EMAILS: process.env.BETA_ALLOWED_EMAILS || undefined,
});

export const env = parsed.success ? parsed.data : {};

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}
