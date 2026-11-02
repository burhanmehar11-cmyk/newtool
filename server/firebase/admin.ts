import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { serviceAccount } from "@/server/env";

/** Firebase Admin, initialised from the shared service account. Null when not configured. */
export function adminAuth(): Auth | null {
  const sa = serviceAccount();
  if (!sa) return null;
  const app =
    getApps()[0] ??
    initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }), projectId: sa.project_id });
  return getAuth(app);
}
