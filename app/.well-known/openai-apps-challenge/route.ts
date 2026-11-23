/**
 * Domain verification for listing Locenti in ChatGPT: OpenAI shows a token
 * when you submit; put it in OPENAI_APPS_CHALLENGE (Vercel) and redeploy.
 */
export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  return token ? new Response(token, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }) : new Response("Not configured", { status: 404 });
}
