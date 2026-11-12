"use client";

import * as React from "react";
import { askHelpAction } from "@/server/actions/support";
import { matchAnswer, type InstantAnswer } from "@/lib/help-answers";

type Asker = typeof askHelpAction;

/** One help conversation with the AI assistant (used by the chat bubble and the Help & Support page). */
export type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  suggest?: { subject: string; topic: string };
  /** Answered at once from Locenti's help content (no AI); `question` lets the person ask the AI instead. */
  instant?: { question: string; retried?: boolean };
  link?: { href: string; label: string };
};

export const HELP_STARTERS = ["How do I connect my Gmail?", "Why did my campaign pause?", "How many businesses can I find on the trial?", "How do I write better emails?"];

/**
 * The assistant conversation. `asker` picks which assistant answers (the
 * in-app one by default); `instant` answers common questions straight away
 * without asking the AI.
 */
export function useHelpChat(asker: Asker = askHelpAction, instant: InstantAnswer[] = []) {
  const [msgs, setMsgs] = React.useState<ChatMsg[]>([]);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const askAI = React.useCallback(
    (history: ChatMsg[], replacing?: string) => {
      start(async () => {
        const r = await asker(history.slice(-12).map((m) => ({ role: m.role, text: m.text })));
        // The AI was unavailable and the fallback is the answer already shown: say so instead of repeating it.
        if (r.ok && replacing && r.answer.trim() === replacing.trim()) setError("The AI couldn't add more to that just now. If it didn't help, talk to the team below.");
        else if (r.ok) setMsgs((m) => [...m, { role: "assistant", text: r.answer, suggest: r.suggestRequest ? { subject: r.subject, topic: r.topic } : undefined }]);
        else setError(r.error);
      });
    },
    [asker],
  );

  const ask = React.useCallback(
    (q: string) => {
      const question = q.trim();
      if (!question || pending) return false;
      const next: ChatMsg[] = [...msgs, { role: "user", text: question }];
      setError(null);
      const hit = matchAnswer(question, instant);
      if (hit) {
        setMsgs([...next, { role: "assistant", text: hit.text, link: hit.link, instant: { question } }]);
        return true;
      }
      setMsgs(next);
      askAI(next);
      return true;
    },
    [msgs, pending, instant, askAI],
  );

  /** "Not quite? Ask the AI": the same question, to the AI this time. */
  const retryWithAI = React.useCallback(
    (index: number) => {
      const m = msgs[index];
      if (!m?.instant || pending) return;
      const marked = msgs.map((x, i) => (i === index ? { ...x, instant: { ...x.instant!, retried: true } } : x));
      setMsgs(marked);
      setError(null);
      // The AI sees the conversation without the instant answer it's replacing.
      askAI(
        marked.filter((_, i) => i !== index),
        m.text,
      );
    },
    [msgs, pending, askAI],
  );

  const transcript = React.useCallback(() => msgs.map((m) => `${m.role === "user" ? "Me" : "Assistant"}: ${m.text}`).join("\n\n"), [msgs]);
  const firstQuestion = msgs.find((m) => m.role === "user")?.text ?? "";
  const lastSuggest = [...msgs].reverse().find((m) => m.suggest)?.suggest ?? null;
  return { msgs, pending, error, ask, retryWithAI, transcript, firstQuestion, lastSuggest, reset: () => (setMsgs([]), setError(null)) };
}
