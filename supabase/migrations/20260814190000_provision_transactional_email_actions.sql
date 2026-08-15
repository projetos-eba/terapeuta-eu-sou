-- Provision the transactional e-mail catalogue in every environment.
--
-- Sender selection remains operational configuration: an active default sender
-- or an action-specific sender must still be configured after mailbox sync.
-- Existing rows are deliberately preserved so an administrator can disable an
-- action without a later migration re-enabling it.

insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active
)
values
  (
    'email_verification',
    'auth',
    'Confirmacao de e-mail',
    'Mensagem transacional enviada para confirmar o e-mail de pacientes e terapeutas.',
    true
  ),
  (
    'password_reset',
    'auth',
    'Recuperacao de senha',
    'Mensagem transacional enviada para redefinicao segura de senha.',
    true
  )
on conflict (action_key) do nothing;

comment on table public.email_action_definitions is
  'Catalogue of transactional e-mail actions. Core auth actions are provisioned by migrations; operational state is never overwritten by deploys.';
