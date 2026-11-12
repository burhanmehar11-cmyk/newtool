/**
 * Mail providers people connect with an App Password (or mailbox password).
 * The server names are filled in for them; "custom" lets them type their own.
 */
export type ServerSettings = { host: string; port: number; secure: boolean };
export type MailPreset = {
  id: "google" | "zoho" | "hostinger" | "custom";
  label: string;
  hint: string;
  smtp: ServerSettings | null;
  imap: ServerSettings | null;
  passwordLabel: string;
  passwordHint: string;
};

export const MAIL_PRESETS: MailPreset[] = [
  {
    id: "google",
    label: "Gmail / Google Workspace",
    hint: "Connect with an App Password",
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    passwordLabel: "App Password",
    passwordHint: "The 16-character App Password from step 3 (looks like xxxx xxxx xxxx xxxx). Not your normal Google password.",
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    hint: "Connect with a Zoho App Password",
    smtp: { host: "smtp.zoho.com", port: 465, secure: true },
    imap: { host: "imap.zoho.com", port: 993, secure: true },
    passwordLabel: "Password or App Password",
    passwordHint: "Your Zoho password, or an App Password if two-factor sign-in is on.",
  },
  {
    id: "hostinger",
    label: "Hostinger Email",
    hint: "Connect Hostinger-hosted email accounts",
    smtp: { host: "smtp.hostinger.com", port: 465, secure: true },
    imap: { host: "imap.hostinger.com", port: 993, secure: true },
    passwordLabel: "Mailbox password",
    passwordHint: "The password of this email account in Hostinger.",
  },
  {
    id: "custom",
    label: "Custom IMAP/SMTP",
    hint: "cPanel, private servers, other providers",
    smtp: null,
    imap: null,
    passwordLabel: "Password",
    passwordHint: "The mailbox password (or app password) your provider gives for IMAP/SMTP.",
  },
];

export function findPreset(id: string | null | undefined): MailPreset {
  return MAIL_PRESETS.find((p) => p.id === id) ?? MAIL_PRESETS[MAIL_PRESETS.length - 1];
}

/** Google shows App Passwords in groups of four; spaces aren't part of it. */
export function cleanPassword(preset: string, password: string) {
  return preset === "google" ? password.replace(/\s+/g, "") : password;
}
