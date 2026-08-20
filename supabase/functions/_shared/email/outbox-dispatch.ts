import type { EdgeRuntime } from "../auth/runtime.ts";

const dispatchPath = "/functions/v1/email-outbox-dispatch";

/** Requests a best-effort post-commit dispatch; cron independently recovers it. */
export async function requestEmailOutboxDispatch(runtime: EdgeRuntime) {
  const supabaseUrl = runtime.env.get("SUPABASE_URL")?.trim();
  const secret = runtime.env.get("EMAIL_OUTBOX_DISPATCH_SECRET")?.trim();
  if (!supabaseUrl || !secret) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${supabaseUrl}${dispatchPath}`, {
      body: JSON.stringify({ limit: 10 }),
      headers: {
        "Content-Type": "application/json",
        "x-email-outbox-dispatch-secret": secret,
      },
      method: "POST",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
