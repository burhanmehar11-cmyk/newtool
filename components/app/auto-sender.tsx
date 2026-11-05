"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { autoSendTickAction } from "@/server/actions/campaigns";

const EVERY_MS = 60_000;

/**
 * While an app tab is open and visible, asks the server about once a minute
 * to send the next due campaign email. The server applies every limit
 * (sending hours, daily limit, minutes between emails), so extra ticks or
 * several open tabs never send more. A scheduler (GitHub Actions or another
 * cron) does the same when no tab is open.
 */
export function AutoSender() {
  const router = useRouter();
  React.useEffect(() => {
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const r = await autoSendTickAction();
        if (r.sent || r.newReplies) router.refresh();
      } catch {
        // offline or signed out: try again next minute
      } finally {
        busy = false;
      }
    };
    const first = window.setTimeout(tick, 8_000);
    const t = window.setInterval(tick, EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [router]);
  return null;
}
