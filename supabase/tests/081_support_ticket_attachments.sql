begin;

select plan(11);

select is(
  (select public from storage.buckets where id = 'support-ticket-attachments'),
  false,
  'support attachments bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'support-ticket-attachments'),
  10485760::bigint,
  'support attachments bucket limits files to 10 MB'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'support-ticket-attachments'),
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[],
  'support attachments bucket accepts only approved formats'
);

select has_table('public', 'support_ticket_message_attachments', 'attachment metadata table exists');
select has_function('public', 'attach_support_ticket_requester_attachments_v1', array['uuid', 'uuid', 'jsonb'], 'requester attachment command exists');
select has_function('public', 'admin_get_support_ticket_thread_v2', array['uuid'], 'admin thread attachment read model exists');
select has_function('public', 'admin_support_ticket_message_exists_v1', array['uuid', 'uuid'], 'admin attachment retry check exists without raw message reads');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Support participants read attachments'
  ),
  'support attachment reads use an explicit private storage policy'
);

select is(
  (select is_active from public.message_templates where key = 'therapist_cancel_processed'),
  false,
  'cancel processed is no longer active'
);

select is(
  (select is_active from public.message_templates where key = 'therapist_platform_action'),
  false,
  'platform action is no longer active'
);

select is(
  (select usage_description from public.message_templates where key = 'therapist_delay'),
  'Comunica uma janela curta de atraso.',
  'delay description uses the approved copy'
);

select * from finish();
rollback;
