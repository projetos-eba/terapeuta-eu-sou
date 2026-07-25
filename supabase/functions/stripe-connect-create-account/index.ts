import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  createRecipientAccountV2,
  getAccountId,
  getPendingRequirements,
  getTransfersStatus,
} from "../_shared/payments/connect.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";

type ConnectAccountRow = {
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
    const existing = await client.get<ConnectAccountRow[]>(
      `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,onboarding_status,stripe_transfers_status&therapist_profile_id=eq.${encodeURIComponent(
        therapist.id,
      )}&limit=1`,
    );

    if (existing[0]) {
      return success({ account: existing[0], reused: true });
    }

    const profileRows = await client.get<Array<{ email: string | null }>>(
      `/rest/v1/profiles?select=email&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    const account = await createRecipientAccountV2({
      apiKey: config.stripeApiKey,
      email: profileRows[0]?.email,
      environment: config.environment,
      therapistId: therapist.id,
      therapistName: therapist.public_name,
    });
    const stripeAccountId = getAccountId(account);
    const pending = getPendingRequirements(account);
    const transfersStatus = getTransfersStatus(account);
    const status = transfersStatus === "active" ? "ready" : "account_created";
    const inserted = await client.post<ConnectAccountRow[]>(
      "/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,onboarding_status,stripe_transfers_status",
      {
        dashboard_type: "express",
        fees_collector: "application",
        last_synced_at: new Date().toISOString(),
        losses_collector: "application",
        onboarding_status: status,
        operational_status:
          transfersStatus === "active" ? "ready" : "restricted",
        pending_requirements: pending,
        stripe_account_id: stripeAccountId,
        stripe_transfers_status: transfersStatus,
        therapist_profile_id: therapist.id,
      },
      "return=representation",
    );

    await client.post(
      "/rest/v1/therapist_connect_account_snapshots",
      {
        connect_account_id: inserted[0].id,
        snapshot: account,
      },
      "return=minimal",
    );

    return success({ account: inserted[0], reused: false });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
