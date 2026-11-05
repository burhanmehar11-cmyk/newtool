import type {
  Business,
  Confidence,
  Fact,
  FitLevel,
  OfferType,
  Opportunity,
  OpportunityBrief,
  RubricItem,
} from "@/lib/domain/types";
import { nicheWords } from "@/lib/discovery/niches";

/**
 * Rule-based research synthesis shared by the demo and the product. Builds
 * an Opportunity Brief from collected signals with fixed templates; no model
 * is called. The AI step (M2 step 4) produces the same structured shape,
 * validated by `opportunityBriefSchema` before it is stored.
 *
 * Rules enforced here and expected from the AI provider:
 * - Facts are observations tied to evidence IDs.
 * - Opportunities are inferences and reference fact IDs.
 * - Missing signals become Unknowns. They never count toward fit.
 */

const ev = (b: Business, kind: string) => b.evidence.find((e) => e.kind === kind)?.id;

function collectFacts(b: Business) {
  const n = nicheWords(b.niche);
  const s = b.signals;
  const facts: (Fact & { key: string })[] = [];
  const unknowns: string[] = [];
  const add = (key: string, text: string, evidenceKind: string) => {
    const id = ev(b, evidenceKind);
    if (id) facts.push({ id: `${b.id}_f_${key}`, key, text, evidenceIds: [id] });
  };

  if (b.rating !== null && b.reviewCount !== null)
    add("listing", `Listing shows a ${b.rating.toFixed(1)} rating from ${b.reviewCount} reviews.`, "listing");
  if (!b.website) add("no_website", "No website is linked from the business listing.", "listing");

  if (b.website) {
    if (s.siteCopyrightYear !== null) add("copyright", `Website footer shows © ${s.siteCopyrightYear}.`, "homepage");
    else unknowns.push("Website age: Unknown. No copyright year was found.");

    if (s.mobileViewport === true) add("viewport", "Homepage declares a mobile viewport.", "homepage");
    else if (s.mobileViewport === false) add("no_viewport", "Homepage has no mobile viewport tag.", "homepage");
    else unknowns.push("Mobile setup: Unknown. The homepage head was not captured.");

    if (s.onlineBooking === true) add("booking", "Contact page links to an online booking form.", "contact_page");
    else if (s.onlineBooking === false)
      add("no_booking", "The website asks visitors to call to schedule. No online booking link was found on the pages checked.", "contact_page");
    else unknowns.push("Online booking: Unknown. It may exist on a page that was not checked.");

    if (s.intakeMethod === "pdf_forms") add("pdf_intake", `${cap(n.intakeNoun)} are offered as printable PDFs.`, "forms_page");
    else if (s.intakeMethod === "phone_only") add("phone_intake", `${cap(n.intakeNoun)} are completed by phone.`, "forms_page");
    else if (s.intakeMethod === "online_form") add("online_intake", "Intake is handled through an online form.", "contact_page");
    else unknowns.push(`How ${n.intakeNoun} are handled: Unknown.`);

    if (s.contactForm === false) add("no_form", "No contact form. The site lists phone and email only.", "contact_page");
    else if (s.contactForm === null) unknowns.push("Contact form: Unknown.");
  }

  if (s.ownerReplyShare)
    add(
      "owner_replies",
      `Owner responded to ${s.ownerReplyShare.replied} of the ${s.ownerReplyShare.sampled} most recent reviews.`,
      "reviews",
    );
  else unknowns.push("Review responses: Unknown. Recent reviews were not sampled.");

  if (s.hoursListed === false) add("hours_missing", "Business hours are not listed on the listing.", "listing");
  else if (s.hoursListed === null) unknowns.push("Listed hours: Unknown.");

  if (s.photoCount !== null) add("photos", `Listing has ${s.photoCount} photos.`, "listing");
  else unknowns.push("Listing photos: Unknown.");

  unknowns.push("Named decision-maker: Unknown. Locenti does not guess names.");
  unknowns.push("Current vendors, budget and revenue: Unknown. Not observable from public pages.");

  return { facts, unknowns };
}

type Criterion = {
  id: string;
  criterion: string;
  weight: number;
  met: boolean | null;
  note: string;
  factKeys: string[];
  opportunity?: { text: string; relevance: string };
};

