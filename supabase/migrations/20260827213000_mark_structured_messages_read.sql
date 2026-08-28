-- Direct UPDATE on messages is intentionally unavailable to authenticated
-- callers. Reading a participant conversation is the only allowed mutation.

create or replace function public.mark_structured_participant_messages_read_v1(
  p_conversation_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authenticated participant required' using errcode = '42501';
  end if;

  if p_conversation_id is null or not exists (
    select 1
    from public.conversations conversations
    left join public.patient_profiles patients
      on patients.id = conversations.patient_profile_id
    left join public.therapist_profiles therapists
      on therapists.id = conversations.therapist_profile_id
    where conversations.id = p_conversation_id
      and (patients.user_id = auth.uid() or therapists.user_id = auth.uid())
  ) then
    raise exception 'conversation participant required' using errcode = '42501';
  end if;

  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_profile_id <> auth.uid()
    and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_structured_participant_messages_read_v1(uuid)
  from public, anon;
grant execute on function public.mark_structured_participant_messages_read_v1(uuid)
  to authenticated;

comment on function public.mark_structured_participant_messages_read_v1(uuid) is
  'Marks only received structured messages in an authenticated conversation as read.';
