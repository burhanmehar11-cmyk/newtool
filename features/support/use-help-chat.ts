"use client";

import * as React from "react";
import { askHelpAction } from "@/server/actions/support";

/** One help conversation with the AI assistant (used by the chat bubble and the Help & Support page). */
export type ChatMsg = { role: "user" | "assistant"; text: string; suggest?: { subject: string; topic: string } };

export const HELP_STARTERS = ["How do I connect my Gmail?", "Why did my campaign pause?", "How many businesses can I find on the trial?", "How do I write better emails?"];

export function useHelpChat() {
  const [msgs, setMsgs] = React.useState<ChatMsg[]>([]);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const ask = React.useCallback(
    (q: string) => {
      const question = q.trim();
      if (!question || pending) return false;
      const next: ChatMsg[] = [...msgs, { role: "user", text: question }];
      setMsgs(next);
      setError(null);
      start(async () => {
        const r = await askHelpAction(next.slice(-12).map((m) => ({ role: m.role, text: m.text })));
        if (r.ok) setMsgs((m) => [...m, { role: "assistant", text: r.answer, suggest: r.suggestRequest ? { subject: r.subject, topic: r.topic } : undefined }]);
        else setError(r.error);
      });
      return true;
    },
    [msgs, pending],
  );
  const transcript = React.useCallback(() => msgs.map((m) => `${m.role === "user" ? "Me" : "Assistant"}: ${m.text}`).join("\n\n"), [msgs]);
  const firstQuestion = msgs.find((m) => m.role === "user")?.text ?? "";
  const lastSuggest = [...msgs].reverse().find((m) => m.suggest)?.suggest ?? null;
  return { msgs, pending, error, ask, transcript, firstQuestion, lastSuggest, reset: () => (setMsgs([]), setError(null)) };
}
