-- Template para staging/producao. Substitua nomes de secrets conforme o Vault
-- do ambiente e execute somente apos revisar a URL do projeto Supabase.
--
-- Requer extensoes pg_cron, pg_net e supabase_vault habilitadas.

select cron.schedule(
  'zoom-video-session-maintenance-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := vault.decrypted_secret('SUPABASE_FUNCTIONS_BASE_URL')
      || '/zoom-video-session-maintenance?limit=10',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-tes-internal-operations-token',
      vault.decrypted_secret('PAYMENTS_INTERNAL_OPERATIONS_TOKEN')
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