function criteria(b: Business, offer: OfferType): Criterion[] {
  const s = b.signals;
  const n = nicheWords(b.niche);
  const hasSite = !!b.website;
  const dated = hasSite ? (s.siteCopyrightYear === null ? null : s.siteCopyrightYear <= 2022) : null;
  const noViewport = hasSite ? (s.mobileViewport === null ? null : !s.mobileViewport) : null;
  const noBooking = hasSite ? (s.onlineBooking === null ? null : !s.onlineBooking) : null;
  const paperIntake = hasSite ? (s.intakeMethod === null ? null : s.intakeMethod !== "online_form") : null;
  const noForm = hasSite ? (s.contactForm === null ? null : !s.contactForm) : null;
  const lowReplies = s.ownerReplyShare ? s.ownerReplyShare.replied / Math.max(1, s.ownerReplyShare.sampled) < 0.25 : null;
  const hoursMissing = s.hoursListed === null ? null : !s.hoursListed;
  const fewPhotos = s.photoCount === null ? null : s.photoCount < 10;
  const active = (min: number) => (b.reviewCount === null ? null : b.reviewCount >= min);

  const c = {
    noWebsite: {
      id: "no_website",
      criterion: "No website listed",
      weight: 5,
      met: !hasSite,
      note: "Checked on the business listing.",
      factKeys: ["no_website"],
      opportunity: {
        text: `${cap(n.customerNoun)} searching online have no site to compare services or contact the business.`,
        relevance: "A first website is the clearest possible fit for a web design offer.",
      },
    },
    dated: {
      id: "dated",
      criterion: "Site may be dated (copyright 2022 or earlier)",
      weight: 3,
      met: dated,
      note: "A copyright year is a weak signal. Sites are often updated without changing it.",
      factKeys: ["copyright"],
      opportunity: {
        text: "The website may not reflect current services or branding.",
        relevance: "A refresh conversation can start from what the site shows today.",
      },
    },
    noViewport: {
      id: "no_viewport",
      criterion: "No mobile viewport tag",
      weight: 3,
      met: noViewport,
      note: "Without it, phones usually render a shrunken desktop page.",
      factKeys: ["no_viewport"],
      opportunity: {
        text: "The site may be hard to read and tap on phones.",
        relevance: "Mobile usability is concrete and easy to show in a screenshot.",
      },
    },
    noBooking: {
      id: "no_booking",
      criterion: "No online booking found",
      weight: offer === "ai_automation" ? 3 : 2,
      met: noBooking,
      note: "Three pages were checked. Booking may exist elsewhere.",
      factKeys: ["no_booking"],
      opportunity: {
        text: `${cap(n.customerNoun)} may need to call during office hours to book.`,
        relevance:
          offer === "ai_automation"
            ? "Booking requests are a natural first workflow to automate."
            : "Online booking is a tangible improvement to offer alongside a site update.",
      },
    },
    paperIntake: {
      id: "paper_intake",
      criterion: "Paper or phone-based intake",
      weight: 3,
      met: paperIntake,
      note: "Based on the forms or contact page.",
      factKeys: ["pdf_intake", "phone_intake"],
      opportunity: {
        text: `Front-desk staff may be re-typing ${n.intakeNoun} by hand.`,
        relevance: "Digital intake is a contained automation project with a clear before and after.",
      },
    },
    noForm: {
      id: "no_form",
      criterion: "No contact form",
      weight: 1,
      met: noForm,
      note: "Phone and email only.",
      factKeys: ["no_form"],
      opportunity: {
        text: "After-hours enquiries may go unanswered until the next business day.",
        relevance: "A simple form with routing is a low-risk first step.",
      },
    },
    lowReplies: {
      id: "low_replies",
      criterion: "Owner responds to fewer than 25% of recent reviews",
      weight: 3,
      met: lowReplies,
      note: "Sample of the most recent reviews only.",
      factKeys: ["owner_replies"],
      opportunity: {
        text: "Recent reviewers mostly have not received a reply.",
        relevance: "Review response is a visible, ongoing task a local SEO retainer can own.",
      },
    },
    hoursMissing: {
      id: "hours_missing",
      criterion: "Hours missing from listing",
      weight: 2,
      met: hoursMissing,
      note: "As shown on the listing when collected.",
      factKeys: ["hours_missing"],
      opportunity: {
        text: "People checking the listing cannot see when the business is open.",
        relevance: "Completing the profile is a quick, demonstrable win.",
      },
    },
    fewPhotos: {
      id: "few_photos",
      criterion: "Fewer than 10 listing photos",
      weight: 2,
      met: fewPhotos,
      note: "Photo count at collection time.",
      factKeys: ["photos"],
      opportunity: {
        text: "The listing shows little of the space, team or work.",
        relevance: "Photo updates are easy to propose and to show progress on.",
      },
    },
    hasSite: {
      id: "has_site",
      criterion: "Has a website to build on",
      weight: 1,
      met: hasSite,
      note: "Needed for on-site local SEO work.",
      factKeys: [],
    },
    active: {
      id: "active",
      criterion: offer === "ai_automation" ? "Enough activity to benefit (50+ reviews)" : "Actively operating (25+ reviews)",
      weight: offer === "ai_automation" ? 2 : 1,
      met: active(offer === "ai_automation" ? 50 : 25),
      note: "Review volume shows the business is operating. It is not a measure of revenue or performance.",
      factKeys: ["listing"],
    },
  } satisfies Record<string, Criterion>;

  switch (offer) {
    case "web_design":
      return hasSite ? [c.dated, c.noViewport, c.noBooking, c.noForm, c.active] : [c.noWebsite, c.active];
    case "local_seo":
      return [c.lowReplies, c.hoursMissing, c.fewPhotos, c.hasSite, c.active];
    case "ai_automation":
      return [c.noBooking, c.paperIntake, c.noForm, c.active];
    case "marketing":
      return hasSite
        ? [c.fewPhotos, c.lowReplies, c.dated, c.noBooking, c.active]
        : [c.noWebsite, c.fewPhotos, c.lowReplies, c.active];
  }
}

