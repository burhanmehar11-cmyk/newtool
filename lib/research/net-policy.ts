import { isIP } from "node:net";

/**
 * Network rules for fetching third-party websites (SSRF protection).
 * Only public internet addresses on standard web ports are allowed.
 * Every resolved address is checked at connect time (see server/research/fetch.ts),
 * which also defeats DNS rebinding.
 */

function v4ToInt(ip: string) {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function inV4Block(ip: string) {
  const n = v4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  // Embedded IPv4 (e.g. ::ffff:1.2.3.4)
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = v4ToInt(v4[1]);
    s = s.replace(v4[1], `${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`);
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  const parts = [...h, ...Array(Math.max(fill, 0)).fill("0"), ...t].map((x) => parseInt(x || "0", 16));
  return parts.length === 8 && parts.every((x) => Number.isFinite(x) && x >= 0 && x <= 0xffff) ? parts : null;
}

export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !inV4Block(ip);
  if (kind !== 6) return false;
  const p = expandV6(ip);
  if (!p) return false;
  if (p.every((x) => x === 0)) return false; // ::
  if (p.slice(0, 7).every((x) => x === 0) && p[7] === 1) return false; // ::1
  // IPv4-mapped / -compatible / NAT64 well-known prefix: judge the embedded IPv4.
  const embedded = `${p[6] >> 8}.${p[6] & 255}.${p[7] >> 8}.${p[7] & 255}`;
  if (p.slice(0, 5).every((x) => x === 0) && (p[5] === 0xffff || p[5] === 0)) return !inV4Block(embedded);
  if (p[0] === 0x64 && p[1] === 0xff9b) return !inV4Block(embedded);
  if ((p[0] & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((p[0] & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((p[0] & 0xff00) === 0xff00) return false; // multicast
  if (p[0] === 0x2001 && p[1] === 0x0db8) return false; // documentation
  return true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Syntactic checks before any DNS lookup. */
export function checkFetchUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "only http and https are allowed" };
  if (url.username || url.password) return { ok: false, reason: "credentials in URL" };
  if (url.port && !["80", "443"].includes(url.port)) return { ok: false, reason: "non-standard port" };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, reason: "local host name" };
  if (isIP(host) && !isPublicAddress(host)) return { ok: false, reason: "private address" };
  if (!isIP(host) && !host.includes(".")) return { ok: false, reason: "not a public host name" };
  url.hash = "";
  return { ok: true, url };
}
