/**
 * The welcome email sent once when someone's account is ready. HTML (email-
 * safe: tables and inline styles, no external CSS or scripts) with a plain-
 * text version for mail apps that don't show HTML. It's about their new
 * account and how to start (a transactional welcome), so it has no marketing
 * footer.
 */

export type WelcomeVars = { firstName: string; site: string; trialDays: number; replyTo: string };

const C = { midnight: "#0B1218", mint: "#8FF0C0", green: "#0E7A4F", ink: "#0B1218", slate: "#5B6773", line: "#E6E9EC", canvas: "#F5F6F3" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STEPS = [
  { title: "Connect your Gmail", body: "Campaigns go out from your own address, so replies land in your own inbox.", path: "/app/mailboxes", cta: "Connect" },
  { title: "Tell Locenti what you sell", body: "Your offer, tone and signature. Every email is written from it.", path: "/app/settings", cta: "Add your offer" },
  { title: "Find your first 20 businesses", body: "Pick a business type and a city. You only get businesses that show a real email.", path: "/app/discover", cta: "Search" },
];

export function welcomeEmail(v: WelcomeVars): { subject: string; text: string; html: string } {
  const subject = `Welcome to Locenti, ${v.firstName === "there" ? "let's find your first clients" : `${v.firstName}`}`;
  const hi = v.firstName === "there" ? "Hi there," : `Hi ${v.firstName},`;

  const text = `${hi}

Welcome to Locenti. Your account is ready, and your ${v.trialDays}-day free trial has started (no card needed).

Locenti finds local businesses on Google Maps that show a real email, reads their websites, writes a personal first email to each one, and sends it from your own Gmail once you approve it.

Three steps to your first replies:

1. Connect your Gmail
   Campaigns go out from your own address, so replies land in your own inbox.
   ${v.site}/app/mailboxes

2. Tell Locenti what you sell
   Your offer, tone and signature. Every email is written from it.
   ${v.site}/app/settings

3. Find your first 20 businesses
   Pick a business type and a city. You only get businesses that show a real email.
   ${v.site}/app/discover

Open your dashboard: ${v.site}/app
(New here? Press "Take the tour" on your dashboard for a one-minute walkthrough.)

Questions, or stuck on a step? Just reply to this email. We read every one.

Team Locenti
`;

  const step = (n: number, s: (typeof STEPS)[number]) => `
          <tr>
            <td style="padding:0 0 14px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:12px;">
                <tr>
                  <td width="52" valign="top" style="padding:16px 0 16px 16px;">
                    <div style="width:32px;height:32px;border-radius:16px;background:${C.mint};color:${C.midnight};font:700 15px/32px Arial,Helvetica,sans-serif;text-align:center;">${n}</div>
                  </td>
                  <td valign="top" style="padding:16px 16px 16px 4px;">
                    <p style="margin:0;font:700 16px/22px Arial,Helvetica,sans-serif;color:${C.ink};">${esc(s.title)}</p>
                    <p style="margin:4px 0 10px 0;font:400 14px/21px Arial,Helvetica,sans-serif;color:${C.slate};">${esc(s.body)}</p>
                    <a href="${esc(v.site + s.path)}" style="font:700 14px/20px Arial,Helvetica,sans-serif;color:${C.green};text-decoration:none;">${esc(s.cta)} &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your account is ready and your ${v.trialDays}-day free trial has started. Here's how to get your first replies.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${C.line};">
          <tr>
            <td style="background:${C.midnight};padding:28px 32px 30px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle"><img src="${esc(v.site)}/brand/locentio-logo-512.png" width="40" height="40" alt="" style="display:block;border-radius:10px;border:0;"></td>
                  <td valign="middle" style="padding-left:12px;font:800 22px/26px Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.5px;">Locenti</td>
                </tr>
              </table>
              <p style="margin:26px 0 0 0;font:800 28px/34px Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.5px;">Welcome aboard${v.firstName === "there" ? "" : `, ${esc(v.firstName)}`}.</p>
              <p style="margin:10px 0 0 0;font:400 16px/24px Arial,Helvetica,sans-serif;color:#C9D3D9;">Your account is ready and your <span style="color:${C.mint};font-weight:700;">${v.trialDays}-day free trial</span> has started. No card needed.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 6px 32px;">
              <p style="margin:0 0 18px 0;font:400 15px/23px Arial,Helvetica,sans-serif;color:${C.ink};">Locenti finds local businesses on Google Maps that show a real email, reads their websites, writes a personal first email to each one, and sends it from your own Gmail once you approve it.</p>
              <p style="margin:0 0 14px 0;font:700 13px/18px Arial,Helvetica,sans-serif;color:${C.green};letter-spacing:1px;text-transform:uppercase;">Three steps to your first replies</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${STEPS.map((s, i) => step(i + 1, s)).join("")}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 32px 8px 32px;">
              <a href="${esc(v.site)}/app" style="display:inline-block;background:${C.green};color:#ffffff;font:700 16px/20px Arial,Helvetica,sans-serif;text-decoration:none;padding:15px 30px;border-radius:12px;">Open your dashboard</a>
              <p style="margin:12px 0 0 0;font:400 13px/19px Arial,Helvetica,sans-serif;color:${C.slate};">New here? Press <strong>Take the tour</strong> on your dashboard for a one-minute walkthrough.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 30px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
                <tr>
                  <td style="padding-top:20px;font:400 15px/23px Arial,Helvetica,sans-serif;color:${C.ink};">
                    Questions, or stuck on a step? Just reply to this email. We read every one.
                    <br><br>
                    <strong>Team Locenti</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font:400 12px/18px Arial,Helvetica,sans-serif;"><a href="${esc(v.site)}" style="color:${C.slate};text-decoration:none;">locenti.com</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}
