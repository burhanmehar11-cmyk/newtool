/**
 * End-to-end smoke test and screenshot capture for M1.
 *
 *   npm run build && npm run start   # in one terminal (port 3000 by default)
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Uses the Playwright installed on the machine (not a project dependency).
 * - Blocks and records every request that leaves the local server.
 * - Fails on console errors, page errors or horizontal overflow.
 * - Walks the full demo: search → research → evidence → draft → edit →
 *   verify → add to campaign → approve → simulated launch → simulated reply.
 * - Saves screenshots at 390, 768 and 1440px to SCREENSHOT_DIR (default ./screenshots).
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  console.error("Playwright is not installed. Install it globally or run `npx playwright install chromium`.");
  process.exit(2);
}
const { chromium } = playwright;

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR ?? "screenshots";
await mkdir(OUT, { recursive: true });

const failures = [];
const external = [];
const fail = (msg) => {
  failures.push(msg);
  console.error("✗", msg);
};
const ok = (msg) => console.log("✓", msg);

const browser = await chromium.launch();

async function newPage(context, label) {
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    external.push(url.href);
    return route.abort();
  });
  page.on("console", (m) => {
    if (m.type() === "error") fail(`[${label}] console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => fail(`[${label}] page error: ${e.message}`));
  return page;
}

async function noOverflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 1) fail(`[${label}] horizontal overflow of ${o}px`);
}

/* ---------------------------------------------------------- guided flow */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await newPage(ctx, "flow");

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.keyboard.press("Tab");
const skip = await page.evaluate(() => document.activeElement?.textContent?.trim());
if (skip === "Skip to content") ok("skip link is first focusable");
else fail(`first focusable was “${skip}”`);

// Product tour tabs are real interactions.
await page.getByRole("tab", { name: "Write outreach" }).click();
await page.getByRole("button", { name: "Another angle" }).click();
await page.getByRole("tab", { name: "Handle replies" }).click();
await page.getByText("Suggested reply").first().waitFor();
ok("product tour tabs switch content");

await page.goto(`${BASE}/demo/discover?q=${encodeURIComponent("Find dental clinics in Austin with a website and 30+ reviews.")}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelector("#f-niche")?.value === "dental");
ok("landing query parsed into filters (not run automatically)");
await page.getByRole("button", { name: "Run search (simulated)" }).click();
await page.getByText("Completed", { exact: true }).waitFor({ timeout: 15000 });
ok("search completed with paged results");

await page.getByRole("button", { name: "Bluebonnet Family Dentistry" }).click();
const drawer = page.getByRole("dialog");
await drawer.getByRole("button", { name: /^Research$/ }).click();
await drawer.getByText("Observed facts").waitFor({ timeout: 10000 });
await drawer.getByRole("button", { name: /asks visitors to call to schedule/ }).click();
await drawer.getByText("Collected", { exact: false }).first().waitFor();
ok("brief generated and evidence inspected");
await page.screenshot({ path: `${OUT}/demo-lead-brief-1440.png` });

await drawer.getByRole("tab", { name: "Draft" }).click();
await drawer.getByRole("button", { name: /Generate draft/ }).click();
const body = drawer.getByLabel("Body");
await body.waitFor();
await body.fill((await body.inputValue()).replace("Would a 15-minute call", "Would a short call"));
await drawer.getByRole("button", { name: "Save changes" }).click();
await drawer.getByText("v2 · edited by you").waitFor();
ok("draft generated and edited (v2)");

await drawer.getByRole("tab", { name: "Details" }).click();
await drawer.getByRole("button", { name: /Verify · 1 unit/ }).click();
await drawer.getByText("Valid", { exact: true }).waitFor({ timeout: 10000 });
ok("email verified (simulated)");

await drawer.getByRole("button", { name: "Add to campaign" }).first().click();
const addDialog = page.getByRole("dialog", { name: /Add 1 lead/ });
await addDialog.getByLabel("Campaign name").fill("Smoke test · Austin dental");
await addDialog.getByRole("button", { name: "Add to campaign" }).click();
await page.waitForURL("**/demo/campaigns");
await page.getByRole("heading", { name: "Smoke test · Austin dental" }).waitFor();
ok("added to a draft campaign explicitly");

await page.getByRole("button", { name: /Mailbox/ }).click();
await page.getByLabel(/Demo mailbox/).check();
await page.getByRole("button", { name: /Review & launch/ }).click();
await page.getByRole("button", { name: /Approve revision/ }).click();
await page.getByText(/Approved revision/).first().waitFor();
await page.screenshot({ path: `${OUT}/demo-campaign-review-1440.png` });
await page.getByRole("button", { name: "Simulate launch" }).click();
await page.getByText("Simulated reply received").waitFor({ timeout: 15000 });
ok("simulated launch produced a simulated reply");

await page.getByRole("link", { name: /Inbox/ }).first().click();
await page.waitForURL("**/demo/inbox");
await page.getByRole("button", { name: /Bluebonnet Family Dentistry/ }).first().click();
await page.getByText("Simulated reply", { exact: true }).first().waitFor();
await page.getByRole("button", { name: /Suggest a reply/ }).click();
await page.getByLabel("Your reply").waitFor();
ok("reply opened; suggestion stays a draft");
await page.screenshot({ path: `${OUT}/demo-inbox-1440.png` });

await page.getByRole("link", { name: "Overview" }).first().click();
await page.getByText("7/7").waitFor();
ok("guided checklist complete (7/7)");

// Dialog focus management: Escape closes the reset dialog.
await page.getByRole("button", { name: "Reset demo" }).first().click();
await page.getByRole("dialog", { name: "Reset the demo" }).waitFor();
await page.keyboard.press("Escape");
if ((await page.getByRole("dialog").count()) === 0) ok("Escape closes dialogs");
else fail("dialog did not close on Escape");

// Persistence across refresh.
await page.reload({ waitUntil: "networkidle" });
await page.getByText("7/7").waitFor();
ok("demo state persists across refresh");
const storage = await ctx.storageState();

/* ----------------------------------------------------- responsive pass */
const pages = [
  ["home", "/"],
  ["demo-overview", "/demo"],
  ["demo-discover", "/demo/discover"],
  ["demo-leads", "/demo/leads"],
  ["demo-campaigns", "/demo/campaigns"],
  ["demo-inbox", "/demo/inbox"],
  ["demo-settings", "/demo/settings"],
  ["demo-onboarding", "/demo/onboarding"],
  ["sign-in", "/sign-in"],
  ["legal-terms", "/legal/terms"],
  ["brand", "/brand"],
];
for (const width of [390, 768, 1440]) {
  const c = await browser.newContext({ viewport: { width, height: 900 }, storageState: storage });
  const p = await newPage(c, `${width}`);
  for (const [name, path] of pages) {
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(250);
    await noOverflow(p, `${name}@${width}`);
    await p.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: name === "home" && width !== 1440 ? false : name === "home" });
  }
  if (width === 390) {
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Open menu" }).click();
    await p.getByRole("dialog", { name: "Menu" }).waitFor();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/home-menu-390.png` });
    await p.keyboard.press("Escape");
    if ((await p.getByRole("dialog").count()) === 0) ok("mobile menu closes with Escape");
    else fail("mobile menu did not close");
  }
  await c.close();
  ok(`responsive pass at ${width}px`);
}

await browser.close();

if (external.length) fail(`external requests attempted: ${[...new Set(external)].join(", ")}`);
else ok("no request left the local server");

console.log(failures.length ? `\n${failures.length} failure(s)` : "\nAll smoke checks passed");
process.exit(failures.length ? 1 : 0);
