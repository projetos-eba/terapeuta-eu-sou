# Produção

Checklist antes de produção:

- Confirmar scopes reais no app S2S.
- Confirmar que o access token S2S contém `user:read:zak:admin`.
- Confirmar autorização do General App para Meeting SDK e eventual ZAK.
- Confirmar que `@zoom/meetingsdk` atende à versão mínima exigida pela Zoom.
- Publicar/configurar webhook no Marketplace com URL remota.
- Executar `supabase db reset`, `supabase db lint` e regenerar `database.types.ts`.
- Executar `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Validar RLS com usuários de paciente, terapeuta responsável, terapeuta externo e usuário sem sessão.
- Validar que terapeuta suspenso/rejeitado não recebe acesso nem ZAK.
- Validar `session_payments.financial_status = paid` no gate de acesso.
- Definir alocação de hosts licenciados e concorrência; não promover
  `ZOOM_DEFAULT_HOST_USER_ID` único como topologia final.
- Validar comportamento quando cookies de paciente e terapeuta coexistirem.
- Criar pgTAP para grants, views, policies e RPCs Zoom.
- Definir deduplicação e atribuição de papel das participações antes de usar
  presença em qualquer decisão financeira.
- Validar replay/duplicidade de webhook.
- Validar que `bookings.meeting_url` não recebe `start_url`.
- Definir política legal de retenção dos eventos operacionais.
- Aplicar um agendamento remoto para `zoom-jobs-process` usando `supabase/schedules/zoom-jobs-cron.sql` como template, com token interno guardado em Vault.
- Garantir que o secret `zoom_jobs_process_internal_token` no Vault remoto seja igual ao secret remoto `PAYMENTS_INTERNAL_OPERATIONS_TOKEN` usado pela Edge Function.
- Rodar `npm run zoom:edge:real` com Supabase local e credenciais reais antes de promover alteração de integração.
- Rodar `npm run zoom:webhook:smoke` localmente e validar a URL pública com ngrok antes de salvar o endpoint no Zoom Marketplace.

Não declarar pronto para produção se ZAK, licença Zoom, revisão do General App, página legal ou teste real estiverem pendentes.

## Status da fase de hardening

Implementado:

- reserva de jobs com recuperação de locks antigos;
- processamento em lote limitado a 5 jobs por chamada, mantendo reserva atômica e limite de tempo;
- conclusão com `completed_at` e `dead_letter`;
- revalidação de pagamento no processador;
- cancelamento idempotente quando o Zoom já removeu a reunião;
- reconcile sem recriação duplicada;
- webhook com limite de corpo, assinatura obrigatória, eventos desconhecidos `ignored` e proteção contra regressão de status;
- smoke local de webhook e fluxo real de fila com criação/update/cancelamento remoto.

Ainda externo ao repositório:

- confirmar/autorizar ZAK no Zoom Marketplace e validar `user:read:zak:admin` no access token real;
- configurar webhook remoto no Marketplace;
- aplicar cron remoto no Supabase;
- definir retenção legal operacional.
