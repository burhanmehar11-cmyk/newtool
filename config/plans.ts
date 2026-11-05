/**
 * Central plan configuration.
 *
 * Prices are null until the owner approves them: the pricing section shows
 * "Price to be announced" and checkout shows the price set in Paddle. To go
 * live, create one monthly price per plan in Paddle, put its id in the env
 * var named by `priceEnv`, set `monthlyPriceUsd` to match, and flip
 * PRICING_LIVE.
 *
 * `monthlyGrant`: units added to the workspace each paid month (unused units
 * roll over). PROPOSED values — the owner should confirm them before launch.
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
  /** Env var holding this plan's Paddle price id (pri_…). */
  priceEnv: "PADDLE_PRICE_STARTER" | "PADDLE_PRICE_GROWTH" | "PADDLE_PRICE_AGENCY";
  /** Units added each paid month. PROPOSED, owner to confirm. */
  monthlyGrant: { discovery: number; verification: number; ai: number };
};

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    summary: "For a solo consultant testing one offer in a few markets.",
    monthlyPriceUsd: null,
    priceEnv: "PADDLE_PRICE_STARTER",
    monthlyGrant: { discovery: 1000, verification: 500, ai: 500 },
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
    priceEnv: "PADDLE_PRICE_GROWTH",
    monthlyGrant: { discovery: 3000, verification: 1500, ai: 1500 },
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
    priceEnv: "PADDLE_PRICE_AGENCY",
    monthlyGrant: { discovery: 8000, verification: 4000, ai: 4000 },
    groups: [
      { title: "Everything in Growth, plus", items: ["Team members with admin, member and viewer roles", "Read-only access for clients"] },
      { title: "Integrations", items: ["REST API and signed webhooks", "MCP access for your own AI agent"] },
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
