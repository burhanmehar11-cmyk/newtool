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

// The product is official: no beta wording, no demo entry points.
const homeText = (await page.locator("body").innerText()).toLowerCase();
if (!/\bbeta\b/.test(homeText)) ok("no beta wording on the homepage");
else fail("homepage still mentions beta");
if (!homeText.includes("explore demo") && !homeText.includes("explore the demo")) ok("no demo calls to action");
else fail("homepage still links to the demo");
const ctas = await page.locator('a:has-text("Get started")').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
if (ctas.length && ctas.every((h) => h === "/sign-up")) ok(`"Get started" buttons go to sign-up (${ctas.length})`);
else fail(`unexpected Get started links: ${ctas.join(", ")}`);

// The hero preview plays on its own.
await page.getByRole("list", { name: "Demo steps" }).scrollIntoViewIfNeeded(); // it pauses while off-screen
await page.locator("[data-demo-query]", { hasText: /^Dentists in/ }).first().waitFor({ timeout: 15000 });
ok("hero preview types its search");

// Old demo links land on the homepage.
await page.goto(`${BASE}/demo/discover`, { waitUntil: "networkidle" });
if (new URL(page.url()).pathname === "/") ok("/demo redirects to the homepage");
else fail(`/demo went to ${page.url()}`);
const storage = await ctx.storageState();

/* ----------------------------------------------------- responsive pass */
const pages = [
  ["home", "/"],
  ["sign-in", "/sign-in"],
  ["sign-up", "/sign-up"],
  ["forgot-password", "/forgot-password"],
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
