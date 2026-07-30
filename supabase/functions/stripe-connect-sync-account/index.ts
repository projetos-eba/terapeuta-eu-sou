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
  retrieveAccountV2,
} from "../_shared/payments/connect.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";

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
      )}&limit=1`,
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
    const state = deriveConnectAccountState(account);

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
        payouts_enabled: state.payoutsEnabled,
        stripe_transfers_status: state.transfersStatus,
      },
      "return=minimal",
    );
    await client.post(
      "/rest/v1/therapist_connect_account_snapshots",
      {
        connect_account_id: rows[0].id,
        snapshot: account,
      },
      "return=minimal",
    );

    return success({
      onboardingStatus: state.onboardingStatus,
      pendingRequirements: state.pendingRequirements,
      stripeTransfersStatus: state.transfersStatus,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
