/**
 * Rule-based suggestion for a reply. Always shown as a suggestion the user
 * can change; never used to send anything.
 */

export type ReplyKind = "interested" | "not_interested" | "out_of_office" | "bounce" | "unclassified";

const BOUNCE_FROM = /^(mailer-daemon|postmaster|mail-daemon)@/i;
const BOUNCE_SUBJECT = /(delivery status notification|undeliver(able|ed)|mail delivery (failed|subsystem)|returned mail|delivery (has )?failed|address not found)/i;
const OOO_SUBJECT = /(out of (the )?office|automatic reply|auto[- ]?reply|autoreply|on (annual )?leave|vacation)/i;
const OOO_TEXT = /(out of (the )?office|on (annual )?leave|on vacation|away from (the office|my desk)|limited access to (my )?email|will (be back|return) on)/i;
const STOP = /\b(unsubscribe|remove (me|us|this (email|address))|take (me|us) off|stop (emailing|contacting|sending)|do not (contact|email)|don'?t (contact|email) (me|us))\b/i;
const NO = /\b(not interested|no,? thank(s| you)|no thanks|we('| a)re (all )?(set|good|covered)|already have (a|an|someone)|not (a )?(fit|right now|at this time)|not looking)\b/i;
const YES = /\b(interested|sounds (good|great|interesting)|let'?s (talk|chat|meet|schedule)|tell me more|more (info|information|details)|send (me |us )?(more|the|some|your|over)|how much|pricing|what('| i)s the (cost|price)|call me|give me a call|(book|schedule|set up) (a )?(call|time|meeting)|happy to (chat|talk)|when (are|is) (you|a good time)|yes\b)/i;

export function classifyReply(m: { fromEmail: string; subject: string; text: string; autoSubmitted: boolean }): { kind: ReplyKind; stopRequested: boolean } {
  if (BOUNCE_FROM.test(m.fromEmail) || BOUNCE_SUBJECT.test(m.subject)) return { kind: "bounce", stopRequested: false };
  const text = m.text.slice(0, 2000);
  if (OOO_SUBJECT.test(m.subject) || (m.autoSubmitted && OOO_TEXT.test(text))) return { kind: "out_of_office", stopRequested: false };
  if (STOP.test(text)) return { kind: "not_interested", stopRequested: true };
  if (NO.test(text)) return { kind: "not_interested", stopRequested: false };
  if (YES.test(text)) return { kind: "interested", stopRequested: false };
  if (m.autoSubmitted) return { kind: "out_of_office", stopRequested: false };
  return { kind: "unclassified", stopRequested: false };
}

/** The bounced address, from a delivery-failure notice. */
export function bouncedAddress(text: string, candidates: string[]): string | null {
  const t = text.toLowerCase();
  return candidates.find((c) => t.includes(c.toLowerCase())) ?? null;
}
