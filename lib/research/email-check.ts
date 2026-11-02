/**
 * Free email check from DNS alone. It can prove an address can't receive
 * mail (no mail servers, or a "null MX"), but it can't prove a mailbox
 * exists, so the best result is "unknown", never "valid".
 */
export type DnsCheckInput = {
  syntaxOk: boolean;
  mx: { exchange: string; priority: number }[] | "none" | "error";
  hasAddress: boolean | "error"; // A/AAAA fallback (RFC 5321 implicit MX)
  /** A known mail domain resolved fine, so "not found" answers can be trusted. */
  resolverHealthy?: boolean;
};

export type DnsCheckResult = { status: "invalid" | "unknown"; detail: string } | { status: "error"; detail: string };

export function classifyDns(i: DnsCheckInput): DnsCheckResult {
  if (!i.syntaxOk) return { status: "invalid", detail: "Not a valid email address." };
  if (i.mx === "error") return { status: "error", detail: "Couldn't look up the domain's mail servers. Try again later." };
  if (Array.isArray(i.mx) && i.mx.length) {
    // RFC 7505 null MX: the domain explicitly accepts no email.
    if (i.mx.length === 1 && (i.mx[0].exchange === "" || i.mx[0].exchange === ".")) return { status: "invalid", detail: "The domain says it accepts no email (null MX)." };
    return { status: "unknown", detail: "The domain has mail servers. Whether this mailbox exists isn't confirmed." };
  }
  if (i.hasAddress === "error") return { status: "error", detail: "Couldn't look up the domain. Try again later." };
  if (i.hasAddress) return { status: "unknown", detail: "No mail servers listed; mail may go to the domain's web server. Mailbox not confirmed." };
  // Only call an address invalid when DNS itself is demonstrably working.
  if (i.resolverHealthy === false) return { status: "error", detail: "Email checks are unavailable right now (DNS isn't responding). Try again later." };
  return { status: "invalid", detail: "The domain has no mail servers, so it can't receive email." };
}

export const EMAIL_SYNTAX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
