import { handleOptions } from "../_shared/auth/cors.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  createRecipientAccountV2,
  deriveConnectAccountState,
  getStripeV2ErrorCode,
  getAccountId,
} from "../_shared/payments/connect.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";

type ConnectAccountRow = {
  account_generation: number;
  id: string;
  onboarding_status: string;
  stripe_account_id: string;
  stripe_transfers_status: string;
};

const runtime = getPaymentsRuntime("stripe-connect-create-account");

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
    const { profile: therapist, user } = await requireTherapist(
      client,
      request,
    );
    const existing = await getExistingConnectAccount(client, therapist.id);

    if (existing[0]) {
      return success({ account: existing[0], reused: true });
    }

    const profileRows = await client.get<Array<{ email: string | null }>>(
      `/rest/v1/profiles?select=email&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    const accountGeneration = await getNextAccountGeneration(client, therapist.id);
    let account: Record<string, unknown>;
    try {
      account = await createRecipientAccountV2({
        accountGeneration,
        apiKey: config.stripeApiKey,
        email: profileRows[0]?.email,
        environment: config.environment,
        therapistId: therapist.id,
        therapistName: therapist.public_name,
      });
    } catch (error) {
      const providerCode = getStripeV2ErrorCode(error);
      if (providerCode === "account_create_activation_required") {
        console.warn(
          JSON.stringify({
            code: "CONNECT_PLATFORM_ACTIVATION_REQUIRED",
            provider_code: providerCode,
            request_id: requestId,
          }),
        );
        throw new DomainError(
          "connect_platform_activation_required",
          503,
          "A conta de recebimento ainda está sendo habilitada. Tente novamente mais tarde.",
        );
      }
      throw error;
    }
    const stripeAccountId = getAccountId(account);
    const state = deriveConnectAccountState(account);
    const inserted = await insertConnectAccount(client, {
      account_generation: accountGeneration,
      charges_enabled: state.chargesEnabled,
      details_submitted: state.detailsSubmitted,
      disabled_reason: state.disabledReason,
      last_synced_at: new Date().toISOString(),
      onboarding_status:
        state.onboardingStatus === "restricted"
          ? "account_created"
          : state.onboardingStatus,
      operational_status: state.operationalStatus,
      pending_requirements: state.pendingRequirements,
      payouts_enabled: state.payoutsEnabled,
      stripe_account_id: stripeAccountId,
      stripe_transfers_status: state.transfersStatus,
      therapist_profile_id: therapist.id,
    });

    await recordConnectAccountSnapshot(client, inserted.rows[0].id, account);

    return success({ account: inserted.rows[0], reused: inserted.reused });
  } catch (error) {
    return failure(error, requestId);
  }
});

function getExistingConnectAccount(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  return client.get<ConnectAccountRow[]>(
    `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,onboarding_status,stripe_transfers_status,account_generation&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&is_current=eq.true&limit=1`,
  );
}

async function getNextAccountGeneration(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<Array<{ account_generation: number }>>(
    `/rest/v1/therapist_connect_accounts?select=account_generation&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&order=account_generation.desc&limit=1`,
  );
  return (rows[0]?.account_generation ?? 0) + 1;
}

async function insertConnectAccount(
  client: SupabaseRestClient,
  input: {
    account_generation: number;
    charges_enabled: boolean;
    details_submitted: boolean;
    disabled_reason: string | null;
    last_synced_at: string;
    onboarding_status: string;
    operational_status: string;
    pending_requirements: unknown;
    payouts_enabled: boolean;
    stripe_account_id: string;
    stripe_transfers_status: string;
    therapist_profile_id: string;
  },
): Promise<{ reused: boolean; rows: ConnectAccountRow[] }> {
  try {
    const rows = await client.post<ConnectAccountRow[]>(
      "/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,onboarding_status,stripe_transfers_status,account_generation",
      {
        dashboard_type: "express",
        fees_collector: "application",
        losses_collector: "application",
        ...input,
      },
      "return=representation",
    );

    return { reused: false, rows };
  } catch (error) {
    if (error instanceof SupabaseHttpError && error.status === 409) {
      const existing = await getExistingConnectAccount(
        client,
        input.therapist_profile_id,
      );

      if (existing[0]) return { reused: true, rows: existing };
    }

    throw error;
  }
}

async function recordConnectAccountSnapshot(
  client: SupabaseRestClient,
  connectAccountId: string,
  account: Record<string, unknown>,
) {
  try {
    await client.post(
      "/rest/v1/therapist_connect_account_snapshots",
      {
        connect_account_id: connectAccountId,
        snapshot: account,
      },
      "return=minimal",
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        code: "CONNECT_ACCOUNT_SNAPSHOT_WRITE_FAILED",
        message:
          error instanceof SupabaseHttpError ? error.safeDetails : "unknown",
      }),
    );
  }
}

export {};
