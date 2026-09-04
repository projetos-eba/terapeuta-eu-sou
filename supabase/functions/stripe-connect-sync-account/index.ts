import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  deriveConnectAccountState,
  derivePayoutSettingsState,
  retrieveBalanceSettings,
  retrieveAccountV2,
} from "../_shared/payments/connect.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

const runtime = getPaymentsRuntime("stripe-connect-sync-account");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const { profile: therapist } = await requireTherapist(client, request);
    const rows = await client.get<
      Array<{ id: string; stripe_account_id: string }>
    >(
      `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id&therapist_profile_id=eq.${encodeURIComponent(
        therapist.id,
      )}&is_current=eq.true&limit=1`,
    );

    if (!rows[0]) {
      throw new DomainError(
        "connect_account_missing",
        404,
        "Conta de repasse nao encontrada.",
      );
    }

    const account = await retrieveAccountV2(
      config.stripeApiKey,
      rows[0].stripe_account_id,
    );
    if (account.closed === true) {
      await client.rpc("retire_therapist_connect_account_v1", {
        p_closed_at: new Date().toISOString(),
        p_stripe_account_id: rows[0].stripe_account_id,
        p_stripe_event_created_at: new Date().toISOString(),
        p_stripe_event_id: `sync:${rows[0].stripe_account_id}:closed`,
      });
      return success({
        accountClosed: true,
        onboardingStatus: "not_started",
        pendingRequirements: { currentlyDue: [], eventuallyDue: [] },
        payoutScheduleInterval: null,
        payoutStatus: "disabled",
        stripeTransfersStatus: "inactive",
      });
    }
    const stripe = createStripeClient(config.stripeApiKey);
    const balanceSettings = await retrieveBalanceSettings(
      stripe,
      rows[0].stripe_account_id,
    );
    const payoutSettings = derivePayoutSettingsState(
      balanceSettings as unknown as Record<string, unknown>,
    );
    const state = deriveConnectAccountState(account, payoutSettings);

    await client.patch(
      `/rest/v1/therapist_connect_accounts?id=eq.${encodeURIComponent(rows[0].id)}`,
      {
        charges_enabled: state.chargesEnabled,
        details_submitted: state.detailsSubmitted,
        disabled_reason: state.disabledReason,
        last_synced_at: new Date().toISOString(),
        onboarding_status: state.onboardingStatus,
        operational_status: state.operationalStatus,
        pending_requirements: state.pendingRequirements,
        payout_schedule_interval: state.payoutScheduleInterval,
        payout_status: state.payoutStatus,
        payouts_enabled: state.payoutsEnabled,
        balance_settings_synced_at: new Date().toISOString(),
        stripe_transfers_status: state.transfersStatus,
      },
      "return=minimal",
    );
    await client.rpc("recheck_connect_blocked_payments_v1", {
      p_now: new Date().toISOString(),
      p_therapist_profile_id: therapist.id,
    });
    await client.post(
      "/rest/v1/therapist_connect_account_snapshots",
      {
        connect_account_id: rows[0].id,
        snapshot: {
          account,
          balance_settings: {
            interval: payoutSettings.interval,
            payout_status: payoutSettings.payoutStatus,
          },
        },
      },
      "return=minimal",
    );

    return success({
      onboardingStatus: state.onboardingStatus,
      pendingRequirements: state.pendingRequirements,
      payoutScheduleInterval: state.payoutScheduleInterval,
      payoutStatus: state.payoutStatus,
      stripeTransfersStatus: state.transfersStatus,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
