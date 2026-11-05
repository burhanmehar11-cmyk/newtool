"use client";

import * as React from "react";
import { ATTRIBUTION_KEY, attributionFrom } from "@/lib/attribution";

/** The first visit's source in this tab, as JSON, or null. */
export function readAttribution(): string | null {
  try {
    return sessionStorage.getItem(ATTRIBUTION_KEY);
  } catch {
    return null;
  }
}

/**
 * Notes where this visit came from (utm tags or referring site) in session
 * storage, once per tab, and adds one to an anonymous daily count for that
 * source. No cookies and nothing personal; see the privacy policy.
 */
export function AttributionCapture() {
  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
      const a = attributionFrom(location.href, document.referrer || null, location.hostname);
      if (a.source === "direct" && a.landingPath?.startsWith("/invite/")) a.source = "invite";
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(a));
      if (!/bot|crawl|spider|headless/i.test(navigator.userAgent)) navigator.sendBeacon?.("/api/visit", JSON.stringify({ source: a.source }));
    } catch {
      // Storage blocked: nothing is recorded.
    }
  }, []);
  return null;
}
