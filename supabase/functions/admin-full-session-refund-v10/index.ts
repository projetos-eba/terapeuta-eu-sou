import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { runFullSessionRefundV10 } from "../_shared/payments/full-session-refund-v10.ts";
import { DomainError, failure, parseJsonBody, requireUser, success } from "../_shared/payments/http.ts";
import { getPaymentsConfig, getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

const runtime = getPaymentsRuntime("admin-full-session-refund-v10");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

runtime.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  const requestId = crypto.randomUUID();
  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "A ação não está disponível.");
    }
    const config = getPaymentsConfig(runtime);
    if (!config.sessionFinancialFlowV10Enabled) {
      throw new DomainError("unavailable", 503, "Esta ação não está disponível agora.");
    }
    const client = new SupabaseRestClient(config.supabaseUrl, config.serviceRoleKey);
    const user = await requireUser(client, request);
    if (user.role !== "admin") {
      throw new DomainError("forbidden", 403, "Você não tem permissão para esta ação.");
    }
    const body = await parseJsonBody<{
      paymentId?: string; requestId?: string; reason?: string;
    }>(request);
    if (!uuid.test(body.paymentId ?? "") || !uuid.test(body.requestId ?? "") ||
      typeof body.reason !== "string" || body.reason.trim().length < 20 ||
      body.reason.trim().length > 1000) {
      throw new DomainError("invalid_request", 422, "Revise os dados e informe o motivo da decisão.");
    }
    const result = await runFullSessionRefundV10({
      client, stripe: createStripeClient(config.stripeApiKey),
      environment: config.environment, actorUserId: user.id,
      paymentId: body.paymentId!, requestId: body.requestId!, reason: body.reason.trim(),
    });
    return success(result);
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
