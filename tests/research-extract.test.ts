import { describe, expect, it } from "vitest";
import { businessEmails, decodeCfEmail, extractPage, hiddenEmails, pickContactPages, pickFollowUpPages, visibleText } from "@/lib/research/extract";

const NOW = new Date("2026-11-02T00:00:00Z");
const home = `<!doctype html><html><head><title>Riverside Dental | Austin</title>
<script>var x = "© 2099 fake";</script></head>
<body>
<nav><a href="/contact-us">Contact</a> <a href="/new-patients">New patients</a> <a href="https://twitter.com/x">Twitter</a> <a href="#top">Top</a></nav>
<p>Please call our office to schedule your visit.</p>
<footer>&copy; 2017 Riverside Dental. All rights reserved. <a href="mailto:Hello@RiversideDental.example?subject=hi">Email us</a></footer>
</body></html>`;

describe("page extraction", () => {
  const p = extractPage(home, "https://www.riversidedental.example/", NOW);

  it("reads visible text only, ignoring scripts", () => {
    expect(visibleText(home)).not.toContain("2099");
    expect(p.copyrightYear).toMatchObject({ year: 2017 });
    expect(p.copyrightYear!.excerpt).toContain("© 2017 Riverside Dental");
  });

  it("detects a missing mobile viewport, phone-only booking and no online booking", () => {
    expect(p.viewport).toBe(false);
    expect(p.phoneOnly?.excerpt).toContain("call our office to schedule");
    expect(p.booking).toBeNull();
    expect(p.contactForm).toBe(false);
  });

  it("collects emails and same-site links", () => {
    expect(p.emails).toEqual(["hello@riversidedental.example"]);
    expect(p.links.map((l) => new URL(l.href).pathname)).toEqual(["/contact-us", "/new-patients"]);
    expect(pickFollowUpPages(p)).toEqual(["https://www.riversidedental.example/contact-us", "https://www.riversidedental.example/new-patients"]);
  });

  it("recognises booking platforms, PDF forms and contact forms", () => {
    const page = extractPage(
      `<meta name="viewport" content="width=device-width">
       <a href="https://calendly.com/riverside/visit">Book a visit</a>
       <a href="/docs/New-Patient-Form.pdf">New patient form (PDF)</a>
       <form><input type="email" name="e"><textarea></textarea></form>`,
      "https://riversidedental.example/new-patients",
      NOW,
    );
    expect(page.viewport).toBe(true);
    expect(page.booking).toMatchObject({ via: "Calendly" });
    expect(page.pdfForms?.excerpt).toContain("New-Patient-Form.pdf");
    expect(page.contactForm).toBe(true);
  });

  it("ignores impossible years and keeps the latest real one", () => {
    expect(extractPage("<p>© 2015–2024 Acme. Copyright 1890</p>", "https://a.example/", NOW).copyrightYear?.year).toBe(2024);
    expect(extractPage("<p>© 2031 Acme</p>", "https://a.example/", NOW).copyrightYear).toBeNull();
  });

  it("keeps only plausible business emails", () => {
    expect(businessEmails(["info@riverside.example", "dr.ana@riverside.example", "owner@gmail.com", "webmaster@agency.example"], "riverside.example")).toEqual([
      { email: "info@riverside.example", kind: "role" },
      { email: "dr.ana@riverside.example", kind: "named" },
      { email: "owner@gmail.com", kind: "named" },
    ]);
  });
});

describe("emails sites hide from simple readers", () => {
  it("decodes Cloudflare-protected addresses", () => {
    expect(decodeCfEmail("422a272e2e2d02212726233026272c36232e6c273a232f322e27")).toBe("hello@cedardental.example");
    expect(decodeCfEmail("zz")).toBeNull();
    expect(decodeCfEmail("4243")).toBeNull(); // decodes to junk, not an address
  });

  it("finds Cloudflare, structured-data and [at]/[dot] addresses", () => {
    const html = `<a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="422a272e2e2d02212726233026272c36232e6c273a232f322e27">[email&#160;protected]</a>
      <script type="application/ld+json">{"@type":"LocalBusiness","email":"mailto:Office@CedarDental.example"}</script>
      <span itemprop="email" content="care@cedardental.example"></span>`;
    const text = "Write to bookings [at] cedardental [dot] example, or meet us at the clinic.";
    expect(hiddenEmails(html, text).sort()).toEqual(["bookings@cedardental.example", "care@cedardental.example", "hello@cedardental.example", "office@cedardental.example"]);
  });

  it("doesn't read plain sentences with 'at' as addresses", () => {
    expect(hiddenEmails("", "Meet the team at Austin dot com events, open at 9.")).toEqual([]);
  });

  it("picks contact, impressum, about and privacy pages, best first", () => {
    const page = extractPage(
      `<a href="/privacy-policy">Privacy</a> <a href="/about-us">About us</a> <a href="/services">Services</a> <a href="/kontakt?ref=nav#form">Kontakt</a> <a href="/impressum">Impressum</a> <a href="/logo.png">Contact card</a>`,
      "https://cedar.example/",
      NOW,
    );
    expect(pickContactPages(page, 3)).toEqual(["https://cedar.example/kontakt", "https://cedar.example/impressum", "https://cedar.example/about-us"]);
  });

  it("keeps addresses on a related domain with the same name, and mailto role addresses", () => {
    const kept = businessEmails(
      ["team@influence-media.example", "hi@influencemedia.co.uk", "info@studio-partner.example", "bob@studio-partner.example", "you@example.com", "name@influencemedia.example", "logo@2x.png"],
      "influencemedia.example",
      ["info@studio-partner.example"],
    );
    expect(kept.map((e) => e.email)).toEqual(["team@influence-media.example", "hi@influencemedia.co.uk", "info@studio-partner.example"]);
  });
});
