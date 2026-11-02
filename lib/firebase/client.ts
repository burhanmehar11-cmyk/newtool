"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

/**
 * Browser Firebase Auth. Uses in-memory persistence: the browser keeps no
 * Firebase session of its own; the server's httpOnly cookie is the session.
 * NEXT_PUBLIC_FIREBASE_* values are public identifiers, not secrets.
 */
let authPromise: Promise<Auth> | null = null;

export function firebaseAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    if (!config.apiKey || !config.authDomain || !config.projectId) throw new Error("Firebase is not configured");
    const app = getApps()[0] ?? initializeApp(config);
    const auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    return auth;
  })();
  return authPromise;
}

/** Plain-language messages for Firebase Auth error codes. */
export function authErrorMessage(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "That email and password don't match an account.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, or reset your password.";
    case "auth/email-already-in-use":
      return "An account already exists for this email. Sign in instead.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 10 characters).";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google window was closed before signing in.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorised for sign-in yet. Add it in Firebase Authentication → Settings → Authorized domains.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
