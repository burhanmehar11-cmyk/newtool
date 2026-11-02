export const SESSION_COOKIE = "locentio_session";
export const STATE_COOKIE = "locentio_oauth";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days
export const STATE_MAX_AGE_S = 10 * 60; // the Google round trip must finish within 10 minutes
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
