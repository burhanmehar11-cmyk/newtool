import type { Business, BusinessSignals, Contact, EmailStatus, Evidence, NicheId } from "@/lib/domain/types";
import { cities, DEMO_NOW, namePrefixes, niches, streets, type CityDef, type NicheDef } from "./catalog";

/**
 * Deterministic generator for fictional sample businesses.
 *
 * - Every name is invented. Any resemblance to a real business is coincidental.
 * - Websites and emails use the reserved `.example` TLD (RFC 2606), so no
 *   demo address can reach a real inbox.
 * - Phone numbers use the 555-01XX range reserved for fiction.
 */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const DAY = 86_400_000;
const isoDaysBefore = (days: number, hourOffset = 0) =>
  new Date(Date.parse(DEMO_NOW) - days * DAY - hourOffset * 3_600_000).toISOString();

/** Pre-determined verification outcomes the demo "verifier" reveals. Never shown before a check. */
export const fixtureVerificationOutcome = new Map<string, Exclude<EmailStatus, "unverified">>();

function pick<T>(rnd: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rnd() * xs.length)];
}

function maybe<T>(rnd: () => number, pUnknown: number, value: () => T): T | null {
  return rnd() < pUnknown ? null : value();
}

type Override = {
  signals?: Partial<BusinessSignals>;
  rating?: number;
  reviewCount?: number;
  emailPrefix?: string;
  verification?: Exclude<EmailStatus, "unverified">;
};

function makeBusiness(niche: NicheDef, city: CityDef, index: number, name: string, ov?: Override): Business {
  const id = `biz_${niche.id}_${slugify(city.city)}_${index}`;
  const rnd = mulberry32(hash(id));
  const hasWebsite = ov ? true : rnd() > 0.14;
  const slug = slugify(name);
  const domain = hasWebsite ? `${slug}.example` : null;
  const website = domain ? `https://${domain}` : null;

  const reviewCount = ov?.reviewCount ?? Math.max(3, Math.round(niche.reviewScale * (0.08 + rnd() * 1.6)));
  const rating = ov?.rating ?? Math.round((3.7 + rnd() * 1.3) * 10) / 10;
  const collectedDaysAgo = 1 + Math.floor(rnd() * 12);
  const collectedAt = isoDaysBefore(collectedDaysAgo, Math.floor(rnd() * 9));

  const oldSite = rnd() < 0.45;
  const signals: BusinessSignals = {
    siteCopyrightYear: hasWebsite
      ? maybe(rnd, 0.15, () => (oldSite ? 2016 + Math.floor(rnd() * 5) : 2023 + Math.floor(rnd() * 4)))
      : null,
    mobileViewport: hasWebsite ? maybe(rnd, 0.1, () => (oldSite ? rnd() > 0.55 : true)) : null,
    onlineBooking: hasWebsite ? maybe(rnd, 0.2, () => rnd() > 0.55) : null,
    intakeMethod: hasWebsite ? maybe(rnd, 0.3, () => pick(rnd, ["phone_only", "online_form", "pdf_forms"] as const)) : null,
    ownerReplyShare: maybe(rnd, 0.1, () => {
      const sampled = Math.min(20, reviewCount);
      return { sampled, replied: Math.floor(sampled * (rnd() < 0.5 ? rnd() * 0.25 : 0.4 + rnd() * 0.6)) };
    }),
    hoursListed: maybe(rnd, 0.05, () => rnd() > 0.2),
    photoCount: maybe(rnd, 0.1, () => Math.floor(rnd() * (rnd() < 0.4 ? 8 : 60))),
    contactForm: hasWebsite ? maybe(rnd, 0.25, () => rnd() > 0.4) : null,
  };
  if (ov?.signals) Object.assign(signals, ov.signals);
  // Booking implies non-phone intake for internal consistency.
  if (signals.onlineBooking && signals.intakeMethod === "phone_only") signals.intakeMethod = "online_form";

  const street = pick(rnd, streets);
  const num = 100 + Math.floor(rnd() * 8800);
  const phone = `(${city.areaCode}) 555-01${String(Math.floor(rnd() * 100)).padStart(2, "0")}`;

  const evidence: Evidence[] = [];
  const ev = (kind: Evidence["kind"], label: string, url: string, excerpt: string, offsetH: number) => {
    const e: Evidence = {
      id: `${id}_ev_${kind}`,
      businessId: id,
      kind,
      label,
      url,
      collectedAt: new Date(Date.parse(collectedAt) - offsetH * 3_600_000).toISOString(),
      excerpt,
    };
    evidence.push(e);
    return e;
  };

  ev(
    "listing",
    "Business listing",
    `https://listings.example/place/${slug}-${slugify(city.city)}`,
    [
      `${name} · ${niche.label}`,
      `${rating.toFixed(1)} rating · ${reviewCount} reviews`,
      signals.hoursListed === null ? "Hours: not captured" : signals.hoursListed ? "Hours listed" : "Hours not listed",
      signals.photoCount === null ? "Photos: not captured" : `${signals.photoCount} photos`,
      website ? `Website: ${domain}` : "No website listed",
    ].join("\n"),
    0,
  );

  if (signals.ownerReplyShare) {
    ev(
      "reviews",
      "Recent reviews",
      `https://listings.example/place/${slug}-${slugify(city.city)}/reviews`,
      `Most recent ${signals.ownerReplyShare.sampled} reviews checked. Owner responses: ${signals.ownerReplyShare.replied}.`,
      0,
    );
  }

  let contactEvidence: Evidence | null = null;
  if (website) {
    const footer =
      signals.siteCopyrightYear !== null ? `© ${signals.siteCopyrightYear} ${name}. All rights reserved.` : "Footer: no copyright year shown.";
    const viewport =
      signals.mobileViewport === null
        ? ""
        : signals.mobileViewport
          ? '\n<meta name="viewport" content="width=device-width, initial-scale=1">'
          : "\nNo viewport meta tag in page head.";
    ev("homepage", "Homepage", `${website}/`, `${footer}${viewport}`, 1);

    const bookingLine =
      signals.onlineBooking === null
        ? "Booking: not determined from the pages checked."
        : signals.onlineBooking
          ? "“Book online” button links to a scheduling form."
          : `“Call ${phone} to schedule.” No online booking found on 3 pages checked.`;
    const formLine =
      signals.contactForm === null ? "" : signals.contactForm ? "\nContact form present." : "\nNo contact form; email and phone only.";
    contactEvidence = ev("contact_page", "Contact page", `${website}/contact`, `${bookingLine}${formLine}`, 1);

    if (signals.intakeMethod === "pdf_forms") {
      ev("forms_page", "Forms page", `${website}/forms`, `“Download and print our ${niche.intakeNoun} (PDF) and bring them to your visit.”`, 1);
    } else if (signals.intakeMethod === "phone_only") {
      ev("forms_page", "Forms page", `${website}/forms`, `“Please call our office to complete your ${niche.intakeNoun}.”`, 1);
    }
  }

  const contacts: Contact[] = [];
  // ~12% of websites expose no email at all.
  if (contactEvidence && (ov || rnd() > 0.12)) {
    const email = `${ov?.emailPrefix ?? pick(rnd, niche.emailPrefixes)}@${domain}`;
    const cid = `${id}_c0`;
    const r = rnd();
    fixtureVerificationOutcome.set(
      cid,
      ov?.verification ?? (r < 0.62 ? "valid" : r < 0.78 ? "catch_all" : r < 0.9 ? "unknown" : "invalid"),
    );
    contacts.push({
      id: cid,
      businessId: id,
      email,
      kind: "role",
      sourceEvidenceId: contactEvidence.id,
      status: "unverified",
      verifiedAt: null,
      verificationProvider: null,
    });
  }

  return {
    id,
    name,
    niche: niche.id,
    city: city.city,
    region: city.region,
    address: `${num} ${street}, ${city.city}, ${city.region}`,
    phone,
    website,
    domain,
    rating,
    reviewCount,
    distanceMi: Math.round((0.6 + rnd() * 18) * 10) / 10,
    provider: { name: "Demo fixtures", ref: `fx:${id}` },
    collectedAt,
    signals,
    evidence,
    contacts,
  };
}

