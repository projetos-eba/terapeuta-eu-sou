import { handleOptions } from "../_shared/auth/cors.ts";
import {
  getRuntime,
  getServiceRoleKey,
  getSiteUrl,
} from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { getProfileById } from "../_shared/auth/users.ts";
import { EmailProviderError } from "../_shared/email/errors.ts";
import { HostingerMailApiProvider } from "../_shared/email/hostinger-mail-api-provider.ts";
import { getEmailActionRegistryEntry } from "../_shared/email/registry.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import type { EmailActionKey } from "../_shared/email/types.ts";
import { isHmlProject, safeEqual, toDispatchLimit } from "./security.ts";

const runtime = getRuntime("email-outbox-dispatch");

runtime.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST")
    return response({ error: "method_not_allowed" }, 405);

  const url = runtime.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = getServiceRoleKey(runtime);
  if (!url || !serviceRoleKey) return response({ error: "unavailable" }, 503);
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const client = new SupabaseRestClient(url, serviceRoleKey);

  if (body.action === "arm_test_failure")
    return armTestFailure(request, client, url, body);

  const dispatchSecret = runtime.env.get("EMAIL_OUTBOX_DISPATCH_SECRET");
  if (
    !dispatchSecret ||
    !safeEqual(
      request.headers.get("x-email-outbox-dispatch-secret"),
      dispatchSecret,
    )
  )
    return response({ error: "unauthorized" }, 401);
  const mailApiKey = runtime.env.get("EMAIL_SERVER_API_KEY")?.trim();
  if (!mailApiKey) return response({ error: "unavailable" }, 503);

  const workerId = crypto.randomUUID();
  const rows = await client.rpc<OutboxRow[]>("claim_email_outbox_v1", {
    p_worker_id: workerId,
    p_limit: toDispatchLimit(body.limit),
  });
  const outcomes: Record<string, number> = {};
  for (const row of rows) {
    const status = await dispatchOne(client, mailApiKey, workerId, row);
    outcomes[status] = (outcomes[status] ?? 0) + 1;
  }
  return response({ ok: true, processed: rows.length, outcomes });
});

