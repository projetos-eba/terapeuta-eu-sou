$ErrorActionPreference = "Stop"

Write-Host "Forwarding Stripe platform webhook events to local Supabase Edge Function."
Write-Host "Copy the whsec_* value printed by Stripe CLI into supabase/functions/.env.local as STRIPE_WEBHOOK_SECRET for local fallback."

stripe listen `
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed,invoice.payment_action_required,payment_intent.processing,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded,refund.created,refund.updated,refund.failed,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,transfer.updated,transfer.reversed `
  --forward-to http://127.0.0.1:54321/functions/v1/stripe-billing-webhook `
  --forward-connect-to http://127.0.0.1:54321/functions/v1/stripe-connect-webhook
