import { runSessionTransferWorker } from "./session-transfer-worker.ts";

declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

const claim = {
  jobId: "job_10",
  stripeEnvironment: "test" as const,
  attemptCount: 1,
  bookingId: "booking_10",
  therapistProfileId: "therapist_10",
  paymentIntentId: "pi_10",
  grossAmountCents: 10_000,
  stripeAccountId: "acct_frozen",
  sourceChargeId: "ch_original",
};

const prepared = {
  ...claim,
  transferId: "local_transfer_10",
  amountCents: 8_500,
  debtOffsetCents: 0,
  idempotencyKey: "tes:v10:session-transfer:payment_10",
  stripeTransferId: null,
  sessionPaymentId: "payment_10",
};

Deno.test("V10 worker creates one source-bound Transfer and completes locally", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      if (name === "claim_session_transfer_jobs_v10") return Promise.resolve({ claims: [claim] });
      if (name === "prepare_session_transfer_job_v10") return Promise.resolve(prepared);
      if (name === "complete_session_transfer_job_v10") return Promise.resolve({ completed: true });
      throw new Error(`unexpected_rpc:${name}`);
    },
  };
  const createCalls: unknown[] = [];
  const stripe = {
    charges: { retrieve: () => Promise.resolve({
      amount: 10_000, currency: "brl", disputed: false, paid: true,
      payment_intent: "pi_10", refunded: false, status: "succeeded",
    }) },
    transfers: {
      create(params: unknown, options: unknown) {
        createCalls.push({ params, options });
        return Promise.resolve({
          amount: 8_500, created: 1_789_000_000, currency: "brl",
          destination: "acct_frozen", destination_payment: "py_10",
          id: "tr_10", metadata: { tes_transfer_job_id: "job_10" },
          source_transaction: "ch_original",
        });
      },
      list: () => Promise.resolve({ data: [], has_more: false }),
      retrieve: () => Promise.reject(new Error("unexpected_retrieve")),
    },
  };
  const result = await runSessionTransferWorker({
    accountPreflight: () => Promise.resolve(),
    client: client as never,
    environment: "test",
    limit: 10,
    stripe: stripe as never,
    stripeApiKey: "test-key",
    workerId: "worker_10",
  });
  assertEquals(result.transferred, 1);
  assertEquals(createCalls.length, 1);
  const create = createCalls[0] as { params: Record<string, unknown>; options: Record<string, unknown> };
  assertEquals(create.params.source_transaction, "ch_original");
  assertEquals(create.params.destination, "acct_frozen");
  assertEquals(create.options.idempotencyKey, prepared.idempotencyKey);
  assertEquals(calls.at(-1)?.name, "complete_session_transfer_job_v10");
});

Deno.test("V10 retry finds the original Transfer instead of creating another", async () => {
  const retryClaim = { ...claim, attemptCount: 2 };
  const rpcNames: string[] = [];
  const client = { rpc(name: string) {
    rpcNames.push(name);
    if (name === "claim_session_transfer_jobs_v10") return Promise.resolve({ claims: [retryClaim] });
    if (name === "prepare_session_transfer_job_v10") return Promise.resolve(prepared);
    if (name === "complete_session_transfer_job_v10") return Promise.resolve({ completed: true });
    throw new Error(`unexpected_rpc:${name}`);
  } };
  let creates = 0;
  const transfer = {
    amount: 8_500, created: 1_789_000_000, currency: "brl",
    destination: "acct_frozen", destination_payment: "py_10", id: "tr_10",
    metadata: { tes_transfer_job_id: "job_10" }, source_transaction: "ch_original",
  };
  const stripe = {
    charges: { retrieve: () => Promise.resolve({
      amount: 10_000, currency: "brl", disputed: false, paid: true,
      payment_intent: "pi_10", refunded: false, status: "succeeded",
    }) },
    transfers: {
      create: () => { creates += 1; return Promise.resolve(transfer); },
      list: () => Promise.resolve({ data: [transfer], has_more: false }),
      retrieve: () => Promise.resolve(transfer),
    },
  };
  const result = await runSessionTransferWorker({
    accountPreflight: () => Promise.resolve(), client: client as never,
    environment: "test", limit: 10, stripe: stripe as never,
    stripeApiKey: "test-key", workerId: "worker_10",
  });
  assertEquals(result.transferred, 1);
  assertEquals(creates, 0);
  assertEquals(rpcNames.at(-1), "complete_session_transfer_job_v10");
});

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}
