drop index if exists public.therapist_subscriptions_one_active_paid_idx;

create unique index if not exists therapist_subscriptions_one_active_paid_idx
on public.therapist_subscriptions (therapist_profile_id)
where status in ('trialing', 'active', 'past_due', 'unpaid');

create index if not exists therapist_subscriptions_stripe_customer_idx
on public.therapist_subscriptions (stripe_customer_id)
where stripe_customer_id is not null;

create index if not exists billing_invoices_stripe_subscription_idx
on public.billing_invoices (stripe_subscription_id)
where stripe_subscription_id is not null;
