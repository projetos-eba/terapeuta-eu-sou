#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import Stripe from "stripe";

import {
  getStripeMode,
  getStripeSecretKey,
  loadEnvFiles,
} from "./env-utils.mjs";

const HML_PROJECT_REF = "emzwqkmrryuqvqiohqnu";

loadEnvFiles(["supabase/functions/.env.homolog"]);

const bookingId = readArgument("--booking-id");
if (!/^[0-9a-f-]{36}$/i.test(bookingId ?? "")) {
  throw new Error("A valid --booking-id is required.");
}
const stripeKey = getStripeSecretKey();
if (!stripeKey || getStripeMode(stripeKey) !== "test") {
  throw new Error("Refusing: the HML Stripe key is not in Test mode.");
}

const baseUrl = `https://${HML_PROJECT_REF}.supabase.co`;
const serviceKey = readHmlServiceRoleKey();
const stripe = new Stripe(stripeKey);

const [payment] = await get(
  `/rest/v1/session_payments?select=id,therapist_profile_id,transfer_status&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`,
);
if (!payment || payment.transfer_status !== "transferred") {
  throw new Error("The dedicated HML payment has not completed its Transfer.");
}
const [account] = await get(
  `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,payout_schedule_interval,payout_status&therapist_profile_id=eq.${encodeURIComponent(payment.therapist_profile_id)}&is_current=eq.true&limit=1`,
);
if (
  !account ||
  account.payout_schedule_interval !== "daily" ||
  account.payout_status !== "enabled"
) {
  throw new Error(
    "Connected account is not configured for daily automatic Payouts.",
  );
}
const [transfer] = await get(
  `/rest/v1/stripe_transfers?select=id,payout_batch_item_id,stripe_transfer_id,stripe_destination_payment_id,stripe_connected_balance_transaction_id,connected_balance_available_on,amount_cents,transferred_at&session_payment_id=eq.${encodeURIComponent(payment.id)}&status=eq.transferred&limit=1`,
);
if (!transfer?.stripe_transfer_id)
  throw new Error("Canonical Stripe Transfer is missing.");
const [batchItem] = await get(
  `/rest/v1/payout_batch_items?select=id,payout_batch_id,status&id=eq.${encodeURIComponent(transfer.payout_batch_item_id)}&limit=1`,
);
const [batch] = batchItem
  ? await get(
      `/rest/v1/payout_batches?select=id,status,item_count,therapist_count&id=eq.${encodeURIComponent(batchItem.payout_batch_id)}&limit=1`,
    )
  : [];

const [
  providerTransfer,
  providerBalance,
  providerPayouts,
  localPayouts,
  allocations,
] = await Promise.all([
  stripe.transfers.retrieve(transfer.stripe_transfer_id, {
    expand: ["destination_payment.balance_transaction"],
  }),
  stripe.balance.retrieve({}, { stripeAccount: account.stripe_account_id }),
  stripe.payouts.list(
    { limit: 25 },
    { stripeAccount: account.stripe_account_id },
  ),
  get(
    `/rest/v1/stripe_payouts?select=id,status,automatic,provider_reconciliation_status,allocation_status,amount_cents,created_at&connect_account_id=eq.${encodeURIComponent(account.id)}&order=created_at.desc&limit=25`,
  ),
  get(
    `/rest/v1/stripe_payout_transfer_allocations?select=id,amount_cents,stripe_payout_id&stripe_transfer_id=eq.${encodeURIComponent(transfer.id)}&limit=2`,
  ),
]);

const destinationPayment =
  providerTransfer.destination_payment &&
  typeof providerTransfer.destination_payment === "object"
    ? providerTransfer.destination_payment
    : null;
const balanceTransaction =
  destinationPayment?.balance_transaction &&
  typeof destinationPayment.balance_transaction === "object"
    ? destinationPayment.balance_transaction
    : null;
const providerAvailableOn = balanceTransaction?.available_on
  ? new Date(balanceTransaction.available_on * 1000).toISOString()
  : transfer.connected_balance_available_on;
const automaticPayouts = providerPayouts.data.filter(
  (payout) => payout.automatic === true && payout.livemode === false,
);
const brlAvailable = sumCurrency(providerBalance.available, "brl");
const brlPending = sumCurrency(providerBalance.pending, "brl");

console.log(
  JSON.stringify(
    {
      bookingId,
      connect: {
        dailySchedule: true,
        payoutStatus: account.payout_status,
      },
      local: {
        allocationCountForTransfer: allocations.length,
        batchStatus: batch?.status ?? null,
        itemStatus: batchItem?.status ?? null,
        latestAutomaticPayout:
          localPayouts.find((row) => row.automatic) ?? null,
        payoutCount: localPayouts.length,
      },
      ok: true,
      provider: {
        automaticPayoutCountObserved: automaticPayouts.length,
        brlAvailableCents: brlAvailable,
        brlPendingCents: brlPending,
        latestAutomaticPayout: automaticPayouts[0]
          ? {
              automatic: automaticPayouts[0].automatic,
              reconciliationStatus:
                automaticPayouts[0].reconciliation_status ?? "not_applicable",
              status: automaticPayouts[0].status,
            }
          : null,
        transferAvailableOn: providerAvailableOn,
      },
      state:
        allocations.length === 1
          ? "reconciled"
          : automaticPayouts.length > 0
            ? "provider_payout_observed_waiting_local_reconciliation"
            : "waiting_provider_automatic_payout",
    },
    null,
    2,
  ),
);

function sumCurrency(rows, currency) {
  return rows
    .filter((row) => row.currency === currency)
    .reduce((total, row) => total + row.amount, 0);
}

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok)
    throw new Error(`HML read failed with status ${response.status}.`);
  return response.json();
}

function readHmlServiceRoleKey() {
  const command = `npx.cmd supabase projects api-keys --project-ref ${HML_PROJECT_REF} -o json`;
  const output = execFileSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", command],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const keys = JSON.parse(output);
  const match = keys.find(
    (candidate) =>
      candidate.name === "service_role" && candidate.type === "legacy",
  );
  if (!match?.api_key) throw new Error("HML service role key is unavailable.");
  return match.api_key;
}

function readArgument(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : null;
}
