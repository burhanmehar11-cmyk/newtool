import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { brand } from "@/config/brand";

/**
 * Transactional email (verification and password reset) over SMTP.
 * Free option: a Gmail account with an App Password:
 *   SMTP_URL=smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465
 */
export function emailConfigured() {
  return !!process.env.SMTP_URL?.trim();
}

let transport: Transporter | null = null;

export async function sendEmail(to: string, subject: string, text: string) {
  const url = process.env.SMTP_URL?.trim();
  if (!url) throw new Error("Email is not configured");
  transport ??= nodemailer.createTransport(url);
  const from = process.env.EMAIL_FROM?.trim() || decodeURIComponent(new URL(url).username) || undefined;
  await transport.sendMail({ from: from ? `${brand.name} <${from}>` : undefined, to, subject, text });
}

export function verifyEmailText(link: string) {
  return `Confirm your email to finish creating your ${brand.name} account:\n\n${link}\n\nThe link works once and expires in 24 hours. If you didn't sign up, ignore this email.`;
}

export function resetEmailText(link: string) {
  return `Use this link to choose a new ${brand.name} password:\n\n${link}\n\nIt works once and expires in 1 hour. If you didn't ask for this, ignore this email; your password stays the same.`;
}

export function existingAccountText(signInLink: string, resetLink: string) {
  return `Someone (hopefully you) tried to create a ${brand.name} account with this email, but you already have one.\n\nSign in: ${signInLink}\nForgot your password? ${resetLink}`;
}
