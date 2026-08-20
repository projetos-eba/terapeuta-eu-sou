alter table public.email_action_settings
  add column if not exists automatic_dispatch_enabled boolean not null default true,
  add column if not exists subject_override text,
  add column if not exists preheader_override text,
  add column if not exists text_override text,
  add column if not exists html_override text;

alter table public.email_action_settings
  drop constraint if exists email_action_settings_subject_override_length,
  add constraint email_action_settings_subject_override_length check (subject_override is null or char_length(subject_override) between 1 and 240),
  drop constraint if exists email_action_settings_preheader_override_length,
  add constraint email_action_settings_preheader_override_length check (preheader_override is null or char_length(preheader_override) <= 500),
  drop constraint if exists email_action_settings_text_override_length,
  add constraint email_action_settings_text_override_length check (text_override is null or char_length(text_override) <= 30000),
  drop constraint if exists email_action_settings_html_override_length,
  add constraint email_action_settings_html_override_length check (html_override is null or char_length(html_override) <= 60000);

revoke all on public.email_action_definitions, public.email_sender_profiles, public.email_action_settings, public.email_delivery_logs from anon;
revoke insert, update, delete, truncate, references, trigger on public.email_action_definitions, public.email_sender_profiles, public.email_action_settings, public.email_delivery_logs from authenticated;
grant select on public.email_action_definitions, public.email_sender_profiles, public.email_action_settings, public.email_delivery_logs to authenticated;

comment on column public.email_action_settings.subject_override is 'Optional admin override. Defaults remain versioned in code.';
comment on column public.email_action_settings.html_override is 'Sanitized server-side before persistence and delivery.';
