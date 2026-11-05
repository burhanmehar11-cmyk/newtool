/**
 * Draft legal outlines. Placeholders in [brackets] must be completed by the
 * owner with legal advice before launch. Do not add certifications or
 * compliance guarantees.
 */
export const legalDocs: Record<string, { title: string; sections: { h: string; p: string[] }[] }> = {
  terms: {
    title: "Terms of service",
    sections: [
      { h: "Who we are", p: ["[Company legal name], [registered address], [jurisdiction]. Contact: [support email]."] },
      { h: "The service", p: ["The service helps users find publicly listed businesses, research them from permitted sources, and send outreach from mailboxes the user connects. The interactive demo uses fictional data and does not send email."] },
      { h: "Your responsibilities", p: ["You are responsible for the content you send, for identifying yourself accurately, for honouring opt-outs, and for following the outreach laws that apply to you and your recipients.", "[Owner to complete: prohibited uses, account security, acceptable sending volumes.]"] },
      { h: "Data and providers", p: ["Business data and verification results come from third-party providers under their terms. Availability, accuracy and fields may change. [Owner to complete with the chosen providers.]"] },
      { h: "Fees and usage", p: ["Prices and usage units will be stated before purchase. [Owner to complete billing, renewal, cancellation and refund terms.]"] },
      { h: "Disclaimers and liability", p: ["[To be drafted with legal counsel.]"] },
    ],
  },
  privacy: {
    title: "Privacy policy",
    sections: [
      { h: "Controller", p: ["[Company legal name and contact details]."] },
      { h: "What we collect", p: ["Account details you provide; workspace content such as leads, notes and drafts; mailbox data needed to send and sync replies when you connect a mailbox; usage and security logs.", "The demo stores sample data only in your browser's local storage. It is not sent to us."] },
      { h: "Google user data", p: ["When you connect a Gmail account, Locentio asks Google for permission to send email on your behalf (the gmail.send scope) plus your email address. If you also turn on reply tracking, Locentio asks for read access (gmail.readonly) and uses it only to read the conversations Locentio started, so it can show replies, sort them and stop emailing people who decline or whose address bounces. It never reads other mail, and it cannot delete mail. Replies are stored as plain text. The access token is stored encrypted and used only to send emails you approved in Locentio, or a test email to yourself. You can disconnect in Settings or remove access at myaccount.google.com/permissions at any time.", "Locentio's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Google user data is not used for advertising, not sold, and not used to train AI models."] },
      { h: "AI", p: ["If the built-in AI writer is used, the lead's research summary and your offer profile are sent to Google's Gemini API to draft an email. [Owner to confirm the Gemini plan: on Google's free tier, submitted content may be used to improve Google's products.] If you connect your own AI agent, data your agent requests is shared with your agent's provider under your own agreement with them."] },
      { h: "Business contact data", p: ["The service processes publicly available business information, such as role email addresses published by businesses. [Owner to complete the lawful basis, source disclosure, retention and objection handling for each market.]"] },
      { h: "Sub-processors", p: ["[List hosting, database, AI, verification, discovery, email and billing providers once chosen.]"] },
      { h: "Retention and deletion", p: ["[Owner to define retention periods, including the minimum record kept on suppression lists so opt-outs are honoured.]"] },
      { h: "Your rights", p: ["[Owner to complete for applicable jurisdictions.]"] },
    ],
  },
  "acceptable-use": {
    title: "Acceptable use policy",
    sections: [
      { h: "Purpose", p: ["The service is for relevant, honest business-to-business outreach to organisations that publish contact details."] },
      { h: "Not allowed", p: ["Misleading sender identity or subject lines; contacting people who opted out; purchased or scraped personal lists; harassment; content that is illegal where you or your recipients are; attempts to bypass sending limits or source restrictions."] },
      { h: "Enforcement", p: ["[Owner to define suspension, appeal and reporting process.]"] },
    ],
  },
};
