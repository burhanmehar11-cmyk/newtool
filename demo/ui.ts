"use client";

import { useSyncExternalStore } from "react";

/**
 * Transient, non-persisted UI intents shared across demo routes, e.g.
 * "open this lead's drawer after navigating to Leads". Routes stay mounted
 * (hidden) between navigations, so mount effects alone are not reliable.
 */
type UiState = { leadId: string | null; campaignId: string | null; threadId: string | null; settingsTab: string | null };

let ui: UiState = { leadId: null, campaignId: null, threadId: null, settingsTab: null };
const listeners = new Set<() => void>();
const SERVER: UiState = { leadId: null, campaignId: null, threadId: null, settingsTab: null };

export function setUi(patch: Partial<UiState>) {
  ui = { ...ui, ...patch };
  listeners.forEach((l) => l());
}

export function useUi() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ui,
    () => SERVER,
  );
}