async function armTestFailure(
  request: Request,
  client: SupabaseRestClient,
  supabaseUrl: string,
  body: Record<string, unknown>,
) {
  const testSecret = runtime.env.get("EMAIL_OUTBOX_TEST_FAILURE_SECRET");
  if (
    !isHmlProject(supabaseUrl) ||
    !testSecret ||
    !safeEqual(request.headers.get("x-email-outbox-test-secret"), testSecret)
  )
    return response({ error: "not_found" }, 404);
  const actionKey = typeof body.actionKey === "string" ? body.actionKey : "";
  const recipientKey =
    typeof body.recipientKey === "string" ? body.recipientKey : "";
  if (
    !getEmailActionRegistryEntry(actionKey) ||
    !/^profile:[0-9a-f-]{36}$/i.test(recipientKey)
  )
    return response({ error: "invalid_request" }, 422);
  await client.rpc("arm_email_outbox_test_fault_v1", {
    p_action_key: actionKey,
    p_recipient_key: recipientKey,
    p_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  return response({ ok: true }, 201);
}

async function dispatchOne(
  client: SupabaseRestClient,
  mailApiKey: string,
  workerId: string,
  row: OutboxRow,
) {
  try {
    if (
      await client.rpc<boolean>("consume_email_outbox_test_fault_v1", {
        p_action_key: row.action_key,
        p_recipient_key: row.recipient_key,
      })
    ) {
      throw new EmailProviderError(
        "test_provider_failure",
        "Email provider returned an error.",
        503,
        true,
        1,
        "not_accepted",
      );
    }
    const recipient = await getProfileById(client, row.recipient_user_id);
    if (!recipient?.email)
      return finish(
        client,
        row.id,
        workerId,
        "skipped",
        "recipient_unavailable",
      );
    const delivery = await resolveDelivery(client, row, recipient);
    const result = await sendTransactionalEmail(
      client,
      new HostingerMailApiProvider({ apiKey: mailApiKey }),
      {
        actionKey: row.action_key,
        correlationId: row.id,
        dispatchMode: "automatic",
        recipient: { email: recipient.email, name: recipient.display_name },
        recipientRole: recipient.role,
        recipientUserId: recipient.id,
        relatedEntityId: row.related_entity_id,
        relatedEntityType: row.related_entity_type,
        templateData: delivery.templateData,
        deliverySnapshot: {
          senderProfileId: row.sender_profile_id,
          templateOverrides: row.template_overrides,
          templateVersion: row.template_version,
        },
      },
    );
    if (result.status === "success")
      return finish(client, row.id, workerId, "delivered", null);
    if (result.status === "skipped")
      return finish(client, row.id, workerId, "skipped", "dispatch_skipped");
    return result.deliveryOutcome === "not_accepted"
      ? finish(
          client,
          row.id,
          workerId,
          "retry_pending",
          "provider_not_accepted",
        )
      : finish(
          client,
          row.id,
          workerId,
          "dead",
          "delivery_outcome_unknown",
          true,
          "delivery_outcome_unknown",
        );
  } catch (error) {
    if (
      error instanceof Error &&
      isSkippableDeliveryError(error.message)
    )
      return finish(
        client,
        row.id,
        workerId,
        "skipped",
        error.message,
      );
    if (
      error instanceof EmailProviderError &&
      error.deliveryOutcome === "not_accepted"
    )
      return finish(
        client,
        row.id,
        workerId,
        "retry_pending",
        "provider_not_accepted",
      );
    return finish(
      client,
      row.id,
      workerId,
      "dead",
      "delivery_outcome_unknown",
      true,
      "delivery_outcome_unknown",
    );
  }
}

async function resolveDelivery(
  client: SupabaseRestClient,
  row: OutboxRow,
  recipient: NonNullable<Awaited<ReturnType<typeof getProfileById>>>,
) {
  if (row.related_entity_type === "therapy_catalog_request") {
    const request = await loadRequest(client, row.related_entity_id);
    return {
      templateData: {
        recipient_name: recipient.display_name ?? "Pessoa",
        request_name: request.informed_name,
        request_status: request.status,
        decision_message: request.decision ?? "",
        request_url: `${getSiteUrl(runtime)}/terapeuta/mensagens/solicitar-terapia?request=${encodeURIComponent(row.related_entity_id)}`,
      },
    };
  }

  if (
    row.related_entity_type === "auth_action_token" &&
    row.action_key === "password_changed"
  ) {
    return {
      templateData: {
        recipient_name: recipient.display_name ?? "Pessoa",
        support_url: `${getSiteUrl(runtime)}/ajuda`,
      },
    };
  }

  if (
    (row.related_entity_type === "therapist_profile" ||
      row.related_entity_type === "therapist_verification") &&
    isTherapistLifecycleAction(row.action_key)
  ) {
    const baseUrl = getSiteUrl(runtime);
    return {
      templateData: {
        dashboard_url: `${baseUrl}/terapeuta`,
        profile_edit_url: `${baseUrl}/terapeuta/perfil/editar`,
        profile_url: `${baseUrl}/terapeuta/perfil`,
        recipient_name: recipient.display_name ?? "Terapeuta",
      },
    };
  }

  if (row.related_entity_type === "booking" && isBookingAction(row.action_key)) {
    const booking = await loadBooking(client, row.related_entity_id);
    const isPatientAction = row.action_key.endsWith("_patient");
    const expectedRecipient = isPatientAction
      ? booking.patient
      : booking.therapist;
    const counterparty = isPatientAction ? booking.therapist : booking.patient;

    if (
      expectedRecipient.user_id !== recipient.id ||
      recipient.role !== (isPatientAction ? "patient" : "therapist")
    ) {
      throw new Error("booking_recipient_mismatch");
    }

    if (isBookingReminderAction(row.action_key)) {
      await assertBookingReminderIsCurrent(client, row, booking, recipient.id);
    }

    const baseUrl = getSiteUrl(runtime);
    return {
      templateData: {
        counterparty_name: counterparty.display_name,
        encounter_url: isPatientAction
          ? `${baseUrl}/app/encontros/${encodeURIComponent(row.related_entity_id)}`
          : `${baseUrl}/terapeuta/sessoes/${encodeURIComponent(row.related_entity_id)}`,
        meeting_date_time: formatBookingDateTime(
          booking.starts_at,
          booking.timezone,
        ),
        meeting_timezone: booking.timezone,
        recipient_name: recipient.display_name ?? expectedRecipient.display_name,
        service_title: booking.service_title_snapshot,
      },
    };
  }

  if (
    row.related_entity_type === "session_payment" &&
    isSessionPaymentAction(row.action_key)
  ) {
    const payment = await loadSessionPayment(client, row.related_entity_id);
    if (payment.patient_user_id !== recipient.id || recipient.role !== "patient") {
      throw new Error("payment_recipient_mismatch");
    }
    const baseUrl = getSiteUrl(runtime);
    return {
      templateData: {
        amount: formatCurrency(payment.gross_amount_cents, payment.currency),
        payment_url:
          row.action_key === "session_payment_declined"
            ? `${baseUrl}/app/encontros/${encodeURIComponent(payment.booking_id)}`
            : `${baseUrl}/app/pagamentos`,
        recipient_name: recipient.display_name ?? payment.patient_display_name,
        service_title: payment.service_title,
      },
    };
  }

  if (
    row.related_entity_type === "session_refund" &&
    row.action_key === "session_refund_approved"
  ) {
    const refund = await loadSessionRefund(client, row.related_entity_id);
    if (
      refund.payment.patient_user_id !== recipient.id ||
      recipient.role !== "patient"
    ) {
      throw new Error("refund_recipient_mismatch");
    }
    return {
      templateData: {
        amount: formatCurrency(refund.amount_cents, refund.currency),
        recipient_name:
          recipient.display_name ?? refund.payment.patient_display_name,
        refund_url: `${getSiteUrl(runtime)}/app/pagamentos`,
      },
    };
  }

  if (
    row.related_entity_type === "stripe_transfer" &&
    row.action_key === "therapist_payout_completed"
  ) {
    const transfer = await loadStripeTransfer(client, row.related_entity_id);
    if (
      transfer.therapist_user_id !== recipient.id ||
      recipient.role !== "therapist"
    ) {
      throw new Error("payout_recipient_mismatch");
    }
    return {
      templateData: {
        amount: formatCurrency(transfer.amount_cents, transfer.currency),
        finance_url: `${getSiteUrl(runtime)}/terapeuta/financeiro`,
        recipient_name:
          recipient.display_name ?? transfer.therapist_display_name,
      },
    };
  }

  if (
    row.related_entity_type === "therapist_subscription" &&
    isSubscriptionLifecycleAction(row.action_key)
  ) {
    const subscription = await loadTherapistSubscription(
      client,
      row.related_entity_id,
    );
    if (
      subscription.therapist_user_id !== recipient.id ||
      recipient.role !== "therapist"
    ) {
      throw new Error("subscription_recipient_mismatch");
    }
    const event = await loadTherapistSubscriptionEvent(
      client,
      row.domain_event_id,
    );
    const subscriptionUrl = `${getSiteUrl(runtime)}/terapeuta/configuracoes#plano-assinatura`;

    if (row.action_key === "therapist_subscription_created") {
      return {
        templateData: {
          date: formatDate(subscription.current_period_start ?? event.created_at),
          next_renewal_date: formatDate(subscription.current_period_end),
          plan_name: formatPlanName(event.next_plan ?? subscription.plan_code),
          recipient_name:
            recipient.display_name ?? subscription.therapist_display_name,
          subscription_url: subscriptionUrl,
        },
      };
    }

    if (row.action_key === "therapist_subscription_cancelled") {
      return {
        templateData: {
          account_status: `Plano ${formatPlanName(subscription.current_plan)}`,
          date: formatDate(subscription.ended_at ?? event.created_at),
          plan_name: formatPlanName(event.previous_plan ?? subscription.plan_code),
          recipient_name:
            recipient.display_name ?? subscription.therapist_display_name,
          subscription_url: subscriptionUrl,
        },
      };
    }

    return {
      templateData: {
        date: formatDate(event.created_at),
        new_plan_name: formatPlanName(event.next_plan ?? subscription.plan_code),
        next_renewal_date: formatDate(subscription.current_period_end),
        recipient_name:
          recipient.display_name ?? subscription.therapist_display_name,
        subscription_url: subscriptionUrl,
      },
    };
  }

  if (
    row.related_entity_type === "billing_invoice" &&
    row.action_key === "therapist_subscription_renewed"
  ) {
    const invoice = await loadSubscriptionInvoice(client, row.related_entity_id);
    const subscription = await loadTherapistSubscription(
      client,
      invoice.therapist_subscription_id,
    );
    if (
      subscription.therapist_user_id !== recipient.id ||
      recipient.role !== "therapist"
    ) {
      throw new Error("subscription_renewal_recipient_mismatch");
    }
    return {
      templateData: {
        date: formatDate(invoice.paid_at ?? invoice.created_at),
        next_renewal_date: formatDate(subscription.current_period_end),
        plan_name: formatPlanName(subscription.plan_code),
        recipient_name:
          recipient.display_name ?? subscription.therapist_display_name,
        subscription_url: `${getSiteUrl(runtime)}/terapeuta/configuracoes#plano-assinatura`,
      },
    };
  }

  throw new Error("unsupported_outbox_delivery");
}

function isTherapistLifecycleAction(actionKey: EmailActionKey) {
  return [
    "therapist_profile_submitted_for_review",
    "therapist_documents_requested",
    "therapist_profile_approved",
    "therapist_profile_rejected",
    "therapist_profile_suspended",
    "therapist_profile_reactivated",
  ].includes(actionKey);
}

function isBookingAction(actionKey: EmailActionKey) {
  return [
    "booking_confirmed_patient",
    "booking_confirmed_therapist",
    "booking_reminder_24h_patient",
    "booking_reminder_1h_patient",
    "booking_cancelled_patient",
    "booking_cancelled_therapist",
    "booking_rescheduled_patient",
    "booking_rescheduled_therapist",
  ].includes(actionKey);
}

function isBookingReminderAction(actionKey: EmailActionKey) {
  return [
    "booking_reminder_24h_patient",
    "booking_reminder_1h_patient",
  ].includes(actionKey);
}

function isSkippableDeliveryError(message: string) {
  return [
    "booking_reminder_invalidated",
    "booking_reminder_job_not_found",
  ].includes(message);
}

function isSessionPaymentAction(actionKey: EmailActionKey) {
  return [
    "session_payment_approved",
    "session_payment_declined",
    "session_payment_pending",
  ].includes(actionKey);
}

function isSubscriptionLifecycleAction(actionKey: EmailActionKey) {
  return [
    "therapist_subscription_created",
    "therapist_subscription_cancelled",
    "therapist_subscription_plan_changed",
  ].includes(actionKey);
}

async function finish(
  client: SupabaseRestClient,
  outboxId: string,
  workerId: string,
  outcome: "delivered" | "skipped" | "retry_pending" | "dead",
  error: string | null,
  reviewRequired = false,
  reviewReason: string | null = null,
) {
  const row = await client.rpc<{ status: string }>("complete_email_outbox_v1", {
    p_outbox_id: outboxId,
    p_worker_id: workerId,
    p_outcome: outcome,
    p_last_error: error,
    p_review_required: reviewRequired,
    p_review_reason: reviewReason,
  });
  return row.status;
}

async function loadRequest(client: SupabaseRestClient, id: string) {
  const rows = await client.get<
    Array<{ informed_name: string; status: string; decision: string | null }>
  >(
    `/rest/v1/therapy_catalog_requests?select=informed_name,status,decision&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!rows[0]) throw new Error("request_not_found");
  return rows[0];
}

async function loadBooking(client: SupabaseRestClient, id: string) {
  const [booking] = await client.get<
    Array<{
      patient_profile_id: string;
      service_title_snapshot: string;
      starts_at: string;
      therapist_profile_id: string;
      timezone: string;
      status: string;
      version: number;
    }>
  >(
    `/rest/v1/bookings?select=patient_profile_id,service_title_snapshot,starts_at,therapist_profile_id,timezone,status,version&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!booking) throw new Error("booking_not_found");

  const [patient, therapist] = await Promise.all([
    client.get<Array<{ display_name: string; user_id: string }>>(
      `/rest/v1/patient_profiles?select=display_name,user_id&id=eq.${encodeURIComponent(booking.patient_profile_id)}&limit=1`,
    ),
    client.get<Array<{ public_name: string; user_id: string }>>(
      `/rest/v1/therapist_profiles?select=public_name,user_id&id=eq.${encodeURIComponent(booking.therapist_profile_id)}&limit=1`,
    ),
  ]);
  if (!patient[0] || !therapist[0]) throw new Error("booking_participant_missing");

  return {
    ...booking,
    patient: {
      display_name: patient[0].display_name,
      user_id: patient[0].user_id,
    },
    therapist: {
      display_name: therapist[0].public_name,
      user_id: therapist[0].user_id,
    },
  };
}

async function assertBookingReminderIsCurrent(
  client: SupabaseRestClient,
  row: OutboxRow,
  booking: Awaited<ReturnType<typeof loadBooking>>,
  recipientUserId: string,
) {
  const [job] = await client.get<
    Array<{
      id: string;
      booking_id: string;
      booking_version: number;
      action_key: string;
      recipient_user_id: string;
      status: string;
    }>
  >(
    `/rest/v1/booking_reminder_jobs?select=id,booking_id,booking_version,action_key,recipient_user_id,status&id=eq.${encodeURIComponent(row.domain_event_id)}&limit=1`,
  );

  if (
    !job ||
    job.booking_id !== row.related_entity_id ||
    job.action_key !== row.action_key ||
    job.recipient_user_id !== recipientUserId ||
    job.status !== "enqueued"
  ) {
    throw new Error(
      job ? "booking_reminder_invalidated" : "booking_reminder_job_not_found",
    );
  }

  if (
    booking.status !== "confirmed" ||
    booking.version !== job.booking_version ||
    Date.parse(booking.starts_at) <= Date.now()
  ) {
    throw new Error("booking_reminder_invalidated");
  }

  const [payment] = await client.get<
    Array<{
      financial_status: string;
      refund_pending: boolean;
      disputed_at: string | null;
      internal_contested_at: string | null;
      admin_blocked_at: string | null;
    }>
  >(
    `/rest/v1/session_payments?select=financial_status,refund_pending,disputed_at,internal_contested_at,admin_blocked_at&booking_id=eq.${encodeURIComponent(row.related_entity_id)}&limit=1`,
  );

  if (
    !payment ||
    !["paid", "partially_refunded"].includes(payment.financial_status) ||
    payment.refund_pending ||
    payment.disputed_at !== null ||
    payment.internal_contested_at !== null ||
    payment.admin_blocked_at !== null
  ) {
    throw new Error("booking_reminder_invalidated");
  }
}

async function loadSessionPayment(client: SupabaseRestClient, id: string) {
  const [payment] = await client.get<
    Array<{
      booking_id: string;
      currency: string;
      gross_amount_cents: number;
      patient_profile_id: string;
    }>
  >(
    `/rest/v1/session_payments?select=booking_id,currency,gross_amount_cents,patient_profile_id&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!payment) throw new Error("session_payment_not_found");

  const [booking, patient] = await Promise.all([
    client.get<Array<{ service_title_snapshot: string }>>(
      `/rest/v1/bookings?select=service_title_snapshot&id=eq.${encodeURIComponent(payment.booking_id)}&limit=1`,
    ),
    client.get<Array<{ display_name: string; user_id: string }>>(
      `/rest/v1/patient_profiles?select=display_name,user_id&id=eq.${encodeURIComponent(payment.patient_profile_id)}&limit=1`,
    ),
  ]);
  if (!booking[0] || !patient[0]) throw new Error("session_payment_data_missing");

  return {
    ...payment,
    patient_display_name: patient[0].display_name,
    patient_user_id: patient[0].user_id,
    service_title: booking[0].service_title_snapshot,
  };
}

async function loadSessionRefund(client: SupabaseRestClient, id: string) {
  const [refund] = await client.get<
    Array<{
      amount_cents: number;
      currency: string;
      session_payment_id: string;
    }>
  >(
    `/rest/v1/session_refunds?select=amount_cents,currency,session_payment_id&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!refund) throw new Error("session_refund_not_found");
  return { ...refund, payment: await loadSessionPayment(client, refund.session_payment_id) };
}

async function loadStripeTransfer(client: SupabaseRestClient, id: string) {
  const [transfer] = await client.get<
    Array<{
      amount_cents: number;
      currency: string;
      therapist_profile_id: string;
    }>
  >(
    `/rest/v1/stripe_transfers?select=amount_cents,currency,therapist_profile_id&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!transfer) throw new Error("stripe_transfer_not_found");
  const [therapist] = await client.get<
    Array<{ public_name: string; user_id: string }>
  >(
    `/rest/v1/therapist_profiles?select=public_name,user_id&id=eq.${encodeURIComponent(transfer.therapist_profile_id)}&limit=1`,
  );
  if (!therapist) throw new Error("stripe_transfer_therapist_missing");
  return {
    ...transfer,
    therapist_display_name: therapist.public_name,
    therapist_user_id: therapist.user_id,
  };
}

async function loadTherapistSubscription(client: SupabaseRestClient, id: string) {
  const [subscription] = await client.get<
    Array<{
      current_period_end: string | null;
      current_period_start: string | null;
      ended_at: string | null;
      plan_code: string;
      therapist_profile_id: string;
    }>
  >(
    `/rest/v1/therapist_subscriptions?select=current_period_end,current_period_start,ended_at,plan_code,therapist_profile_id&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!subscription) throw new Error("therapist_subscription_not_found");
  const [therapist] = await client.get<
    Array<{ plan: string; public_name: string; user_id: string }>
  >(
    `/rest/v1/therapist_profiles?select=plan,public_name,user_id&id=eq.${encodeURIComponent(subscription.therapist_profile_id)}&limit=1`,
  );
  if (!therapist) throw new Error("therapist_subscription_profile_missing");
  return {
    ...subscription,
    current_plan: therapist.plan,
    therapist_display_name: therapist.public_name,
    therapist_user_id: therapist.user_id,
  };
}

async function loadTherapistSubscriptionEvent(
  client: SupabaseRestClient,
  id: string,
) {
  const [event] = await client.get<
    Array<{
      created_at: string;
      next_plan: string | null;
      previous_plan: string | null;
    }>
  >(
    `/rest/v1/therapist_subscription_events?select=created_at,next_plan,previous_plan&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!event) throw new Error("therapist_subscription_event_not_found");
  return event;
}

async function loadSubscriptionInvoice(client: SupabaseRestClient, id: string) {
  const [invoice] = await client.get<
    Array<{
      created_at: string;
      paid_at: string | null;
      therapist_subscription_id: string | null;
    }>
  >(
    `/rest/v1/billing_invoices?select=created_at,paid_at,therapist_subscription_id&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!invoice?.therapist_subscription_id)
    throw new Error("subscription_invoice_not_found");
  return invoice as typeof invoice & { therapist_subscription_id: string };
}

function formatBookingDateTime(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    throw new Error("booking_timezone_invalid");
  }
}

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    currency,
    style: "currency",
  }).format(amountCents / 100);
}

function formatDate(value: string | null) {
  if (!value) throw new Error("subscription_date_missing");
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("subscription_date_invalid");
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatPlanName(value: string) {
  if (value === "premium_plus") return "Premium Plus";
  if (value === "premium") return "Premium";
  if (value === "free") return "Free";
  throw new Error("subscription_plan_invalid");
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

type OutboxRow = {
  id: string;
  action_key: EmailActionKey;
  domain_event_id: string;
  related_entity_id: string;
  related_entity_type:
    | "auth_action_token"
    | "billing_invoice"
    | "booking"
    | "session_payment"
    | "session_refund"
    | "stripe_transfer"
    | "therapist_subscription"
    | "therapy_catalog_request"
    | "therapist_profile"
    | "therapist_verification";
  recipient_user_id: string;
  recipient_key: string;
  sender_profile_id: string | null;
  template_overrides: Record<string, string | null>;
  template_version: string;
};
