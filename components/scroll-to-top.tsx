"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Opens the page at the very top. Next.js scrolls a new page so its content
 * starts at the top of the screen, which hides what the layout shows above it
 * (the logo on the sign-in and sign-up pages).
 */
export function ScrollToTop() {
  const pathname = usePathname();
  React.useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
