import type { BusinessSignals, Evidence } from "@/lib/domain/types";
import type { PageSignals } from "./extract";

/**
 * Combines the pages read for one business into the signals the brief rules
 * use, plus one evidence record per kind of observation. A signal is only set
 * when a page actually shows it; everything else stays null (Unknown).
 */
export type ResearchedPage = { role: "home" | "followup"; page: PageSignals };

export function aggregatePages(
  businessId: string,
  pages: ResearchedPage[],
  collectedAt: string,
  newId: () => string,
): { signals: BusinessSignals; evidence: Evidence[] } {
  const home = pages.find((p) => p.role === "home")?.page ?? null;
  const all = pages.map((p) => p.page);
  const evidence: Evidence[] = [];
  const add = (kind: Evidence["kind"], page: PageSignals, lines: string[]) => {
    const path = new URL(page.url).pathname || "/";
    evidence.push({
      id: newId(),
      businessId,
      kind,
      label: kind === "homepage" ? "Homepage" : `${kind === "forms_page" ? "Forms" : "Website"} page (${path})`,
      url: page.url,
      collectedAt,
      excerpt: lines.filter(Boolean).join("\n").slice(0, 1200),
    });
  };

  const latestYear = all.reduce<{ year: number; excerpt: string; page: PageSignals } | null>((best, p) => {
    if (p.copyrightYear && (!best || p.copyrightYear.year > best.year)) return { ...p.copyrightYear, page: p };
    return best;
  }, null);

  if (home) {
    add("homepage", home, [
      latestYear && latestYear.page === home ? latestYear.excerpt : home.copyrightYear ? home.copyrightYear.excerpt : "Footer: no copyright year shown.",
      home.viewport ? '<meta name="viewport"> present in the page head.' : "No viewport meta tag in the page head.",
    ]);
  }

  const bookingPage = all.find((p) => p.booking);
  const phonePage = all.find((p) => p.phoneOnly);
  const contactPage = all.find((p) => /contact/i.test(new URL(p.url).pathname));
  const formPage = all.find((p) => p.contactForm);
  const contactEvidencePage = bookingPage ?? phonePage ?? contactPage ?? null;
  if (contactEvidencePage) {
    add("contact_page", contactEvidencePage, [
      bookingPage ? `Online booking: ${bookingPage.booking!.excerpt}${bookingPage.booking!.via ? ` (${bookingPage.booking!.via})` : ""}` : "",
      !bookingPage && phonePage ? `“${phonePage.phoneOnly!.excerpt}”` : "",
      formPage ? `Contact form present on ${new URL(formPage.url).pathname}.` : contactPage ? `No contact form on ${new URL(contactPage.url).pathname}.` : "",
    ]);
  }

  const pdfPage = all.find((p) => p.pdfForms);
  if (pdfPage) add("forms_page", pdfPage, [pdfPage.pdfForms!.excerpt]);

  const signals: BusinessSignals = {
    siteCopyrightYear: latestYear?.year ?? null,
    mobileViewport: home ? home.viewport : null,
    // "No online booking" only when a page asks people to phone instead; silence stays Unknown.
    onlineBooking: bookingPage ? true : phonePage ? false : null,
    intakeMethod: pdfPage ? "pdf_forms" : bookingPage?.booking?.via ? "online_form" : null,
    // Website research can't see listing details (reviews, hours, photos).
    ownerReplyShare: null,
    hoursListed: null,
    photoCount: null,
    contactForm: formPage ? true : contactPage ? false : null,
  };
  return { signals, evidence };
}
