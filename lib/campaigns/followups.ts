/**
 * Follow-up emails: short notes sent in the same thread when someone hasn't
 * answered. Written once per campaign as templates; {business} and {sender}
 * are filled in per recipient. A reply, unsubscribe, bounce or cancel stops
 * them.
 */

export type FollowUp = { delayDays: number; body: string };

export const MAX_FOLLOW_UPS = 2;
export const DELAY_MIN = 1;
export const DELAY_MAX = 14;
export const BODY_MIN = 20;
export const BODY_MAX = 1000;
export const PLACEHOLDERS = ["business", "sender"] as const;

export const DEFAULT_FOLLOW_UPS: FollowUp[] = [
  { delayDays: 3, body: "Hi again, just bringing this back to the top of your inbox in case it got buried. Happy to share a couple of quick ideas for {business} if that would help.\n\n{sender}" },
  { delayDays: 5, body: "Last note from me. If now isn't the right time for {business}, no problem at all, I won't follow up again.\n\n{sender}" },
];

/** Returns a problem to show, or null when the follow-ups are fine. */
export function followUpProblem(steps: FollowUp[]): string | null {
  if (steps.length > MAX_FOLLOW_UPS) return `At most ${MAX_FOLLOW_UPS} follow-ups.`;
  for (const [i, s] of steps.entries()) {
    const n = `Follow-up ${i + 1}`;
    if (!Number.isInteger(s.delayDays) || s.delayDays < DELAY_MIN || s.delayDays > DELAY_MAX) return `${n}: wait between ${DELAY_MIN} and ${DELAY_MAX} days.`;
    const body = s.body.trim();
    if (body.length < BODY_MIN) return `${n}: write at least ${BODY_MIN} characters.`;
    if (body.length > BODY_MAX) return `${n}: keep it under ${BODY_MAX} characters.`;
    const unknown = [...body.matchAll(/\{([^{}\s]{1,30})\}/g)].map((m) => m[1]).find((p) => !(PLACEHOLDERS as readonly string[]).includes(p));
    if (unknown) return `${n}: {${unknown}} isn't a placeholder. Use {business} or {sender}.`;
    if (/https?:\/\//i.test(body)) return `${n}: leave links out of follow-ups; they hurt deliverability.`;
  }
  return null;
}

export function renderFollowUp(body: string, v: { business: string; sender: string }): string {
  return body
    .trim()
    .replace(/\{business\}/g, v.business.trim() || "your business")
    .replace(/\{sender\}/g, v.sender.trim());
}

/** Same subject as the first email, as a reply, so it lands in the same thread. */
export function followUpSubject(subject: string): string {
  const s = subject.trim();
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

/** "Day 0, day 3, day 8": when each email goes out, counted from the first. */
export function sendDays(steps: Pick<FollowUp, "delayDays">[]): number[] {
  const out = [0];
  for (const s of steps) out.push(out[out.length - 1] + s.delayDays);
  return out;
}
