$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
  $PSNativeCommandUseErrorActionPreference = $false
}

Write-Host "Forwarding Stripe platform and connected-account webhook events to local Supabase Edge Functions."
Write-Host "Webhook signing secrets emitted by Stripe CLI are redacted from this terminal. Use the homologation orchestrator to inject them into local Edge Functions."

$snapshotEvents = @(
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.finalization_failed",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "transfer.updated",
  "transfer.reversed",
  "account.updated",
  "account.external_account.updated",
  "balance_settings.updated",
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled"
) -join ","

$thinEvents = @(
  "v2.core.account.closed",
  "v2.core.account.created",
  "v2.core.account.updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.merchant].updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[defaults].updated",
  "v2.core.account[future_requirements].updated",
  "v2.core.account[identity].updated",
  "v2.core.account[requirements].updated"
) -join ","

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  & stripe listen `
    --events $snapshotEvents `
    --thin-events $thinEvents `
    --forward-to http://127.0.0.1:54321/functions/v1/stripe-billing-webhook `
    --forward-connect-to http://127.0.0.1:54321/functions/v1/stripe-connect-webhook `
    --forward-thin-to http://127.0.0.1:54321/functions/v1/stripe-connect-webhook `
    --forward-thin-connect-to http://127.0.0.1:54321/functions/v1/stripe-connect-webhook 2>&1 |
    ForEach-Object {
      $_ -replace "whsec_[A-Za-z0-9_]+", "[redacted-stripe-webhook-secret]"
    }
  $stripeExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}

exit $stripeExitCode
