#!/usr/bin/env node

import crypto from "node:crypto";
import Stripe from "stripe";

const confirmation = process.argv.includes("--confirm-test-mutation");
const inspectOnly = process.argv.includes("--inspect-only");
const destination = process.argv
  .find((argument) => argument.startsWith("--destination="))
  ?.slice("--destination=".length);
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!confirmation && !inspectOnly) {
  throw new Error(
    "Use --confirm-test-mutation para autorizar objetos Stripe Test.",
  );
}
if (!secretKey?.startsWith("sk_test_")) {
  throw new Error("A prova exige uma chave restrita ao Stripe Test.");
}
if (!/^acct_[A-Za-z0-9]+$/.test(destination ?? "")) {
  throw new Error(
    "Informe uma conta conectada de teste com --destination=acct_...",
  );
}

const stripe = new Stripe(secretKey);
const runId = `tes_v10_${crypto.randomUUID()}`;
const amountCents = 100;
const therapistAmountCents = 85;
const metadata = {
  tes_test_run: runId,
  tes_policy: "session-financial-flow-v10",
};

let chargeId = null;
let refund = null;

try {
  const account = await stripe.accounts.retrieve(destination);
  assert(account.country === "BR", "destination_is_not_brazilian");
  assert(
    account.capabilities?.transfers === "active",
    "destination_transfers_inactive",
  );
  if (inspectOnly) {
    console.log(
      JSON.stringify({
        ok: true,
        mutation: false,
        apiKeyMode: "test",
        destination: mask(account.id),
        destinationCountry: account.country,
        transfersCapability: account.capabilities.transfers,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      }),
    );
    process.exit(0);
  }

  const customer = await stripe.customers.create({
    description: "TES V10 local contract verification",
    metadata,
  });
  const setupIntent = await stripe.setupIntents.create(
    {
      customer: customer.id,
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
      usage: "off_session",
      confirm: true,
      metadata,
    },
    { idempotencyKey: `${runId}:setup` },
  );
  assert(setupIntent.status === "succeeded", "setup_intent_not_succeeded");
  const paymentMethodId = objectId(setupIntent.payment_method);
  assert(paymentMethodId, "setup_intent_payment_method_missing");

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: "brl",
      customer: customer.id,
      payment_method: paymentMethodId,
      payment_method_types: ["card"],
      off_session: true,
      confirm: true,
      metadata,
    },
    { idempotencyKey: `${runId}:charge` },
  );
  assert(paymentIntent.status === "succeeded", "payment_intent_not_succeeded");
  chargeId = objectId(paymentIntent.latest_charge);
  assert(chargeId, "payment_intent_charge_missing");

  const charge = await stripe.charges.retrieve(chargeId);
  const balanceTransactionId = objectId(charge.balance_transaction);
  const balanceTransaction = balanceTransactionId
    ? await stripe.balanceTransactions.retrieve(balanceTransactionId)
    : null;
  const fundsWerePending =
    balanceTransaction === null ||
    balanceTransaction.available_on > Math.floor(Date.now() / 1000);

  const transfer = await stripe.transfers.create(
    {
      amount: therapistAmountCents,
      currency: "brl",
      destination,
      source_transaction: chargeId,
      transfer_group: runId,
      metadata,
    },
    { idempotencyKey: `${runId}:transfer` },
  );
  assert(transfer.livemode === false, "transfer_is_not_test");
  assert(transfer.amount === therapistAmountCents, "transfer_amount_mismatch");
  assert(
    objectId(transfer.destination) === destination,
    "transfer_destination_mismatch",
  );
  assert(
    objectId(transfer.source_transaction) === chargeId,
    "transfer_source_mismatch",
  );

  const reversal = await stripe.transfers.createReversal(
    transfer.id,
    { amount: therapistAmountCents, metadata },
    { idempotencyKey: `${runId}:reversal` },
  );
  assert(reversal.amount === therapistAmountCents, "reversal_amount_mismatch");

  refund = await stripe.refunds.create(
    {
      charge: chargeId,
      amount: amountCents,
      reason: "requested_by_customer",
      metadata,
    },
    { idempotencyKey: `${runId}:refund` },
  );
  assert(
    ["pending", "succeeded"].includes(refund.status),
    "refund_unexpected_status",
  );

  const [finalTransfer, finalCharge] = await Promise.all([
    stripe.transfers.retrieve(transfer.id),
    stripe.charges.retrieve(chargeId),
  ]);
  assert(finalTransfer.reversed === true, "transfer_not_reversed");
  assert(
    finalTransfer.amount_reversed === therapistAmountCents,
    "transfer_reversal_incomplete",
  );
  assert(finalCharge.refunded === true, "charge_not_refunded");
  assert(
    finalCharge.amount_refunded === amountCents,
    "charge_refund_incomplete",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment: "test",
        destinationCountry: account.country,
        setupIntent: setupIntent.status,
        offSessionPayment: paymentIntent.status,
        fundsWerePending,
        linkedTransfer: {
          amountCents: transfer.amount,
          destinationMatches: true,
          sourceChargeMatches: true,
        },
        reversal: {
          amountCents: finalTransfer.amount_reversed,
          complete: true,
        },
        refund: {
          amountCents: finalCharge.amount_refunded,
          status: refund.status,
        },
        ids: {
          setupIntent: mask(setupIntent.id),
          paymentIntent: mask(paymentIntent.id),
          charge: mask(chargeId),
          transfer: mask(transfer.id),
          reversal: mask(reversal.id),
          refund: mask(refund.id),
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (chargeId && !refund) {
    try {
      await stripe.refunds.create(
        {
          charge: chargeId,
          amount: amountCents,
          reason: "requested_by_customer",
          metadata,
        },
        { idempotencyKey: `${runId}:cleanup-refund` },
      );
    } catch {
      // The failed proof remains visible in Stripe Test for manual inspection.
    }
  }
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.message
        : "unknown";
  console.error(
    JSON.stringify({ ok: false, environment: "test", error: safeCode(code) }),
  );
  process.exitCode = 1;
}

function objectId(value) {
  return typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value
      ? String(value.id)
      : null;
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function mask(value) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function safeCode(value) {
  return /^[A-Za-z0-9_]{1,80}$/.test(value) ? value : "unexpected_error";
}
