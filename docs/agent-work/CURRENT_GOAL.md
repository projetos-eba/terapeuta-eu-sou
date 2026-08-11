# Current Goal

## Goal

Levar o fluxo Zoom Video SDK do TES a um estado próximo de produção, evoluindo
a arquitetura existente e comprovando o ciclo completo em HML com cliente,
terapeuta e Admin, Playwright visível e persistência confirmada no Supabase.

## Scope

- agendamento pago e `video_sessions` local idempotente;
- sala de espera e janela server-side de 15 minutos;
- entrada host-first de terapeuta e paciente no Zoom Video SDK embutido;
- câmera, microfone, participantes, reconexão, saída e encerramento;
- webhooks, participações, jobs de manutenção e consistência pós-sessão;
- reflexos de sessão para paciente, terapeuta e Admin;
- harness local e homologação real em HML com evidências sanitizadas.

## Success Criteria

- Nenhuma funcionalidade Zoom existente é recriada ou substituída sem motivo.
- Backend continua autoridade de acesso, pagamento, janela e lifecycle.
- Cliente e terapeuta usam contexts Playwright independentes e visíveis.
- Uma única sessão Zoom real curta passa em HML e encerra sem sessão órfã.
- Webhooks e persistência final são confirmados na fonte Supabase de HML.
- Reflexos cliente, terapeuta e Admin permanecem coerentes e sem dados sensíveis.
- P0/P1 encontrados são corrigidos e recebem regression test, ou bloqueiam HML.

## Constraints

- Não expor secrets, JWTs, session names, user keys ou credenciais em código,
  logs, screenshots ou evidências.
- Não usar fixture paga direta como evidência transacional final.
- Não abrir sessão Zoom real antes dos gates de ambiente, webhook e pagamento.
- Não executar escrita produtiva; HML usa somente dados controlados e test mode.
- Migration, RLS, Auth, rota, provider ou permissão exigem o gate de confirmação
  explícita do `AGENTS.md` após a descoberta apontar a mudança necessária.
- O link HML com `_vercel_share` é obrigatório em toda navegação automatizada.

## Critical Paths

1. Auditar implementação, ambiente local, HML e fonte Supabase conectada.
2. Consolidar gaps e handoffs por domínio sem escrita concorrente.
3. Implementar correções pequenas, tipadas e testáveis por owner.
4. Passar gates locais de Zoom, Supabase, app, segurança e E2E headed.
5. Executar uma sessão real curta em HML com contexts isolados.
6. Confirmar webhook, persistência e reflexos cross-shell no Supabase de HML.

## Agents

- `orchestrator`: coordenação, contratos, integração e release gate.
- `sessions_zoom`: lifecycle, Zoom Video SDK, access e webhooks.
- `security_supabase`: schema, RLS, grants, idempotência e revisão final de SQL.
- `public_patient`: sala de espera e reflexo do cliente.
- `therapist_product`: entrada, controles e reflexo do terapeuta.
- `admin`: observabilidade operacional e detalhe da sessão.
- `qa_release`: harness, Playwright headed, HML e evidências.

## Dependencies

- Zoom Video SDK credentials, API credentials e webhook do ambiente alvo.
- Stripe test + webhook para pagamento canônico da booking.
- Supabase local para regressão e Supabase de HML para aceite final.
- HML `https://hml.terapeutaeusou.com.br` acessada com `_vercel_share`.
- `skills/zoom-integration`, `docs/zoom/*` e contratos de agenda/pagamentos.

## Release Gate

Estado atual desta meta: `NOT_READY`. A descoberta e os baselines locais estão
em andamento. O MCP Supabase conectado aponta para a stack local, e o Browser
MCP retornou falha de navegação para HML; esses pontos ainda precisam de uma
fonte remota compatível ou fallback operacional explícito antes do aceite final.
