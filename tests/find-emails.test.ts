import { describe, expect, it } from "vitest";
import { findEmailsOnWebsite } from "@/server/research/find-emails";
import { trustedEmails } from "@/server/discovery-store";

type Site = Record<string, { status: number; body?: string }>;
/** A fake website: path → response. Records which pages were fetched. */
function fakeSite(pages: Site) {
  const visited: string[] = [];
  const fetcher = (async (url: string) => {
    const u = new URL(url);
    visited.push(u.pathname);
    const p = pages[u.pathname];
    if (!p) return { ok: false, reason: "HTTP 404" };
    if (p.status !== 200) return { ok: false, reason: `HTTP ${p.status}` };
    return { ok: true, url: u.toString(), body: p.body ?? "", contentType: "text/html" };
  }) as never;
  return { fetcher, visited };
}

const home = (inner: string) => `<html><head><title>Cedar Dental | Austin dentist</title></head><body>${inner}</body></html>`;

describe("finding public emails on a business website", () => {
  it("finds an email on the homepage and doesn't read further", async () => {
    const s = fakeSite({ "/": { status: 200, body: home('Call us or email <a href="mailto:hello@cedardental.example">hello@cedardental.example</a> <a href="/contact">Contact</a>') } });
    const r = await findEmailsOnWebsite("https://www.cedardental.example/", { fetcher: s.fetcher });
    expect(r.status).toBe("found");
    expect(r.emails).toEqual([{ email: "hello@cedardental.example", kind: "role", url: "https://www.cedardental.example/" }]);
    expect(r.siteName).toBe("Cedar Dental");
    expect(s.visited).not.toContain("/contact");
  });

  it("checks the contact page when the homepage shows none", async () => {
    const s = fakeSite({
      "/": { status: 200, body: home('<a href="/services">Services</a> <a href="/contact-us">Contact us</a>') },
      "/contact-us": { status: 200, body: home("Write to dr.lee@cedardental.example or office@cedardental.example") },
    });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher });
    expect(r.status).toBe("found");
    expect(r.emails.map((e) => e.email)).toEqual(["office@cedardental.example", "dr.lee@cedardental.example"]); // role addresses first
    expect(r.emails[0].url).toBe("https://cedardental.example/contact-us");
  });

  it("ignores addresses on other businesses' domains (e.g. the web designer's)", async () => {
    const s = fakeSite({ "/": { status: 200, body: home("Site by support@webagency.example. Questions: cedar.dental@gmail.com") } });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher });
    expect(r.emails.map((e) => e.email)).toEqual(["cedar.dental@gmail.com"]);
  });

  it("respects robots.txt and reports when nothing is shown", async () => {
    const blocked = fakeSite({ "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /" }, "/": { status: 200, body: home("hello@x.example") } });
    expect((await findEmailsOnWebsite("https://x.example", { fetcher: blocked.fetcher })).status).toBe("blocked");
    expect(blocked.visited).toEqual(["/robots.txt"]);
    const none = fakeSite({ "/": { status: 200, body: home("Call us at 555-0100") } });
    expect(await findEmailsOnWebsite("https://y.example", { fetcher: none.fetcher })).toMatchObject({ status: "none", emails: [] });
    const down = fakeSite({ "/robots.txt": { status: 503 } });
    expect((await findEmailsOnWebsite("https://z.example", { fetcher: down.fetcher })).status).toBe("failed");
  });
});

describe("harder websites", () => {
  it("decodes a Cloudflare-protected address on the contact page", async () => {
    const s = fakeSite({
      "/": { status: 200, body: home('<a href="/about">About</a> <a href="/contact">Contact</a>') },
      "/contact": { status: 200, body: home('<a class="__cf_email__" data-cfemail="422a272e2e2d02212726233026272c36232e6c273a232f322e27">[email protected]</a>') },
      "/about": { status: 200, body: home("We are a family practice.") },
    });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher });
    expect(r.emails.map((e) => e.email)).toEqual(["hello@cedardental.example"]);
  });

  it("tries /contact when the menu links to nothing readable (built by scripts)", async () => {
    const s = fakeSite({
      "/": { status: 200, body: home('<div id="app"></div>') },
      "/contact": { status: 200, body: home("Email hello@cedardental.example") },
    });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher });
    expect(r.status).toBe("found");
    expect(s.visited).toEqual(expect.arrayContaining(["/contact", "/contact-us"]));
  });

  it("accepts the business's address on a related domain (influence-media vs influencemedia)", async () => {
    const s = fakeSite({ "/": { status: 200, body: home('<a href="mailto:team@influence-media.example">Email us</a>') } });
    const r = await findEmailsOnWebsite("https://influencemedia.example", { fetcher: s.fetcher });
    expect(r.emails.map((e) => e.email)).toEqual(["team@influence-media.example"]);
  });
});

