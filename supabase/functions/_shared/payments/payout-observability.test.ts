import { assertEquals } from "jsr:@std/assert@1";
import { SupabaseHttpError } from "../auth/supabase-rest.ts";
import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import {
  resolveBatchWorkerFailure,
  sanitizePayoutFailure,
} from "./payout-observability.ts";

Deno.test("sanitizes Supabase failures without exposing multiline responses", () => {
  assertEquals(
    sanitizePayoutFailure(
      new SupabaseHttpError(500, "duplicate\ninternal database detail"),
    ),
    {
      code: "supabase_http_500",
      message: "duplicate internal database detail",
    },
  );
});

Deno.test("sanitizes generic failure codes and messages", () => {
  const error = new Error("first line\r\nsecond line");
  error.name = "Unexpected worker/error";

  assertEquals(sanitizePayoutFailure(error), {
    code: "Unexpected_worker_error",
    message: "first line second line",
  });
});

Deno.test("preserves a safe explicit operational error code", () => {
  const error = Object.assign(new Error("not enough balance"), {
    code: "balance_insufficient",
  });
  assertEquals(sanitizePayoutFailure(error), {
    code: "balance_insufficient",
    message: "not enough balance",
  });
});

Deno.test("resolves only the deterministic incident for the recovered worker", async () => {
  let call: { body: unknown; name: string } | null = null;
  const client = {
    rpc(name: string, body: unknown) {
      call = { body, name };
      return Promise.resolve(true);
    },
  } as unknown as SupabaseRestClient;

  const resolved = await resolveBatchWorkerFailure({
    batchId: "11111111-1111-4111-8111-111111111111",
    client,
    operation: "process_payout_batch",
  });

  assertEquals(resolved, true);
  assertEquals(call, {
    body: {
      p_incident_key:
        "batch:11111111-1111-4111-8111-111111111111:worker:process_payout_batch",
    },
    name: "resolve_payout_operational_incident_v1",
  });
});
