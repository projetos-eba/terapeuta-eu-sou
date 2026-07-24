import { SupabaseRestClient } from "./supabase-rest.ts";
import { sha256Hex } from "./tokens.ts";

export async function checkRateLimit(
  client: SupabaseRestClient,
  input: {
    actionKey: string;
    identifier: string;
    ip: string | null;
    limit: number;
    salt: string;
    windowSeconds: number;
  },
) {
  const identifierHash = await sha256Hex(
    `${input.salt}:identifier:${input.identifier}`,
  );
  const ipHash = input.ip
    ? await sha256Hex(`${input.salt}:ip:${input.ip}`)
    : null;
  const since = new Date(Date.now() - input.windowSeconds * 1000).toISOString();
  const identifierEvents = await client.get<{ id: string }[]>(
    `/rest/v1/email_rate_limit_events?select=id&action_key=eq.${encodeURIComponent(
      input.actionKey,
    )}&identifier_hash=eq.${identifierHash}&created_at=gte.${encodeURIComponent(
      since,
    )}`,
  );
  const ipEvents = ipHash
    ? await client.get<{ id: string }[]>(
        `/rest/v1/email_rate_limit_events?select=id&action_key=eq.${encodeURIComponent(
          input.actionKey,
        )}&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}`,
      )
    : [];
  const accepted =
    identifierEvents.length < input.limit && ipEvents.length < input.limit * 2;

  await client.post(
    "/rest/v1/email_rate_limit_events",
    {
      action_key: input.actionKey,
      identifier_hash: identifierHash,
      ip_hash: ipHash,
      outcome: accepted ? "accepted" : "limited",
    },
    "return=minimal",
  );

  return accepted;
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("cf-connecting-ip");
}
