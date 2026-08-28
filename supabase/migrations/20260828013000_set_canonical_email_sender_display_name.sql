-- Normalize only Hostinger sender profiles that still use the mailbox address
-- as their display name. Explicitly customized names remain untouched.
update public.email_sender_profiles
set display_name = 'TES - Terapeuta Eu Sou'
where provider = 'hostinger_mail_api'
  and (
    btrim(display_name) = ''
    or lower(btrim(display_name)) = lower(btrim(mailbox_address))
  );
