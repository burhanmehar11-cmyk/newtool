import "server-only";
import { promises as dns } from "node:dns";
import { classifyDns, EMAIL_SYNTAX, type DnsCheckInput, type DnsCheckResult } from "@/lib/research/email-check";

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
const NO_DATA = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

let canary: { at: number; ok: boolean } | null = null;

/** Confirms the resolver works by looking up a domain known to have mail servers (cached 10 minutes). */
async function resolverHealthy() {
  if (canary && Date.now() - canary.at < 10 * 60_000) return canary.ok;
  const ok = await within(dns.resolveMx("gmail.com"), 5000).then((r) => r.length > 0).catch(() => false);
  canary = { at: Date.now(), ok };
  return ok;
}

export async function dnsEmailCheck(email: string): Promise<DnsCheckResult> {
  const syntaxOk = EMAIL_SYNTAX.test(email);
  if (!syntaxOk) return classifyDns({ syntaxOk, mx: "none", hasAddress: false });
  const domain = email.split("@")[1].toLowerCase();
  let mx: DnsCheckInput["mx"];
  try {
    mx = await within(dns.resolveMx(domain), 5000);
  } catch (e) {
    mx = NO_DATA.has((e as NodeJS.ErrnoException).code ?? "") ? "none" : "error";
  }
  let hasAddress: boolean | "error" = false;
  if (mx === "none") {
    try {
      const [a, aaaa] = await Promise.allSettled([within(dns.resolve4(domain), 5000), within(dns.resolve6(domain), 5000)]);
      hasAddress = (a.status === "fulfilled" && a.value.length > 0) || (aaaa.status === "fulfilled" && aaaa.value.length > 0);
      if (!hasAddress && [a, aaaa].some((r) => r.status === "rejected" && !NO_DATA.has((r.reason as NodeJS.ErrnoException).code ?? ""))) hasAddress = "error";
    } catch {
      hasAddress = "error";
    }
  }
  const firstPass = classifyDns({ syntaxOk, mx, hasAddress });
  if (firstPass.status !== "invalid") return firstPass;
  return classifyDns({ syntaxOk, mx, hasAddress, resolverHealthy: await resolverHealthy() });
}

const domainCache = new Map<string, { at: number; invalid: boolean }>();

/**
 * Drops addresses whose domain can't receive email (no mail server and no
 * address at all, confirmed against a healthy resolver). Free DNS check, one
 * per domain, cached for an hour. Lookup errors keep the address: a failing
 * resolver must never throw good addresses away.
 */
export async function deliverableEmails<T extends { email: string }>(items: T[]): Promise<T[]> {
  if (!items.length) return items;
  const domains = [...new Set(items.map((i) => i.email.split("@")[1]?.toLowerCase()).filter(Boolean))] as string[];
  const bad = new Set<string>();
  await Promise.all(
    domains.map(async (d) => {
      const hit = domainCache.get(d);
      if (hit && Date.now() - hit.at < 60 * 60_000) {
        if (hit.invalid) bad.add(d);
        return;
      }
      const sample = items.find((i) => i.email.toLowerCase().endsWith(`@${d}`))!.email;
      const r = await dnsEmailCheck(sample).catch(() => null);
      const invalid = r?.status === "invalid";
      domainCache.set(d, { at: Date.now(), invalid });
      if (invalid) bad.add(d);
    }),
  );
  return items.filter((i) => !bad.has(i.email.split("@")[1]?.toLowerCase() ?? ""));
}
