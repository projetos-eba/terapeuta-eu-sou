#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

const confirmed = process.argv.includes("--confirm-test-mutation");
const paymentId = argument("--payment-id");
const email = argument("--admin-email") ?? "admin.tes@example.test";
const password = argument("--admin-password") ?? "tes-mock-password";

if (!confirmed)
  throw new Error("Use --confirm-test-mutation para autorizar a prova local.");
if (!/^[0-9a-f-]{36}$/i.test(paymentId ?? ""))
  throw new Error("payment_id_invalid");
if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error("stripe_test_key_required");
}

const root = process.cwd();
const cli = path.join(root, "node_modules", "supabase", "dist", "supabase.js");
const status = spawnSync(process.execPath, [cli, "status", "-o", "env"], {
  cwd: root,
  encoding: "utf8",
});
if (status.status !== 0) throw new Error("local_supabase_status_failed");
const local = parseEnv(status.stdout);
const apiUrl = local.API_URL;
const anonKey = local.ANON_KEY;
const serviceRoleKey = local.SERVICE_ROLE_KEY;
if (!apiUrl || !anonKey || !serviceRoleKey)
  throw new Error("local_supabase_keys_missing");
const parsedUrl = new URL(apiUrl);
if (!["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
  throw new Error("refusing_non_local_supabase");
}

const tokenResponse = await fetch(
  `${apiUrl}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  },
);
if (!tokenResponse.ok)
  throw new Error(`local_admin_login_${tokenResponse.status}`);
const tokenBody = await tokenResponse.json();
if (!tokenBody.access_token) throw new Error("local_admin_token_missing");

const requestId = crypto.randomUUID();
const commandResponse = await fetch(
  `${apiUrl}/functions/v1/admin-full-session-refund-v10`,
  {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${tokenBody.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      paymentId,
      requestId,
      reason: "Validação integral do atendimento no ambiente local de testes.",
    }),
  },
);
const commandBody = await commandResponse.json().catch(() => ({}));
if (!commandResponse.ok) {
  const code = safeCode(
    commandBody?.error?.code ?? `http_${commandResponse.status}`,
  );
  throw new Error(code);
}

const [payments, decisions, refunds] = await Promise.all([
  serviceGet(
    `/rest/v1/session_payments?select=financial_status,service_status,transfer_status,refund_pending&id=eq.${paymentId}&limit=1`,
  ),
  serviceGet(
    `/rest/v1/session_refund_decisions_v10?select=request_id,amount_cents,reversal_state,refund_state&session_payment_id=eq.${paymentId}&limit=1`,
  ),
  serviceGet(
    `/rest/v1/session_refunds?select=amount_cents,status&session_payment_id=eq.${paymentId}&limit=2`,
  ),
]);
const payment = payments[0];
const decision = decisions[0];
if (!payment || !decision || refunds.length !== 1)
  throw new Error("local_reconciliation_missing");
if (
  payment.financial_status !== "refunded" ||
  payment.refund_pending !== false
) {
  throw new Error("local_payment_not_refunded");
}
if (decision.request_id !== requestId || decision.refund_state !== "complete") {
  throw new Error("local_decision_not_complete");
}
if (
  refunds[0].amount_cents !== decision.amount_cents ||
  refunds[0].status !== "succeeded"
) {
  throw new Error("local_refund_not_integral");
}

console.log(
  JSON.stringify({
    ok: true,
    environment: "local-and-stripe-test",
    commandStatus:
      commandBody?.data?.status ?? commandBody?.status ?? "completed",
    payment: {
      financialStatus: payment.financial_status,
      serviceStatus: payment.service_status,
      transferStatus: payment.transfer_status,
      refundPending: payment.refund_pending,
    },
    decision: {
      amountCents: decision.amount_cents,
      reversalState: decision.reversal_state,
      refundState: decision.refund_state,
    },
    refund: { amountCents: refunds[0].amount_cents, status: refunds[0].status },
  }),
);

async function serviceGet(pathname) {
  const response = await fetch(`${apiUrl}${pathname}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) throw new Error(`local_read_${response.status}`);
  return response.json();
}

function argument(name) {
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.match(/^([^=]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim().replace(/^['"]|['"]$/g, "")]),
  );
}

function safeCode(value) {
  return /^[A-Za-z0-9_]{1,80}$/.test(String(value))
    ? String(value)
    : "unexpected_error";
}
