import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  mapTherapistProfileDatabaseError,
  type TherapistProfileCommandBody,
  validateTherapistProfileCommand,
} from "./profile-command.ts";

const runtime = getRuntime("therapist-profile-command");

type PublishCommandResult = {
  contractVersion?: number;
  editor?: unknown;
  idempotentReplay?: boolean;
};

type TherapistProfileRecord = {
  id: string;
  is_public: boolean;
  public_status: string;
  status: string;
};

type TherapistVerificationRecord = {
  id: string;
  status: string;
};

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);

    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError(
        "UNAVAILABLE",
        503,
        "Configuracao Supabase ausente.",
      );
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const { user } = await requireTherapist(client, request, {
      allowBlockedStatus: false,
    });
    const command = validateTherapistProfileCommand(
      await parseJsonBody<TherapistProfileCommandBody>(request),
    );

    try {
      if (command.action === "read") {
        return success(
          await client.rpc("get_private_therapist_profile_editor_v1", {
            p_actor_user_id: user.id,
          }),
        );
      }

      if (command.action === "save_draft") {
        return success(
          await client.rpc("save_therapist_profile_draft_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_payload: command.payload,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "discard_draft") {
        return success(
          await client.rpc("discard_therapist_profile_draft_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "publish") {
        const publishResult = await client.rpc<PublishCommandResult>(
          "publish_therapist_profile_draft_v1",
          {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          },
        );

        try {
          await syncVerificationReviewQueue(client, user.id);
        } catch (syncError) {
          logVerificationSyncWarning(syncError, correlationId);
        }

        return success({
          contractVersion: publishResult.contractVersion ?? 1,
          editor: await client.rpc("get_private_therapist_profile_editor_v1", {
            p_actor_user_id: user.id,
          }),
          idempotentReplay: Boolean(publishResult.idempotentReplay),
        });
      }

      if (command.action === "unpublish") {
        return success(
          await client.rpc("unpublish_therapist_profile_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          }),
        );
      }

      throw new DomainError(
        "VALIDATION_ERROR",
        422,
        "Revise os dados do perfil.",
      );
    } catch (error) {
      throw mapTherapistProfileDatabaseError(error);
    }
  } catch (error) {
    logFailure(error, correlationId, performance.now() - startedAt);
    return failure(error, correlationId);
  }
});

function logFailure(error: unknown, correlationId: string, durationMs: number) {
  console.error(
    JSON.stringify({
      actor_role: "therapist",
      correlation_id: correlationId,
      duration_ms: Math.max(0, Math.round(durationMs)),
      error_code:
        error instanceof DomainError ? error.code : "therapist_profile_failed",
      operation: "therapist_profile_command",
    }),
  );
}

async function syncVerificationReviewQueue(
  client: SupabaseRestClient,
  userId: string,
) {
  const therapistProfiles = await client.get<TherapistProfileRecord[]>(
    `/rest/v1/therapist_profiles?user_id=eq.${encodeURIComponent(
      userId,
    )}&select=id,status,public_status,is_public&limit=1`,
  );
  const profile = therapistProfiles[0];

  if (!profile || profile.public_status !== "published" || !profile.is_public) {
    return;
  }

  const verificationRows = await client.get<TherapistVerificationRecord[]>(
    `/rest/v1/therapist_verifications?therapist_profile_id=eq.${profile.id}&select=id,status&order=submitted_at.desc.nullslast,created_at.desc&limit=1`,
  );
  const latestVerification = verificationRows[0];

  if (!latestVerification) {
    await client.post(
      "/rest/v1/therapist_verifications",
      {
        therapist_profile_id: profile.id,
      },
      "return=minimal",
    );
    await ensureProfileReviewStatus(client, profile.id, profile.status);
    return;
  }

  if (
    latestVerification.status === "changes_requested" ||
    latestVerification.status === "draft" ||
    latestVerification.status === "rejected"
  ) {
    await client.patch(
      `/rest/v1/therapist_verifications?id=eq.${latestVerification.id}`,
      {
        changes_requested: null,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      "return=minimal",
    );
    await ensureProfileReviewStatus(client, profile.id, profile.status);
    return;
  }

  if (
    profile.status === "draft" ||
    profile.status === "changes_requested" ||
    profile.status === "rejected"
  ) {
    await ensureProfileReviewStatus(client, profile.id, profile.status);
  }
}

async function ensureProfileReviewStatus(
  client: SupabaseRestClient,
  profileId: string,
  currentStatus: string,
) {
  if (
    currentStatus === "approved" ||
    currentStatus === "in_review" ||
    currentStatus === "submitted" ||
    currentStatus === "suspended"
  ) {
    return;
  }

  await client.patch(
    `/rest/v1/therapist_profiles?id=eq.${profileId}`,
    {
      status: "submitted",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

function logVerificationSyncWarning(error: unknown, correlationId: string) {
  console.error(
    JSON.stringify({
      actor_role: "therapist",
      correlation_id: correlationId,
      error_code:
        error instanceof DomainError
          ? error.code
          : "therapist_profile_verification_sync_failed",
      operation: "therapist_profile_verification_sync",
    }),
  );
}

export {};
