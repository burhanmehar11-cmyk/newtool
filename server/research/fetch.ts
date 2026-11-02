import "server-only";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import type { LookupAddress } from "node:dns";
import { checkFetchUrl, isPublicAddress } from "@/lib/research/net-policy";

/**
 * Fetches a public web page with SSRF protection:
 * - http/https on ports 80/443 only, no credentials, no local names;
 * - every resolved address is checked when the socket connects (so a DNS
 *   answer can't switch to a private address between check and use);
 * - redirects are followed manually and re-checked (max 3);
 * - size, time and content-type limits.
 */
export type FetchResult =
  | { ok: true; url: string; status: number; contentType: string; body: string }
  | { ok: false; url: string; reason: string };

const MAX_REDIRECTS = 3;

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: dns.LookupOptions, cb: LookupCb) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return cb(err);
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      const e = new Error(`Blocked: ${hostname} resolves to a non-public address`) as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return cb(e);
    }
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

function once(url: URL, userAgent: string, maxBytes: number, deadline: number, accept: string): Promise<
  { status: number; headers: http.IncomingHttpHeaders; body: Buffer } | { error: string }
> {
  return new Promise((resolve) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return resolve({ error: "time budget exceeded" });
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        headers: { "user-agent": userAgent, accept, "accept-encoding": "identity", "accept-language": "en" },
        lookup: guardedLookup as unknown as typeof dns.lookup,
        timeout: Math.min(remaining, 8000),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            chunks.push(c.subarray(0, Math.max(0, maxBytes - (size - c.length))));
            res.destroy();
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) });
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", () => resolve({ error: "connection error" }));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ error: "timed out" });
    });
    req.on("error", (e: NodeJS.ErrnoException) => resolve({ error: e.code === "EBLOCKED" ? "blocked: non-public address" : e.code ?? "network error" }));
    req.end();
  });
}

function decode(body: Buffer, contentType: string) {
  const charset = contentType.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export async function safeFetch(
  raw: string,
  opts: { userAgent: string; deadline: number; maxBytes?: number; accept?: string; allowTypes?: RegExp },
): Promise<FetchResult> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = checkFetchUrl(current);
    if (!check.ok) return { ok: false, url: current, reason: check.reason };
    const r = await once(check.url, opts.userAgent, opts.maxBytes ?? 512 * 1024, opts.deadline, opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1");
    if ("error" in r) return { ok: false, url: current, reason: r.error };
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      current = new URL(r.headers.location, check.url).toString();
      continue;
    }
    const contentType = String(r.headers["content-type"] ?? "");
    if (r.status >= 400) return { ok: false, url: current, reason: `HTTP ${r.status}` };
    if (opts.allowTypes && !opts.allowTypes.test(contentType)) return { ok: false, url: current, reason: `unsupported content type ${contentType || "unknown"}` };
    return { ok: true, url: check.url.toString(), status: r.status, contentType, body: decode(r.body, contentType) };
  }
  return { ok: false, url: current, reason: "too many redirects" };
}
