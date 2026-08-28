import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  assertConnectAccountOwnership,
  deriveConnectAccountState,
  derivePayoutSettingsState,
  retrieveAccountV2,
  retrieveBalanceSettings,
  setDailyAutomaticPayoutSchedule,
} from "../_shared/payments/connect.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { createIdempotencyKey } from "../_shared/payments/idempotency.ts";
import { getPaymentsConfig, getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = { limit?: number; mode?: "apply" | "dry_run"; therapistProfileId?: string };

const runtime = getPaymentsRuntime("stripe-connect-payout-schedule");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  const requestId = crypto.randomUUID();
  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }
    await requireInternalOperationsAccess(
      runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"),
      request,
    );
    const body = await parseJsonBody<Body>(request);
    const mode = body.mode ?? "dry_run";
    if (mode !== "dry_run" && mode !== "apply") {
      throw new DomainError("invalid_mode", 422, "Modo de operacao invalido.");
    }
    if (
      mode === "apply" &&
      runtime.env.get("TES_CONNECT_PAYOUT_SCHEDULE_CHANGES_ENABLED") !== "true"
    ) {
      throw new DomainError(
        "payout_schedule_apply_disabled",
        403,
        "Alteracao de cronograma desativada.",
      );
    }

    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(config.supabaseUrl, config.serviceRoleKey);
    const stripe = createStripeClient(config.stripeApiKey);
    const filter = body.therapistProfileId
      ? `&therapist_profile_id=eq.${
        encodeURIComponent(requireUuid(body.therapistProfileId))
      }`
      : "";
    const limit = Number.isInteger(body.limit) && Number(body.limit) > 0 &&
        Number(body.limit) <= 100
      ? Number(body.limit)
      : 25;
    const accounts = await client.get<
      Array<{ id: string; stripe_account_id: string; therapist_profile_id: string }>
    >(
      `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,therapist_profile_id&is_current=eq.true${filter}&order=created_at.asc&limit=${limit}`,
    );
    const results = [];

    for (const account of accounts) {
      const remote = await retrieveAccountV2(
        config.stripeApiKey,
        account.stripe_account_id,
      );
      assertConnectAccountOwnership(remote, {
        environment: config.stripeMode,
        therapistProfileId: account.therapist_profile_id,
      });
      let settings = await retrieveBalanceSettings(stripe, account.stripe_account_id);
      const before = derivePayoutSettingsState(
        settings as unknown as Record<string, unknown>,
      );
      if (mode === "apply" && before.interval !== "daily") {
        settings = await setDailyAutomaticPayoutSchedule(
          stripe,
          account.stripe_account_id,
          createIdempotencyKey([
            "tes",
            config.stripeMode,
            "payout-schedule",
            account.id,
            "daily",
            "v2",
          ]),
        );
      }
      const after = derivePayoutSettingsState(
        settings as unknown as Record<string, unknown>,
      );
      const state = deriveConnectAccountState(remote, after);
      await client.patch(
        `/rest/v1/therapist_connect_accounts?id=eq.${encodeURIComponent(account.id)}`,
        {
          balance_settings_synced_at: new Date().toISOString(),
          operational_status: state.operationalStatus,
          payout_schedule_interval: after.interval,
          payout_status: after.payoutStatus,
          payouts_enabled: after.payoutsEnabled,
          stripe_transfers_status: state.transfersStatus,
        },
        "return=minimal",
      );
      await client.post("/rest/v1/therapist_connect_account_snapshots", {
        connect_account_id: account.id,
        snapshot: {
          operation: "payout_schedule",
          mode,
          payout_schedule_before: before.interval,
          payout_schedule_after: after.interval,
          payout_status: after.payoutStatus,
          transfers_status: state.transfersStatus,
        },
      }, "return=minimal");
      results.push({
        changed: before.interval !== after.interval,
        payoutScheduleInterval: after.interval,
        payoutStatus: after.payoutStatus,
        therapistProfileId: account.therapist_profile_id,
        transfersStatus: state.transfersStatus,
      });
    }

    return success({ mode, results });
  } catch (error) {
    return failure(error, requestId);
  }
});

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError(
      "invalid_therapist_profile_id",
      422,
      "Identificador invalido.",
    );
  }
  return value;
}

export {};
