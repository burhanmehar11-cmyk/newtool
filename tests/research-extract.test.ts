import { describe, expect, it } from "vitest";
import { businessEmails, extractPage, pickFollowUpPages, visibleText } from "@/lib/research/extract";

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
