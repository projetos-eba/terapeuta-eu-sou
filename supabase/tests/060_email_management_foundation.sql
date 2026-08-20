begin;

select plan(8);

select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'email_action_settings' and column_name = 'automatic_dispatch_enabled'),
  'email action settings include the automatic dispatch control'
);

select is(has_table_privilege('anon', 'public.email_action_settings', 'SELECT'), false, 'anon cannot read email settings');
select is(has_table_privilege('anon', 'public.email_action_settings', 'UPDATE'), false, 'anon cannot mutate email settings');
select is(has_table_privilege('authenticated', 'public.email_action_settings', 'INSERT'), false, 'authenticated cannot insert email settings directly');
select is(has_table_privilege('authenticated', 'public.email_action_settings', 'UPDATE'), false, 'authenticated cannot update email settings directly');
select is(has_table_privilege('authenticated', 'public.email_action_settings', 'DELETE'), false, 'authenticated cannot delete email settings directly');
select is(has_table_privilege('service_role', 'public.email_action_settings', 'UPDATE'), true, 'trusted server-side runtime retains required update access');

select is(
  coalesce((select automatic_dispatch_enabled from public.email_action_settings where action_key = 'therapy_catalog_request_submitted'), true),
  true,
  'existing action configuration defaults to automatic dispatch enabled'
);

select * from finish();
rollback;
