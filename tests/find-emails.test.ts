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