import { offerTypeLabels } from "@/lib/domain/labels";
export { offerTypeLabels };

export function researchBusiness(b: Business, offer: OfferType, generatedAt: string): OpportunityBrief {
  const { facts, unknowns } = collectFacts(b);
  const cs = criteria(b, offer);
  const factByKey = new Map(facts.map((f) => [f.key, f]));

  const rubric: RubricItem[] = cs.map(({ id, criterion, weight, met, note }) => ({ id, criterion, weight, met, note }));
  const maxTotal = cs.reduce((a, c) => a + c.weight, 0);
  const maxKnown = cs.filter((c) => c.met !== null).reduce((a, c) => a + c.weight, 0);
  const points = cs.filter((c) => c.met === true).reduce((a, c) => a + c.weight, 0);
  // Unknown criteria do not count toward fit.
  const ratio = maxTotal ? points / maxTotal : 0;
  const level: FitLevel = ratio >= 0.6 ? "strong" : ratio >= 0.35 ? "moderate" : "weak";

  const knownCount = cs.filter((c) => c.met !== null).length;
  const knownShare = cs.length ? knownCount / cs.length : 0;
  const confidence: Confidence = knownShare >= 0.85 ? "high" : knownShare >= 0.6 ? "medium" : "low";

  const opportunities: Opportunity[] = cs
    .filter((c) => c.met === true && c.opportunity)
    .sort((a, b2) => b2.weight - a.weight)
    .slice(0, 3)
    .map((c) => ({
      id: `${b.id}_o_${c.id}`,
      text: c.opportunity!.text,
      relevance: c.opportunity!.relevance,
      basedOnFactIds: c.factKeys.map((k) => factByKey.get(k)?.id).filter((x): x is string => !!x),
    }));

  const n = nicheWords(b.niche);
  const angle = opportunities[0]
    ? `Open with what you saw: ${lowerFirst(facts.find((f) => f.id === opportunities[0].basedOnFactIds[0])?.text ?? opportunities[0].text)} Then offer one specific improvement.`
    : `No clear opening for a ${offerTypeLabels[offer].toLowerCase()} offer from the collected sources. Consider skipping this ${n.singular.toLowerCase()} or researching further.`;

  return {
    id: `brief_${b.id}_${offer}`,
    businessId: b.id,
    offerType: offer,
    generatedAt,
    generator: "demo-template",
    facts: facts.map(({ id, text, evidenceIds }) => ({ id, text, evidenceIds })),
    opportunities,
    unknowns,
    rubric,
    fit: { level, points, maxKnown, maxTotal },
    confidence: {
      level: confidence,
      reason: `${knownCount} of ${cs.length} criteria could be checked from collected sources.`,
    },
    angle,
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
