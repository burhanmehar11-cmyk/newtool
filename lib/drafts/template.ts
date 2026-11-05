import type { Business, OfferProfile, OpportunityBrief } from "@/lib/domain/types";
import { nicheWords } from "@/lib/discovery/niches";

/**
 * Rule-based draft writer, shared by the demo and the product. Template-based
 * and deterministic: no model is called.
 * Every observation sentence maps to a fact in the brief, so the UI can show
 * what each draft relies on.
 */

type Opening = { line: string; factKey: string; inference?: string };

function openingFor(b: Business, brief: OpportunityBrief): Opening[] {
  const n = nicheWords(b.niche);
  const s = b.signals;
  const has = (key: string) => brief.facts.some((f) => f.id === `${b.id}_f_${key}`);
  const out: Opening[] = [];
  const top = brief.opportunities.map((o) => o.id.split("_o_")[1]);
  for (const id of top) {
    switch (id) {
      case "no_booking":
        if (has("no_booking"))
          out.push({ line: `I was on your contact page and noticed ${n.customerNoun} are asked to call to schedule, and I couldn't find a way to book online.`, factKey: "no_booking", inference: "That usually means new bookings only happen while someone can answer the phone." });
        break;
      case "dated":
        if (has("copyright"))
          out.push({ line: `I noticed the footer on ${b.domain} still shows © ${s.siteCopyrightYear}.`, factKey: "copyright", inference: "Sometimes that's just a footer nobody updated, but it can also mean the site hasn't kept up with what you offer now." });
        break;
      case "no_viewport":
        if (has("no_viewport"))
          out.push({ line: "I noticed your homepage doesn't set a mobile viewport, so on phones it may show as a shrunken desktop page.", factKey: "no_viewport" });
        break;
      case "paper_intake":
        if (has("pdf_intake"))
          out.push({ line: `I noticed your ${n.intakeNoun} are printable PDFs.`, factKey: "pdf_intake", inference: "That can mean a fair amount of re-typing for the front desk." });
        else if (has("phone_intake"))
          out.push({ line: `I noticed your ${n.intakeNoun} are completed over the phone.`, factKey: "phone_intake", inference: "That can take up a lot of front-desk time." });
        break;
      case "low_replies":
        if (s.ownerReplyShare)
          out.push({ line: `I was reading your recent reviews and saw replies on ${s.ownerReplyShare.replied} of the latest ${s.ownerReplyShare.sampled}.`, factKey: "owner_replies", inference: "Replying to more of them is a simple way to show future customers you're listening." });
        break;
      case "hours_missing":
        out.push({ line: "I noticed your business listing doesn't show opening hours.", factKey: "hours_missing", inference: "People who check the listing first can't tell when you're open." });
        break;
      case "few_photos":
        if (s.photoCount !== null)
          out.push({ line: `I noticed your business listing has ${s.photoCount} photo${s.photoCount === 1 ? "" : "s"}.`, factKey: "photos", inference: "Photos are often the first thing people look at on a listing." });
        break;
      case "no_website":
        out.push({ line: "I couldn't find a website linked from your business listing.", factKey: "no_website", inference: "That makes it hard for people searching online to compare options or get in touch." });
        break;
      case "no_form":
        out.push({ line: "I noticed your site lists a phone number and email but no contact form.", factKey: "no_form", inference: "After-hours enquiries may wait until the next business day." });
        break;
    }
  }
  return out;
}

const subjects = {
  friendly: (b: Business, topic: string) => [`A quick idea for ${b.name}`, `${b.name}: ${topic}`, `Question about ${topic}`],
  direct: (b: Business, topic: string) => [`${cap(topic)} at ${b.name}`, `${b.name}: ${topic}`, `Idea: ${topic}`],
  consultative: (b: Business, topic: string) => [`An observation about ${topic}`, `${b.name} and ${topic}`, `Thought on ${topic}`],
};

const topicFor: Record<string, string> = {
  no_booking: "online booking",
  copyright: "your website",
  no_viewport: "your site on mobile",
  pdf_intake: "patient forms",
  phone_intake: "intake forms",
  owner_replies: "review replies",
  hours_missing: "your listing",
  photos: "your listing photos",
  no_website: "a website",
  no_form: "website enquiries",
};

export function generateDraft(
  b: Business,
  brief: OpportunityBrief,
  offer: OfferProfile,
  variant = 0,
): { subject: string; body: string; factIds: string[] } {
  const openings = openingFor(b, brief);
  const v = Math.abs(variant) % 3;
  const primary = openings[v % Math.max(1, openings.length)] ?? null;
  const topic = primary ? topicFor[primary.factKey] ?? "your website" : "an idea";
  const subject = subjects[offer.tone](b, topic)[v];

  const greeting = `Hi ${b.name} team,`;
  const observation = primary
    ? `${primary.line}${primary.inference ? ` ${primary.inference}` : ""} You may already have this covered.`
    : `I came across ${b.name} while looking at ${nicheWords(b.niche).plural.toLowerCase()}${b.city ? ` in ${b.city}` : ""}.`;

  const offerLine =
    offer.tone === "direct"
      ? `${offer.companyName} helps ${offer.targetCustomer || "local businesses"} with ${offer.service.toLowerCase()}. ${offer.valueProp}`
      : offer.tone === "consultative"
        ? `We work with ${offer.targetCustomer || "local businesses"} on ${offer.service.toLowerCase()}, and this is usually where we start. ${offer.valueProp}`
        : `I run ${offer.service.toLowerCase()} at ${offer.companyName}. ${offer.valueProp}`;

  const ctas = [
    offer.bookingLink
      ? `Would a 15-minute call be useful? If so, you can pick a time here: ${offer.bookingLink}`
      : "Would a 15-minute call next week be useful?",
    "If it's helpful, I can send over two or three specific suggestions. No obligation.",
    "Is this something you're already working on, or worth a short conversation?",
  ];

  const body = [
    greeting,
    "",
    observation,
    "",
    offerLine.trim(),
    "",
    ctas[v],
    "",
    `${offer.senderName}`,
    `${offer.senderTitle ? `${offer.senderTitle}, ` : ""}${offer.companyName}`,
    offer.businessAddress,
    "",
    "If this isn't relevant, reply \"no thanks\" and I won't follow up.",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return {
    subject,
    body,
    factIds: primary ? [`${b.id}_f_${primary.factKey}`] : [],
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Follow-up steps use simple merge fields. */
export const defaultFollowUps = [
  {
    delayDays: 3,
    subject: "Re: {{previous_subject}}",
    body: "Hi {{business_name}} team,\n\nFollowing up on my note from earlier this week. Happy to send the specific suggestions if useful.\n\n{{sender_name}}\n\nIf this isn't relevant, reply \"no thanks\" and I won't follow up.",
  },
  {
    delayDays: 5,
    subject: "Re: {{previous_subject}}",
    body: "Hi {{business_name}} team,\n\nLast note from me. If timing is wrong, no problem at all and I'll leave it here.\n\n{{sender_name}}",
  },
];
