/** Platform admins: exact emails in ADMIN_EMAILS (comma-separated). Empty means nobody. */
export function adminEmails(list: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (list ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[^@\s]+@[^@\s]+$/.test(x));
}

export function isAdminEmail(email: string | null | undefined, list?: string): boolean {
  return !!email && adminEmails(list).includes(email.trim().toLowerCase());
}

/** Trial length shown in the admin panel (not enforced). */
export function trialDays(v: string | undefined = process.env.TRIAL_DAYS): number {
  const d = Number(v);
  return Number.isInteger(d) && d >= 1 && d <= 90 ? d : 14;
}
