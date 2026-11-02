import { describe, expect, it } from "vitest";
import { extractPage } from "@/lib/research/extract";
import { aggregatePages } from "@/lib/research/aggregate";
import { researchBusiness } from "@/lib/research/brief";
import type { Business } from "@/lib/domain/types";

const NOW = new Date("2026-11-02T00:00:00Z");
let n = 0;
const newId = () => `ev-${++n}`;

const home = extractPage(
  `<title>Riverside</title><p>Please call our office to schedule your visit.</p><a href="/contact">Contact</a><footer>© 2018 Riverside Dental</footer>`,
  "https://riverside.example/",
  NOW,
);
const contact = extractPage(`<h1>Contact</h1><p>Call 555-0100.</p><a href="/forms/new-patient-form.pdf">New patient form</a>`, "https://riverside.example/contact", NOW);

describe("aggregating researched pages", () => {
  const { signals, evidence } = aggregatePages("biz-1", [{ role: "home", page: home }, { role: "followup", page: contact }], NOW.toISOString(), newId);

  it("sets only what the pages show", () => {
    expect(signals).toEqual({
      siteCopyrightYear: 2018,
      mobileViewport: false,
      onlineBooking: false,
      intakeMethod: "pdf_forms",
      ownerReplyShare: null,
      hoursListed: null,
      photoCount: null,
      contactForm: false,
    });
    expect(evidence.map((e) => e.kind)).toEqual(["homepage", "contact_page", "forms_page"]);
    expect(evidence[0].excerpt).toContain("© 2018 Riverside Dental");
    expect(evidence[1].excerpt).toContain("call our office to schedule");
  });

  it("leaves booking Unknown when nothing on the site mentions it", () => {
    const quiet = extractPage(`<meta name="viewport" content="width=device-width"><p>Welcome</p>`, "https://quiet.example/", NOW);
    expect(aggregatePages("b", [{ role: "home", page: quiet }], NOW.toISOString(), newId).signals.onlineBooking).toBeNull();
  });

  it("feeds the brief rules, with every fact pointing at a fetched page", () => {
    const b: Business = {
      id: "biz-1", name: "Riverside Dental", niche: "dental", city: "Austin", region: "TX", address: null as unknown as string, phone: "", website: "https://riverside.example/",
      domain: "riverside.example", rating: null, reviewCount: null, distanceMi: 0, provider: { name: "OpenStreetMap", ref: "osm:node/1" }, collectedAt: NOW.toISOString(),
      signals, evidence, contacts: [],
    };
    const brief = researchBusiness(b, "web_design", NOW.toISOString());
    const urls = new Map(evidence.map((e) => [e.id, e.url]));
    expect(brief.facts.map((f) => f.text)).toEqual([
      "Website footer shows © 2018.",
      "Homepage has no mobile viewport tag.",
      "The website asks visitors to call to schedule. No online booking link was found on the pages checked.",
      "New-patient forms are offered as printable PDFs.",
      "No contact form. The site lists phone and email only.",
    ]);
    for (const f of brief.facts) for (const id of f.evidenceIds) expect(urls.get(id)).toMatch(/^https:\/\/riverside\.example\//);
    expect(brief.unknowns.join(" ")).toContain("Review responses: Unknown");
  });
});
