/**
 * Milestone and feature-availability flags.
 *
 * Marketing copy and in-app badges read from here so the product never
 * advertises a capability as available before it ships.
 *
 * - "demo":    works in the interactive demo with fixture data only
 * - "beta":    live for private-beta workspaces (M2)
 * - "live":    generally available (M3+)
 * - "planned": not built yet
 */
export type Availability = "demo" | "beta" | "live" | "planned";

export const CURRENT_MILESTONE = "M1" as const;

/** M2 flips this when real trial entitlements work. Controls "Start free" vs "Explore demo". */
export const SIGNUP_OPEN = false;

/** M3 flips this only when owner-approved prices and enforced entitlements pass. */
export const PRICING_LIVE = false;

export const features = {
  discovery: { label: "Business discovery", availability: "demo", target: "M2" },
  verification: { label: "Email verification", availability: "demo", target: "M2" },
  opportunityBrief: { label: "Opportunity Briefs", availability: "demo", target: "M2" },
  drafts: { label: "Evidence-based drafts", availability: "demo", target: "M2" },
  sequences: { label: "Sequences with approval", availability: "demo", target: "M2" },
  gmail: { label: "Gmail sending", availability: "planned", target: "M2" },
  replySync: { label: "Reply sync and classification", availability: "demo", target: "M2" },
  csv: { label: "CSV import and export", availability: "demo", target: "M2" },
  usage: { label: "Usage ledger", availability: "demo", target: "M2" },
  multiWorkspace: { label: "Client workspaces", availability: "planned", target: "M3" },
  roles: { label: "Team roles and permissions", availability: "planned", target: "M3" },
  billing: { label: "Billing", availability: "planned", target: "M3" },
  api: { label: "REST API and webhooks", availability: "planned", target: "M3" },
  mcp: { label: "MCP integration", availability: "planned", target: "M3" },
} as const satisfies Record<
  string,
  { label: string; availability: Availability; target: "M2" | "M3" }
>;

export type FeatureKey = keyof typeof features;

export function availabilityLabel(a: Availability, target?: string) {
  switch (a) {
    case "demo":
      return target ? `In demo · live in ${target === "M2" ? "private beta" : "launch"}` : "In demo";
    case "beta":
      return "Private beta";
    case "live":
      return "Available";
    case "planned":
      return "Planned";
  }
}