describe("finding more (max mode)", () => {
  it("decodes addresses written as HTML codes", async () => {
    const s = fakeSite({ "/": { status: 200, body: home("Email: info&#64;cedardental&#46;example or &#x6f;ffice&#x40;cedardental.example") } });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher });
    expect(r.emails.map((e) => e.email).sort()).toEqual(["info@cedardental.example", "office@cedardental.example"]);
  });

  it("reads addresses kept in page data (site builders), without gluing escapes onto them", async () => {
    const s = fakeSite({ "/": { status: 200, body: home('<div id="root"></div><script>window.__DATA__={"footer":"<p>\\u003cb\\u003eWrite to\\ninfo\\u0040cedardental.example</p>"}</script>') } });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher });
    expect(r.emails.map((e) => e.email)).toEqual(["info@cedardental.example"]);
  });

  it("asks for large pages in full (the address is often in the footer)", async () => {
    const sizes: number[] = [];
    const fetcher = (async (url: string, o: { maxBytes?: number }) => {
      if (!url.endsWith("robots.txt")) sizes.push(o.maxBytes ?? 0);
      return url.endsWith("robots.txt") ? { ok: false, reason: "HTTP 404" } : { ok: true, url, body: home(`${"x".repeat(700_000)} hello@cedardental.example`), contentType: "text/html" };
    }) as never;
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher });
    expect(r.status).toBe("found");
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(2 * 1024 * 1024);
  });

  it("finds the contact page through the sitemap", async () => {
    const s = fakeSite({
      "/": { status: 200, body: home("Welcome") },
      "/sitemap.xml": { status: 200, body: "<urlset><url><loc>https://cedardental.example/</loc></url><url><loc>https://cedardental.example/get-in-touch</loc></url><url><loc>https://other.example/contact</loc></url></urlset>" },
      "/get-in-touch": { status: 200, body: home("Reach us at frontdesk@cedardental.example") },
    });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher });
    expect(r.emails.map((e) => e.email)).toEqual(["frontdesk@cedardental.example"]);
    expect(r.emails[0].url).toBe("https://cedardental.example/get-in-touch");
  });

  it("tries the www address when the bare one doesn't answer", async () => {
    const fetcher = (async (url: string) => {
      const u = new URL(url);
      if (u.hostname !== "www.cedardental.example") return { ok: false, reason: "timed out" };
      if (u.pathname === "/robots.txt") return { ok: false, reason: "HTTP 404" };
      return { ok: true, url, body: home("hello@cedardental.example"), contentType: "text/html" };
    }) as never;
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher });
    expect(r.emails.map((e) => e.email)).toEqual(["hello@cedardental.example"]);
  });

  it("accepts an address matching the business's name, and any address a contact page links to", async () => {
    const s = fakeSite({
      "/": { status: 200, body: home('Questions? hello@cedarfamilydentistry.example · <a href="/contact">Contact</a>') },
    });
    const named = await findEmailsOnWebsite("https://cedardental.example", { fetcher: s.fetcher, businessName: "Cedar Family Dentistry Ltd" });
    expect(named.emails.map((e) => e.email)).toEqual(["hello@cedarfamilydentistry.example"]);

    const c = fakeSite({
      "/": { status: 200, body: home('Site by bob@webdesigner.example <a href="/contact">Contact</a>') },
      "/contact": { status: 200, body: home('<a href="mailto:dr.ana@anasmilecare.example">Email Dr Ana</a> <a href="mailto:help@wix.com">Wix help</a>') },
    });
    const r = await findEmailsOnWebsite("https://cedardental.example", { fetcher: c.fetcher });
    expect(r.emails.map((e) => e.email)).toEqual(["dr.ana@anasmilecare.example"]); // not the designer's, not the site builder's
  });
});

describe("emails sent back when saving", () => {
  it("keeps only emails found on the business's own site", () => {
    const out = trustedEmails(
      [
        { email: "hello@cedardental.example", kind: "role", url: "https://www.cedardental.example/contact" },
        { email: "ceo@other.example", kind: "named", url: "https://www.cedardental.example/" },
        { email: "hello@cedardental.example", kind: "role", url: "https://evil.example/cedardental.example" },
        { email: "cedar@gmail.com", kind: "named", url: "https://cedardental.example/" },
      ],
      "cedardental.example",
    );
    expect(out.map((e) => `${e.email} ${new URL(e.url).hostname}`)).toEqual(["hello@cedardental.example www.cedardental.example", "cedar@gmail.com cedardental.example"]);
  });
});
