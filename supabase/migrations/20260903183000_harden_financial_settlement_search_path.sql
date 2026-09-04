alter function public.refresh_session_transfer_eligibility(uuid, timestamptz)
  set search_path = '';

comment on function public.refresh_session_transfer_eligibility(uuid, timestamptz) is
  'Recalcula a elegibilidade do Transfer sem alterar confirmacao, presenca ou acesso Zoom; exige liquidacao Stripe recente e usa search_path endurecido.';
