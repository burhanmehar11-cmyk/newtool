"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A short guided tour of the workspace for beginners: it highlights each
 * sidebar tab and says what it's for. Starts by itself the first time
 * someone opens their dashboard (remembered in this browser), and can be
 * replayed from the sidebar or the dashboard ("Take the tour").
 */

type Step = { target?: string; title: string; body: string };

const STEPS: Step[] = [
  { title: "Welcome to Locenti", body: "A one-minute tour of where everything is. Locenti finds local businesses on Google Maps, finds their public emails, writes a personal first email to each, and sends your approved campaigns from your own Gmail." },
  { target: "/app", title: "Dashboard", body: "Your pipeline at a glance for the last 30 days, and a setup checklist showing what to do next." },
  { target: "/app/mailboxes", title: "Mailboxes: start here", body: "Connect the Gmail address you send from, then send yourself a test email. Campaigns can't go out until a mailbox is connected." },
  { target: "/app/discover", title: "Discover", body: "Search Google Maps by business type and city. You only get businesses that show an email (and a website, if you tick it), and you're charged only for those." },
  { target: "/app/leads", title: "Leads", body: "Businesses you saved. Open one to see what its website shows, research it, add notes, or import and export leads as a CSV file." },
  { target: "/app/campaigns", title: "Campaigns", body: "Pick leads, and Locenti writes a personal first email for each. You review every message and approve; nothing is sent before that. Pause, resume or edit any time." },
  { target: "/app/inbox", title: "Inbox", body: "Replies to your campaigns, sorted into interested, not interested and out of office. Answer them from your Gmail." },
  { target: "/app/notifications", title: "Notifications", body: "The bell on your workspace card. A number means something new: replies, campaigns starting and finishing, a mailbox that needs reconnecting, teammates joining." },
  { target: "/app/analytics", title: "Analytics", body: "How your campaigns are doing: emails sent, reply rate and which campaigns get interested replies." },
  { target: "/app/agent", title: "Agent", body: "Optional: connect your own AI app (Claude, Cursor and others) to search, research and draft campaigns for you. It can't send; you still approve." },
  { target: "/app/team", title: "Team", body: "Invite teammates to your workspace as admins, members or view-only clients." },
  { target: "/app/billing", title: "Billing", body: "Your plan and your free trial." },
  { target: "/app/settings", title: "Settings", body: "Your offer (what you sell, your tone and signature), which Locenti uses to write every email. Keep it up to date for better emails." },
  { title: "You're ready", body: "Best first steps: connect your mailbox, check your offer in Settings, then run your first search in Discover. You can replay this tour from the sidebar any time." },
];

const DONE_KEY = "locenti_tour_done";
export const TOUR_EVENT = "locenti:tour";

function seen() {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true; // storage blocked: don't keep popping up
  }
}
function markSeen() {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Starts the tour from anywhere (a button). */
export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export function TakeTourButton({ className, variant = "secondary" }: { className?: string; variant?: "secondary" | "ghost" }) {
  return (
    <Button type="button" size="sm" variant={variant} className={className} onClick={startTour}>
      <Compass aria-hidden /> Take the tour
    </Button>
  );
}

/** The visible sidebar link for a tab (desktop sidebar, or the open mobile menu). */
function findTarget(href: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${href}"]`));
  return all.find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0) ?? null;
}

export function ProductTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = React.useState<number | null>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // First visit to the dashboard: start once.
  React.useEffect(() => {
    if (pathname !== "/app" || seen()) return;
    const t = setTimeout(() => setStep(0), 700);
    return () => clearTimeout(t);
  }, [pathname]);

  React.useEffect(() => {
    const start = () => {
      if (pathname?.startsWith("/app/onboarding")) return;
      setStep(0);
    };
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, [pathname]);

  const current = step === null ? null : STEPS[step];

  // Follow the highlighted tab as the window scrolls or resizes.
  React.useLayoutEffect(() => {
    if (!current) return;
    const measure = () => {
      const el = current.target ? findTarget(current.target) : null;
      if (el) el.scrollIntoView({ block: "nearest" });
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current]);

  React.useEffect(() => {
    if (current) cardRef.current?.focus();
  }, [current]);

  const close = React.useCallback(() => {
    markSeen();
    setStep(null);
  }, []);
  const next = React.useCallback(() => setStep((s) => (s === null ? null : s + 1 < STEPS.length ? s + 1 : (markSeen(), null))), []);
  const back = React.useCallback(() => setStep((s) => (s ? s - 1 : s)), []);

  React.useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, close, next, back]);

  if (!current || step === null) return null;
  const last = step === STEPS.length - 1;
  // Next to the highlighted tab when there's room (desktop sidebar); otherwise centred.
  const beside = rect && window.innerWidth >= 768;
  const top = beside ? Math.min(Math.max(16, rect.top + rect.height / 2 - 110), window.innerHeight - 260) : undefined;

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Dimmed page with a cut-out around the tab being explained. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[12px] ring-2 ring-mint transition-all duration-300 ease-out"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: "0 0 0 9999px rgb(5 12 18 / 0.62)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-midnight/60" />
      )}
      <div className="fixed inset-0" onClick={close} aria-hidden />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className={cn(
          "fixed w-[min(360px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-5 shadow-float outline-none transition-all duration-300 ease-out",
          !beside && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={beside ? { top, left: rect.right + 16 } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-green">
            {step === 0 ? "Quick tour" : last ? "Done" : `Step ${step} of ${STEPS.length - 2}`}
          </p>
          <button type="button" onClick={close} className="-m-1 rounded-md p-1 text-slate hover:bg-ink/5 hover:text-ink" aria-label="Close the tour">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-2 font-display text-lg font-semibold text-ink">
          {current.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm leading-6 text-slate">
          {current.body}
        </p>
        <div className="mt-4 flex items-center gap-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-green" : "w-1.5 bg-line")} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={back}>
              <ArrowLeft aria-hidden /> Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Skip
            </Button>
          )}
          {last ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                close();
                router.push("/app/mailboxes");
              }}
            >
              Connect a mailbox <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={next}>
              {step === 0 ? "Start" : "Next"} <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
