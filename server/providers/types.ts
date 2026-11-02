/**
 * Provider adapter contracts.
 *
 * M1 ships only these interfaces and a configuration-status helper. No real
 * provider is called. M2 implements ONE discovery provider and ONE
 * verification provider behind these contracts, after checking each
 * provider's current official documentation, terms, retention/export rules,
 * attribution requirements and pricing units (see docs/DECISIONS.md).
 *
 * Demo adapters live in /demo and are never imported by production code.
 */
import type {
  Business,
  DiscoveryFilters,
  EmailStatus,
  Evidence,
  OfferProfile,
  OpportunityBrief,
} from "@/lib/domain/types";

/* ----------------------------------------------------------------- shared */

export type ProviderErrorCode =
  | "not_configured" // credentials missing: surface a configuration state, never fake results
  | "unauthorized"
  | "rate_limited"
  | "quota_exceeded"
  | "invalid_request"
  | "timeout"
  | "upstream_error"
  | "unsupported";

export type ProviderError = {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  /** Seconds to wait before retrying, when the provider says so. */
  retryAfter?: number;
  provider: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: ProviderError };

export type Page<T> = { items: T[]; nextCursor: string | null };

/** Every billable provider call reports usage so the ledger can reconcile actual cost. */
export type UsageEvent = {
  kind: "discovery" | "enrichment" | "verification" | "ai_tokens" | "mailbox";
  units: number;
  provider: string;
  /** Idempotency key: retries with the same key must not be charged twice. */
  idempotencyKey: string;
  occurredAt: string;
};

export type RateLimit = { requestsPerMinute: number; concurrency: number };

export type ProviderMeta = {
  name: string;
  /** Fields the provider's terms let us store and export. The UI must respect this. */
  storableFields: string[];
  attributionRequired: boolean;
  rateLimit: RateLimit;
};

/* -------------------------------------------------------------- discovery */

/** Discovery returns business facts only. It is not assumed to return emails. */
export type DiscoveredBusiness = Omit<Business, "contacts" | "evidence" | "signals"> & {
  attribution?: string;
};

export interface BusinessDiscoveryProvider {
  meta: ProviderMeta;
  search(
    filters: DiscoveryFilters,
    opts: { cursor?: string | null; idempotencyKey: string; signal?: AbortSignal },
  ): Promise<Result<Page<DiscoveredBusiness> & { usage: UsageEvent[] }>>;
}

/* ------------------------------------------------------------- enrichment */

export interface ContactEnrichmentProvider {
  meta: ProviderMeta;
  /** Crawl permitted public pages (bounded, SSRF-protected) and return evidence plus role contacts. */
  enrich(
    business: DiscoveredBusiness,
    opts: { maxPages: number; maxBytesPerPage: number; timeoutMs: number; idempotencyKey: string; signal?: AbortSignal },
  ): Promise<Result<{ evidence: Evidence[]; emails: { email: string; sourceEvidenceId: string }[]; signals: Business["signals"]; usage: UsageEvent[] }>>;
}

/* ----------------------------------------------------------- verification */

export interface EmailVerificationProvider {
  meta: ProviderMeta;
  /** MX existence alone must map to "unknown", never "valid". */
  verify(email: string, opts: { idempotencyKey: string }): Promise<Result<{ status: Exclude<EmailStatus, "unverified">; checkedAt: string; usage: UsageEvent[] }>>;
}

/* --------------------------------------------------------------------- AI */

export type BriefInput = { business: Business; offer: OfferProfile };

export interface AIProvider {
  meta: ProviderMeta & { model: string };
  /** Output must validate against the brief schema; source content is untrusted data. */
  synthesizeBrief(input: BriefInput, opts: { idempotencyKey: string }): Promise<Result<{ brief: OpportunityBrief; usage: UsageEvent[] }>>;
  draftEmail(
    input: BriefInput & { brief: OpportunityBrief; variant: number },
    opts: { idempotencyKey: string },
  ): Promise<Result<{ subject: string; body: string; factIds: string[]; usage: UsageEvent[] }>>;
  classifyReply(body: string, opts: { idempotencyKey: string }): Promise<Result<{ classification: "interested" | "not_interested" | "out_of_office" | "unclassified"; confidence: "high" | "medium" | "low"; returnDate: string | null; usage: UsageEvent[] }>>;
}

/* ---------------------------------------------------------------- mailbox */

export type OutboundMessage = {
  /** Unique per (enrollment, step). Used to reconcile ambiguous sends. */
  dispatchId: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  listUnsubscribe: { mailto?: string; url?: string };
};

export interface MailboxProvider {
  meta: ProviderMeta;
  send(accountId: string, msg: OutboundMessage): Promise<Result<{ providerMessageId: string; providerThreadId: string; acceptedAt: string }>>;
  /** Look up a dispatch after a timeout instead of blindly resending. */
  findByDispatchId(accountId: string, dispatchId: string): Promise<Result<{ providerMessageId: string } | null>>;
  syncInbound(accountId: string, checkpoint: string | null): Promise<Result<{ messages: { providerMessageId: string; providerThreadId: string; from: string; receivedAt: string; subject: string; text: string; html: string | null }[]; checkpoint: string }>>;
}

/* ---------------------------------------------------------------- billing */

export interface BillingProvider {
  meta: { name: string };
  createCheckout(workspaceId: string, planId: string): Promise<Result<{ url: string }>>;
  createPortal(workspaceId: string): Promise<Result<{ url: string }>>;
  /** Signature verification happens before any entitlement change. */
  verifyWebhook(rawBody: string, signature: string): Result<{ eventId: string; type: string; payload: unknown }>;
}
