/**
 * Central plan configuration.
 *
 * M1: prices are intentionally null. The pricing section shows
 * "Private beta pricing coming soon". Do not add prices, discounts, annual
 * savings or "unlimited" allowances until the owner approves them (M3) and
 * entitlements are enforced server-side.
 */
export type PlanId = "starter" | "growth" | "agency";

export type Plan = {
  id: PlanId;
  name: string;
  summary: string;
  /** Owner-approved monthly price in USD. null = not decided. */
  monthlyPriceUsd: number | null;
  /** Illustrative feature groupings, not commitments. */
  groups: { title: string; items: string[] }[];
  highlight?: boolean;
};

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    summary: "For a solo consultant testing one offer in a few markets.",
    monthlyPriceUsd: null,
    groups: [
      {
        title: "Prospecting",
        items: ["Discovery by niche and location", "Opportunity Briefs with sources", "Email verification states"],
      },
      { title: "Outreach", items: ["One connected Gmail mailbox", "Short reviewed sequences", "Unified reply inbox"] },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    summary: "For small outbound teams running several campaigns at once.",
    monthlyPriceUsd: null,
    highlight: true,
    groups: [
      { title: "Everything in Starter, plus", items: ["More discovery and verification allowance", "Multiple mailboxes", "Saved lists and tags at scale"] },
      { title: "Control", items: ["Per-mailbox sending caps", "Workspace suppression list", "Usage ledger and exports"] },
    ],
  },
  {
    id: "agency",
    name: "Agency",
    summary: "For agencies managing prospecting for several clients.",
    monthlyPriceUsd: null,
    groups: [
      { title: "Everything in Growth, plus", items: ["Separate client workspaces", "Owner, admin, operator and viewer roles"] },
      { title: "Integrations (planned)", items: ["Scoped REST API and webhooks", "MCP access for AI clients"] },
    ],
  },
];

/** Demo-only allowance shown in the interactive demo. Not a plan limit. */
export const demoAllowance = {
  discoveryUnits: 200,
  verificationUnits: 100,
  aiUnits: 150,
} as const;

/** What one unit means, shown wherever usage appears. */
export const usageUnitDefinitions = {
  discoveryUnits: "1 unit per business returned by a search. Failed or cancelled pages are not charged.",
  verificationUnits: "1 unit per email address checked. Retries of the same check are not charged twice.",
  aiUnits: "1 unit per Opportunity Brief or draft generated.",
} as const;