/** Hand-picked names for the scenario shown in the hero and the guided demo. */
const featured: Partial<Record<`${NicheId}:${string}`, string[]>> = {
  "dental:Austin": [
    "Bluebonnet Family Dentistry",
    "Riverbend Dental Studio",
    "Lantern Smile Co.",
    "Cedar Arch Dental",
    "Juniper Hill Dental Care",
    "Stonegate Dental",
    "Tallgrass Family Dentistry",
    "Copperleaf Dental Studio",
    "Willow Creek Dental",
    "Kestrel Dental Care",
    "Meridian Smile Co.",
  ],
};

const featuredOverrides: Record<string, Override> = {
  "biz_dental_austin_0": {
    rating: 4.8,
    reviewCount: 214,
    emailPrefix: "hello",
    verification: "valid",
    signals: {
      siteCopyrightYear: 2018,
      mobileViewport: false,
      onlineBooking: false,
      intakeMethod: "pdf_forms",
      ownerReplyShare: { replied: 3, sampled: 20 },
      hoursListed: true,
      photoCount: 46,
      contactForm: false,
    },
  },
  "biz_dental_austin_1": {
    rating: 4.6,
    reviewCount: 97,
    emailPrefix: "frontdesk",
    verification: "catch_all",
    signals: {
      siteCopyrightYear: 2024,
      mobileViewport: true,
      onlineBooking: true,
      intakeMethod: "online_form",
      ownerReplyShare: { replied: 1, sampled: 20 },
      hoursListed: false,
      photoCount: 4,
      contactForm: true,
    },
  },
  "biz_dental_austin_2": {
    rating: 4.4,
    reviewCount: 61,
    emailPrefix: "office",
    verification: "valid",
    signals: {
      siteCopyrightYear: null,
      mobileViewport: true,
      onlineBooking: false,
      intakeMethod: "phone_only",
      ownerReplyShare: { replied: 14, sampled: 20 },
      hoursListed: true,
      photoCount: 22,
      contactForm: null,
    },
  },
};

function generate(): Business[] {
  const all: Business[] = [];
  for (const niche of niches) {
    for (const city of cities) {
      const key = `${niche.id}:${city.city}` as const;
      const rnd = mulberry32(hash(key));
      const count = featured[key]?.length ?? 7 + Math.floor(rnd() * 6);
      const used = new Set<string>();
      for (let i = 0; i < count; i++) {
        let name = featured[key]?.[i];
        while (!name || used.has(name)) {
          name = `${pick(rnd, namePrefixes)} ${pick(rnd, niche.suffixes)}`;
        }
        used.add(name);
        const id = `biz_${niche.id}_${slugify(city.city)}_${i}`;
        all.push(makeBusiness(niche, city, i, name, featuredOverrides[id]));
      }
    }
  }
  return all;
}

export const businesses: Business[] = generate();
export const businessById = new Map(businesses.map((b) => [b.id, b]));

export function getBusiness(id: string): Business {
  const b = businessById.get(id);
  if (!b) throw new Error(`Unknown demo business ${id}`);
  return b;
}
