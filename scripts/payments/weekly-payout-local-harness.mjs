import { spawnSync } from "node:child_process";

const root = new URL("../../", import.meta.url);

run("npx", [
  "supabase",
  "test",
  "db",
  "supabase/tests/084_weekly_transfer_payout_orchestration.sql",
]);
run("npx", [
  "supabase",
  "test",
  "db",
  "supabase/tests/086_daily_automatic_payout_reconciliation.sql",
]);
run("deno", [
  "test",
  "--config",
  "supabase/functions/deno.json",
  "supabase/functions/_shared/payments/payouts.test.ts",
  "supabase/functions/_shared/payments/automatic-payouts.test.ts",
  "supabase/functions/_shared/payments/connect.test.ts",
  "supabase/functions/_shared/email/templates.test.ts",
]);

const stripe = spawnSync("stripe", ["balance", "retrieve"], {
  cwd: root,
  encoding: "utf8",
});
if (stripe.status !== 0) {
  throw new Error("Stripe CLI test-mode connectivity could not be verified.");
}
const balance = JSON.parse(stripe.stdout);
if (balance?.livemode !== false) {
  throw new Error("Weekly payout local harness refuses a live Stripe context.");
}

console.log(
  JSON.stringify({
    databaseLifecycle: "passed",
    stripeCliMode: "test",
    unitContracts: "passed",
  }),
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}.`);
  }
}
