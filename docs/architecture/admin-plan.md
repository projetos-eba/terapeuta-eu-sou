# Plano Admin TES em 5 Fases

Status: plano diretor de execução para inaugurar, homologar e endurecer a area administrativa do Terapeuta Eu Sou.

Data de referencia: 2026-08-08.

Branch de trabalho: `dev-antonio`.

## Objetivo

Deixar a parte admin 100% operacional, segura, auditavel e compativel com os demais shells do produto. O admin deve operar sobre as fontes canonicas ja existentes, sem criar bancos paralelos, sem esconder falhas de infraestrutura com mocks e sem expor dados privados ou segredos.

O plano abaixo consolida o inventario do arquivo original `admin-plan.md`, as rotas canonicas em `src/lib/routes.ts`, `docs/product/sitemap.md`, `docs/product/routes-map.md` e `docs/product/page-inventory.md`, e organiza a execucao em cinco fases progressivas.

## Premissas

- Continuar na branch `dev-antonio`; nao criar branch nova.
- Usar o Figma principal do projeto como referencia visual antes de implementar telas admin: arquivo `Projeto Terapeuta Eu Sou Atualizado`, node de referencia admin `13425:778`.
- Usar `src/lib/routes.ts` como fonte canonica de rotas.
- Usar `src/lib/permissions.ts` ou contrato equivalente como fonte canonica de permissoes.
- Admin nao recebe autorizacao apenas por UI ou role visual; validacao server-side e RLS continuam obrigatorias.
- Dados demonstrativos nao podem aparecer em homologacao/producao como se fossem dados reais.
- Falha de backend nao pode virar tela vazia saudavel.
- Acoes financeiras, suspensoes, verificacoes e publicacoes precisam de motivo, permissao, idempotencia quando aplicavel, auditoria e impacto cross-shell.
- Stripe e Zoom continuam sendo fontes externas de verdade para seus respectivos eventos; admin apenas observa, reconcilia e aciona fluxos autorizados.

## Rotas Admin Canonicas

| Rota | Modulo | Status atual esperado |
| --- | --- | --- |
| `/admin` | Visao geral | Implementado como dashboard operacional inicial |
| `/admin/profissionais` | Profissionais | Implementado como listagem operacional read-only |
| `/admin/profissionais/verificacoes` | Verificacoes | Implementado como subitem de Profissionais, read-only |
| `/admin/pacientes` | Clientes | Implementado como listagem operacional read-only |
| `/admin/sessoes` | Sessoes | Implementado como listagem operacional read-only |
| `/admin/pagamentos` | Pagamentos | Implementado como leitura financeira read-only |
| `/admin/avaliacoes` | Avaliacoes | Implementado como listagem operacional read-only |
| `/admin/assinaturas` | Assinaturas | Implementado como leitura de Billing read-only |
| `/admin/terapias` | Terapias | Revisar, endurecer e homologar |
| `/admin/matching` | Match | Revisar, endurecer e homologar |
| `/admin/integracoes` | Integracoes | Rota protegida e oculta no menu |
| `/admin/seguranca` | Seguranca | Implementado como diagnostico e auditoria read-only |
| `/admin/relatorios` | Relatorios | Rota protegida e oculta no menu; exports pendentes |
| `/admin/configuracoes` | Configuracoes | Implementado como diagnostico read-only |
| `/admin/suporte` | Suporte | Implementado como listagem operacional read-only |

Regra de navegacao: o menu admin deve expor apenas modulos funcionais. Rotas em construcao podem existir internamente, mas nao devem ser anunciadas como prontas nem virar links mortos.

## Modelo Arquitetural

Fluxo padrao:

```text
Fonte canonica
  -> dominio
  -> read model admin
  -> BFF/rota server-side autenticada
  -> componente admin
```

Fluxo de mutacao:

```text
UI admin
  -> command server-side
  -> auth/authz
  -> validacao de dominio
  -> transacao/RPC/Edge Function
  -> fonte canonica
  -> evento de auditoria append-only
  -> revalidacao/cache
  -> reflexo nos shells afetados
```

Nao permitido:

- `select *` enviado cru para React.
- DTO publico reaproveitado com campos privados.
- service role no navegador.
- update direto em estados financeiros, booking status ou plano de terapeuta.
- exclusao de historico para "corrigir" tela.
- mock em producao/homologacao para esconder falha.

## Classificacao de Dados

Cada pagina admin deve declarar quais campos consome:

- `PUBLIC`: dados ja publicos.
- `OPERATIONAL`: dados necessarios para operacao.
- `FINANCIAL`: dados financeiros autorizados.
- `PRIVATE`: dados privados com permissao explicita.
- `SENSITIVE`: dados sensiveis com minimo necessario e auditoria.
- `SECRET`: nunca expor no payload ou UI.

Nunca enviar ao browser:

- senha;
- token;
- JWT;
- cookies;
- Authorization completo;
- API secret;
- service-role key;
- webhook secret;
- documento privado em payload generico;
- conteudo clinico desnecessario.

## Capacidades Admin

Capacidades a consolidar antes ou durante a Fase 1:

- `admin.dashboard.read`
- `admin.professionals.read`
- `admin.professionals.verify`
- `admin.professionals.suspend`
- `admin.patients.read`
- `admin.sessions.read`
- `admin.sessions.manage`
- `admin.payments.read`
- `admin.payments.manage`
- `admin.subscriptions.read`
- `admin.subscriptions.manage`
- `admin.therapies.read`
- `admin.therapies.manage`
- `admin.matching.read`
- `admin.matching.manage`
- `admin.reviews.read`
- `admin.reviews.moderate`
- `admin.integrations.read`
- `admin.integrations.manage`
- `admin.security.read`
- `admin.security.manage`
- `admin.reports.read`
- `admin.support.read`
- `admin.support.manage`
- `admin.audit.read`
- `admin.settings.manage`

## Fase 1 - Auditoria, Seguranca P0 e Contratos Base

### Objetivo

Criar o mapa real do admin antes de construir telas novas, fechar riscos P0/P1 de autorizacao e definir contratos estaveis para leitura, mutacao, auditoria e navegacao.

### Escopo

- Auditar rotas em `src/lib/routes.ts`, shell admin atual e links expostos.
- Comparar Figma admin, sitemap, routes-map, page inventory e codigo.
- Mapear cada rota admin para dominio, fonte canonica, read model, comandos, permissoes, RLS, cache e testes.
- Rodar auditoria Supabase local/HML quando disponivel:
  - Security Advisor;
  - views `SECURITY DEFINER`;
  - RPCs `SECURITY DEFINER`;
  - grants para `anon`, `authenticated` e service role;
  - RLS em tabelas admin-consumidas;
  - Edge Functions com `verify_jwt=false`;
  - storage buckets e signed URLs.
- Classificar cada RPC/Edge Function:
  - publica intencional;
  - autenticada intencional;
  - admin-only;
  - service-role only;
  - webhook;
  - cron/job interno;
  - legado para remover depois.
- Definir `AdminModuleRegistry` com `enabled`, `beta` e `hidden`.
- Definir read models administrativos, sem reutilizar DTO publico com campos sensiveis.
- Definir contrato de auditoria append-only para mutacoes admin.

### Entregaveis

- Matriz rota -> dominio -> fonte -> read model -> comando -> permissao -> teste.
- Registro de divergencias entre Figma, docs e codigo.
- Plano de correcao P0/P1 do Supabase/RPC/RLS/grants.
- Registro dos modulos habilitados no shell admin.
- Contrato inicial de logs e auditoria admin.

### Criterios de Saida

- Nenhum link admin exposto aponta para rota inexistente ou nao funcional.
- Nenhuma RPC admin critica fica acessivel por `anon`.
- Edge Functions sem JWT possuem justificativa e autenticacao alternativa documentada.
- A identidade do admin vem de sessao confiavel, nao de `actorUserId` enviado pelo cliente.
- P0/P1 de autorizacao conhecidos foram corrigidos ou bloqueiam a fase seguinte.

## Fase 2 - Fundacao do Shell e Visao Geral Operacional

### Objetivo

Transformar `/admin` em um centro operacional real e consolidar a base visual, responsiva, acessivel e observavel para todas as demais paginas admin.

### Escopo

- Evoluir shell admin com navegacao agrupada:
  - Visao geral;
  - Pessoas;
  - Operacao;
  - Financeiro;
  - Descoberta;
  - Plataforma.
- Reutilizar os contratos visuais existentes:
  - `AuthenticatedShell`;
  - `AppPageContainer`;
  - `AppPageHeader`;
  - `AppPageGrid`;
  - `AppPageMain`;
  - `AppPageAside`;
  - `AppPageSection`;
  - `AppPageActions`.
- Implementar estados padrao:
  - `loading`;
  - `success`;
  - `empty`;
  - `unavailable`;
  - `degraded`;
  - `forbidden`;
  - `session_expired`;
  - `configuration_missing`.
- Criar read model de dashboard admin com dados agregados reais:
  - profissionais ativos;
  - verificacoes pendentes;
  - pacientes;
  - sessoes futuras;
  - sessoes problematicas;
  - terapias publicadas;
  - pedidos de catalogo;
  - pagamentos com falha;
  - refunds/disputas;
  - repasses;
  - assinaturas;
  - Connect incompleto;
  - webhooks Stripe/Zoom com falha;
  - tickets de suporte;
  - alertas de seguranca.
- Criar `/admin/integracoes` como painel operacional sem secrets:
  - Stripe;
  - Zoom;
  - Email;
  - Supabase/Edge Functions quando aplicavel.
- Criar `/admin/seguranca` inicial:
  - eventos criticos;
  - sessoes admin;
  - permissoes;
  - findings de seguranca conhecidos;
  - trilha de auditoria.

### Entregaveis

- Shell admin coerente com Figma e tokens TES.
- Dashboard com dados reais e estados honestos.
- Registry de modulos consumido pelo menu.
- Componentes responsivos para cards, tabelas, filtros e estados.
- Logs server-side com `operation`, `requestId`, rota, status e codigo de erro.

### Criterios de Saida

- `/admin` nao mostra mock como sucesso.
- Erro de infraestrutura nao vira zero.
- Tabelas/listas funcionam com paginacao server-side.
- Layout suporta 320, 375, 768, 1024, 1280 e 1440px.
- Navegacao por teclado e foco visivel funcionam.
- `npm run lint`, `npm run typecheck` e `npm run build` passam para o escopo alterado.

### Execucao complementar - Dashboard e Integracoes (2026-08-09)

Status: implementado localmente na branch `dev-antonio`.

Mudancas:

- Criado `admin_get_dashboard_v1()` como read model admin-only para `/admin`.
- Criado `admin_get_integration_health_v1()` como read model admin-only para
  `/admin/integracoes`.
- Removidas da visao geral as contagens horizontais via REST para tabelas
  canonicas como `therapist_profiles`, `bookings`, `session_payments`,
  `stripe_webhook_events`, `zoom_video_webhook_events`,
  `email_delivery_logs` e `therapist_connect_accounts`.
- Removida da saude de integracoes a leitura horizontal via REST dessas mesmas
  fontes operacionais.
- Eventos recentes do Dashboard passam a vir de `admin_audit_events` em DTO
  sanitizado, sem `previous_state`, `next_state`, provider IDs, payloads,
  metadata crua ou secrets.
- Falha no RPC deixa metricas como `unavailable`/modulos degradados, sem
  converter erro de infraestrutura em zero.

Validacoes locais realizadas no corte:

- `npx vitest run src/features/admin-dashboard/admin-dashboard.queries.test.ts src/features/admin-platform/admin-platform.queries.test.ts`
- `npm run typecheck`
- `npx supabase db reset`
- `npx supabase test db --local supabase/tests/042_admin_dashboard_integration_health_read_models.sql`
- `npx supabase db lint`

Observacoes:

- O `db lint` manteve apenas o aviso ja conhecido de parametro nao usado em
  `public.admin_execute_operation_command_v1`.
- Validacao HML e Playwright autenticado ainda precisam ser executados no
  ambiente alvo antes de declarar o Admin 100% fechado.

## Fase 3 - Pessoas, Operacao e Moderacao

### Objetivo

Dar ao admin capacidade real de operar profissionais, pacientes, sessoes, suporte e avaliacoes sem invadir dados clinicos, sem quebrar historico e sem inconsistir os shells publico, paciente e terapeuta.

### Modulos

- `/admin/profissionais`
- `/admin/profissionais/:id`
- `/admin/profissionais/verificacoes`
- `/admin/pacientes`
- `/admin/pacientes/:id`
- `/admin/sessoes`
- `/admin/sessoes/:bookingId`
- `/admin/suporte`
- `/admin/suporte/:id`
- `/admin/avaliacoes`

### Escopo

Profissionais:

- Listagem com filtros por status, plano, publicacao, verificacao, servicos, proxima sessao, Connect e cadastro.
- Detalhe com abas:
  - resumo;
  - perfil publico;
  - servicos;
  - agenda;
  - sessoes;
  - financeiro resumido;
  - assinatura;
  - Stripe Connect;
  - verificacao;
  - documentos;
  - auditoria.
- Documentos privados sempre via bucket privado, signed URL curta, permissao explicita e evento de auditoria.
- Acoes: aprovar, rejeitar, solicitar informacao, suspender, reativar, restringir reservas, despublicar.

Clientes:

- Listagem e detalhe com dados operacionais minimos.
- Nao expor prontuario, mensagens privadas ou dados clinicos sem permissao, motivo e auditoria.
- Links cruzados para sessoes, pagamentos e tickets quando permitido.

Sessoes:

- Timeline unica:
  - criacao;
  - hold;
  - pagamento;
  - confirmacao;
  - reagendamento;
  - cancelamento;
  - Zoom;
  - entrada terapeuta/paciente;
  - conclusao;
  - refund/disputa;
  - repasse;
  - notificacoes.
- Acoes sempre via comandos de dominio, nunca por update livre de status.
- Antes de acao critica, mostrar impacto em paciente, terapeuta, financeiro, Zoom e reversibilidade.

Suporte:

- Fila com prioridade, status, categoria, usuario, responsavel, historico e SLA.
- Links para sessao, pagamento, profissional ou paciente relacionados.

Avaliacoes:

- Moderacao sem deletar historico.
- Ocultar/restaurar muda projecao publica e recalcula medias quando aplicavel.
- Preservar review original e auditar motivo.

### Criterios de Saida

- Suspender profissional remove busca/perfil publico/reserva, mas preserva historico.
- Verificacao de profissional altera apenas estados autorizados.
- Paciente nao recebe dados sensiveis desnecessarios no payload admin.
- Sessoes historicas continuam consistentes apos qualquer acao admin.
- Suporte e avaliacoes possuem trilha de auditoria.
- Playwright cobre navegacao, filtros, detalhe, dialog de cancelar e dialog de confirmar.

## Fase 4 - Financeiro, Assinaturas, Integracoes Transacionais e Relatorios

### Objetivo

Dar visibilidade operacional confiavel para dinheiro, assinaturas e integracoes, preservando Stripe/webhooks/ledger como fontes de verdade e impedindo simulacoes ou edicoes diretas perigosas.

### Modulos

- `/admin/pagamentos`
- `/admin/pagamentos/:id`
- `/admin/assinaturas`
- `/admin/assinaturas/:id`
- `/admin/integracoes`
- `/admin/relatorios`

### Escopo

Pagamentos:

- Consumir `session_payments`, tentativas, refunds, disputas, ledger, transfers e payouts.
- Estados esperados:
  - `paid`;
  - `pending`;
  - `failed`;
  - `refunded`;
  - `partially_refunded`;
  - `disputed`;
  - `transfer_pending`;
  - `transferred`;
  - `reconciliation_required`.
- Acoes financeiras inicialmente read-only quando nao houver fluxo de comando, RBAC, auditoria e homologacao.
- Refund ou ajuste financeiro so via comando autorizado e reconciliado com Stripe/ledger.

Assinaturas:

- Consumir `billing_plans`, `billing_plan_prices`, `stripe_customers`, `therapist_subscriptions`, `therapist_subscription_events` e `billing_invoices`.
- Mostrar terapeuta, plano, status, ciclo, customer, subscription, invoice, cancelamento futuro, falhas e eventos.
- Nunca editar `therapist_profiles.plan` diretamente para simular Billing.
- Mudancas de assinatura passam pelo dominio Billing/Stripe.

Integracoes:

- Stripe: ambiente, webhook, ultimos eventos, falhas, Billing, Connect, transfers, reconciliacao.
- Zoom: configuracao, webhook, eventos, falhas, manutencao, video sessions e participations.
- Email: remetentes, entregas recentes, falhas, taxa de erro e limites.
- Nunca exibir secrets; apenas `configured`, `missing`, `invalid`, `healthy` ou `degraded`.

Relatorios:

- Relatorios seguros:
  - profissionais;
  - pacientes;
  - terapias;
  - sessoes;
  - receita operacional;
  - assinaturas;
  - pagamentos;
  - refunds;
  - uso da plataforma.
- Exports server-side, autorizados, auditados, paginados/limitados e protegidos contra CSV injection.
- Sem PII desnecessaria.

### Criterios de Saida

- Redirect Stripe sozinho nao aparece como confirmacao financeira.
- Webhook e reconciliacao server-side continuam autoridade.
- Eventos repetidos Stripe/Zoom sao idempotentes.
- Nenhuma acao financeira altera ledger sem evento/auditoria.
- Relatorios nao expõem campos privados indevidos.
- Stripe/Zoom/Email aparecem diagnosticaveis sem segredo.

## Fase 5 - Catalogo, Match, Configuracoes, Homologacao Integral e Release

### Objetivo

Fechar a parte admin com catalogo e Match endurecidos, configuracoes governaveis, testes cross-shell reais e criterios de release completos.

### Modulos

- `/admin/terapias`
- `/admin/matching`
- `/admin/configuracoes`
- fechamento de todos os modulos anteriores

### Escopo

Terapias:

- Preservar a base funcional existente.
- Garantir que terapias usam fonte canonica do catalogo.
- Publicar/despublicar com impacto visivel em catalogo publico, Match, servicos do terapeuta e reservas futuras.
- Nao remover historico de servicos, bookings ou pagamentos.

Match:

- Preservar a distincao:
  - temas recomendam terapias;
  - refinamentos ranqueiam terapeutas dentro de uma terapia.
- Terapia pode ter ate 3 temas.
- Servico do terapeuta escolhe subset dos temas da terapia e ate 3 refinamentos por tema.
- Cliente escolhe ate 3 temas/refinamentos.
- Mudanca de tema/refinamento exige analise de impacto e evita relacoes orfas.

Configuracoes:

- Governar apenas configuracoes de produto e operacao.
- Secrets permanecem em secret manager/env/Supabase secrets, nunca em tabela editavel pelo admin.
- Separar:
  - product config;
  - operational config;
  - feature flags;
  - integracoes;
  - secrets externos.

Homologacao integral:

- Executar fluxos verticais:
  - admin suspende profissional -> busca/perfil/reserva refletem;
  - admin publica terapia -> catalogo/Match/servicos refletem;
  - admin altera Match -> jornada publica e servicos refletem;
  - paciente reserva -> pagamento -> terapeuta ve -> admin ve -> Zoom elegivel;
  - refund autorizado -> Stripe -> webhook -> financeiro paciente/terapeuta -> ledger -> repasse;
  - assinatura Stripe -> webhook -> capabilities -> shell terapeuta -> admin.
- Executar navegacao real com Playwright:
  - login admin;
  - abrir cada rota;
  - pesquisar;
  - filtrar;
  - paginar;
  - abrir detalhe;
  - cancelar dialogs;
  - confirmar dialogs permitidos;
  - refresh;
  - voltar/avancar;
  - segunda aba;
  - sessao expirada;
  - permissao negada;
  - mobile;
  - teclado.

### Criterios de Saida

- Todas as rotas habilitadas existem e funcionam.
- Menu nao possui links mortos.
- Dados sao reais ou estado vazio honesto.
- RBAC funciona server-side.
- RLS/grants foram auditados.
- Alertas criticos do Supabase foram tratados ou documentados com risco aceito.
- Acoes criticas sao auditadas.
- Stripe, Zoom e Email sao diagnosticaveis sem expor secrets.
- Terapias, Match, reservas, pagamentos, sessoes e Zoom continuam corretos cross-shell.
- `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build` passam.
- Playwright headed gera evidencia de navegacao e cliques reais.
- Documentacao, skills locais, sitemap/routes-map/page inventory e runbooks estao atualizados quando impactados.

## Mapa de Rotas por Fase

| Fase | Rotas principais | Resultado esperado |
| --- | --- | --- |
| 1 | todas | inventario, seguranca, RBAC, contratos, riscos P0/P1 |
| 2 | `/admin`, `/admin/integracoes`, `/admin/seguranca` | fundacao visual, dashboard real, health operacional |
| 3 | `/admin/profissionais`, `/admin/profissionais/verificacoes`, `/admin/pacientes`, `/admin/sessoes`, `/admin/suporte`, `/admin/avaliacoes` | pessoas e operacao funcionando com auditoria |
| 4 | `/admin/pagamentos`, `/admin/assinaturas`, `/admin/integracoes`, `/admin/relatorios` | financeiro e integracoes confiaveis |
| 5 | `/admin/terapias`, `/admin/matching`, `/admin/configuracoes`, todas | catalogo/Match endurecidos e homologacao completa |

## Read Models Administrativos Sugeridos

- `AdminDashboard`
- `AdminProfessionalListItem`
- `AdminProfessionalDetail`
- `AdminPatientListItem`
- `AdminPatientDetail`
- `AdminSessionListItem`
- `AdminSessionDetail`
- `AdminPaymentListItem`
- `AdminPaymentDetail`
- `AdminSubscriptionListItem`
- `AdminSubscriptionDetail`
- `AdminIntegrationHealth`
- `AdminSecurityEvent`
- `AdminSupportTicket`
- `AdminReportSummary`
- `AdminAuditEvent`

Cada read model deve ser privado do admin, minimo, paginado quando listado e protegido por permissao server-side.

## Observabilidade e Auditoria

Logs server-side devem conter:

- `operation`;
- `requestId`;
- `correlationId`;
- rota;
- actor admin;
- permissao avaliada;
- target type;
- target id;
- status anterior;
- status novo;
- codigo de erro.

Nunca registrar:

- cookies;
- Authorization completo;
- tokens;
- secret keys;
- webhook secrets;
- service role key;
- dados bancarios completos;
- dados clinicos desnecessarios.

Eventos de auditoria append-only devem conter:

- `eventId`;
- `actorUserId`;
- `permission`;
- `action`;
- `targetType`;
- `targetId`;
- `previousState`;
- `nextState`;
- `reason`;
- `requestId`;
- `correlationId`;
- `createdAt`.

## Performance

Listagens admin devem evitar arquitetura O(N) no frontend:

- filtro no banco;
- ordenacao no banco;
- paginacao server-side;
- indices adequados;
- cursor quando necessario;
- agregacoes dedicadas;
- `EXPLAIN ANALYZE` para consultas criticas.

Escalas de referencia:

- 10.000 profissionais;
- 100.000 pacientes;
- 1.000.000 bookings;
- alto volume de eventos Stripe/Zoom.

## Acessibilidade

Obrigatorio:

- teclado completo;
- focus visible;
- labels;
- `aria-describedby`;
- `aria-sort` em tabelas;
- headings corretos;
- dialogs acessiveis via `TESDialog`;
- focus trap;
- retorno de foco;
- `aria-live` para estados;
- status nao depender apenas de cor;
- contraste;
- touch target;
- zoom 200%;
- texto funcional minimo 14px.

## Severidade Durante a Execucao

- `P0`: seguranca, dinheiro, perda ou vazamento de dados.
- `P1`: fluxo quebrado, autorizacao, dominio, impacto cross-shell.
- `P2`: performance, acessibilidade, cache, observabilidade.
- `P3`: melhoria futura.

Corrigir todos os P0 e P1 antes de considerar fase concluida. Corrigir P2 relacionado ao modulo em execucao. Registrar P3 no backlog.

## Criterio Global de Pronto

O admin so pode ser considerado 100% quando:

- todas as rotas habilitadas existem;
- menu nao possui links mortos;
- dados sao reais;
- fontes canonicas sao compartilhadas;
- RBAC funciona server-side;
- RLS/grants foram auditados;
- alertas criticos do Supabase foram tratados;
- dados privados nao vazam;
- acoes criticas sao auditadas;
- Stripe aparece operacionalmente sem expor secrets;
- Zoom aparece operacionalmente sem expor secrets;
- suspensoes refletem publicamente;
- historico e ledger sao preservados;
- Match continua correto;
- terapias continuam corretas;
- reservas continuam corretas;
- pagamentos continuam corretos;
- sessao/Zoom continuam corretos;
- lint passa;
- typecheck passa;
- testes passam;
- build passa;
- navegacao real passa;
- cliques reais passam;
- mobile passa;
- cross-shell passa;
- documentacao esta atualizada.

## Validacao por Fase

Comandos padrao:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Validacao real:

- Playwright headed para fluxos criticos.
- Supabase MCP/CLI para schema, grants, RLS, dados e logs quando disponivel.
- Stripe test mode/CLI para eventos financeiros quando o modulo financeiro for tocado.
- Zoom homologation runbook para fluxos de video quando o modulo de sessoes/integracoes for tocado.
- Screenshots, traces, console errors e network errors arquivados como evidencia.

## Relatorio Obrigatorio por Fase

Cada fase deve encerrar com:

- diagnostico inicial;
- arquivos alterados;
- rotas tocadas;
- fontes canonicas usadas;
- read models criados/alterados;
- comandos/RPCs/Edge Functions criados/alterados;
- migrations criadas, se houver;
- RLS/grants afetados;
- diferencas intencionais em relacao ao Figma;
- testes executados e resultados;
- navegacao real executada;
- evidencias Supabase/Stripe/Zoom quando aplicavel;
- riscos residuais;
- pendencias P2/P3;
- impacto documental:
  - `Documentacao atualizada`;
  - `Documentacao revisada, sem alteracao necessaria`;
  - `Documentacao pendente`.

Nao declarar "homologado", "seguro" ou "concluido" enquanto houver P0/P1 aberto ou enquanto build, testes e navegacao critica nao tiverem sido efetivamente validados.

## Execucao da Fase 1 - 2026-08-08

Status: executada em diagnostico local com uma correcao de base no shell admin.

Ambiente Supabase consultado via MCP: `http://127.0.0.1:54321`.

### Evidencias Locais

- Rotas canonicas admin existem em `src/lib/routes.ts`.
- Paginas implementadas no App Router admin:
  - `/admin`;
  - `/admin/terapias`;
  - `/admin/matching`.
- O shell admin expunha no menu somente as tres paginas implementadas, mas o `helpHref` apontava para `/admin/suporte`, rota ainda inexistente.
- Correcao aplicada: `src/features/admin-shell/admin-shell-config.ts` agora possui `adminModuleRegistry` com `status`, `permission`, `group`, `key` e `parentKey`; somente modulos `enabled` entram na navegacao.
- Correcao aplicada: `helpHref` do shell admin foi removido enquanto nao houver card de ajuda administrativo dedicado.
- Correcao aplicada na retomada final: `/admin/profissionais/verificacoes` passou a ser subitem de `Profissionais`; `/admin/integracoes` e `/admin/relatorios` seguem protegidas e ocultas no menu.
- Teste atualizado: `src/features/admin-shell/admin-shell-config.test.ts` valida que modulos ocultos nao aparecem no menu nem no help link e que todo modulo possui contrato de permissao.

### Matriz Inicial de Modulos

| Modulo | Rota | Status Fase 1 | Permissao inicial |
| --- | --- | --- | --- |
| Visao geral | `/admin` | enabled | `admin.dashboard.read` |
| Profissionais | `/admin/profissionais` | enabled | `admin.professionals.read` |
| Verificacoes | `/admin/profissionais/verificacoes` | enabled como subitem de Profissionais | `admin.professionals.verify` |
| Pacientes | `/admin/pacientes` | enabled | `admin.patients.read` |
| Sessoes | `/admin/sessoes` | enabled | `admin.sessions.read` |
| Suporte | `/admin/suporte` | enabled | `admin.support.read` |
| Avaliacoes | `/admin/avaliacoes` | enabled | `admin.reviews.read` |
| Pagamentos | `/admin/pagamentos` | enabled | `admin.payments.read` |
| Assinaturas | `/admin/assinaturas` | enabled | `admin.subscriptions.read` |
| Terapias | `/admin/terapias` | enabled | `admin.therapies.read` |
| Match | `/admin/matching` | enabled | `admin.matching.read` |
| Integracoes | `/admin/integracoes` | hidden | `admin.integrations.read` |
| Seguranca | `/admin/seguranca` | enabled | `admin.security.read` |
| Relatorios | `/admin/relatorios` | hidden | `admin.reports.read` |
| Configuracoes | `/admin/configuracoes` | enabled | `admin.settings.read` |

### Supabase - Admin RPCs

Consulta direta em `pg_proc` confirmou:

- Funcoes `admin_*` de Terapias/Match estao com `search_path` fixado em vazio.
- Funcoes admin criticas estao com `SECURITY DEFINER`, mas `EXECUTE` aparece restrito a `service_role`, `postgres` e `supabase_admin`.
- `admin_assert_responsible_therapy_text_v1` e `admin_validate_therapy_publishable_v1` nao sao `SECURITY DEFINER` e nao estao expostas a `authenticated`.
- O fluxo atual passa pela Edge Function `admin-therapy-catalog-command`, que valida usuario autenticado e `role = admin` antes de chamar RPCs com service role.

Risco residual: as RPCs recebem `p_actor_user_id`. Hoje a Edge Function valida a sessao antes de invocar, mas os proximos comandos admin devem preferir derivar identidade do token/sessao server-side sempre que possivel, sem confiar em ator informado pelo cliente.

### Supabase - Findings de Seguranca

Security Advisor local retornou findings relevantes:

- `security_definer_view` em nivel `ERROR` para views publicas, incluindo familias `public_home_*`, `public_therapist_*` e `public_matching_*`.
- `authenticated_security_definer_function_executable` em nivel `WARN` para diversas funcoes `SECURITY DEFINER` executaveis por `authenticated`, incluindo funcoes publicas/terapeuta/metricas/reviews e helpers como `is_current_admin`.
- `rls_enabled_no_policy` em nivel `INFO` para tabelas sensiveis ou operacionais, incluindo:
  - `financial_ledger_entries`;
  - `payout_batches`;
  - `session_disputes`;
  - `session_payment_attempts`;
  - `session_refunds`;
  - `stripe_customers`;
  - `therapist_connect_account_snapshots`;
  - `therapist_profile_events`;
  - `therapist_subscription_events`;
  - `therapist_verifications`.

Interpretacao da Fase 1:

- As findings de `SECURITY DEFINER` em views publicas sao bloqueio P1 para declarar admin 100%, mas nao precisam ser corrigidas dentro desta fase sem revisar cada contrato publico.
- Tabelas RLS sem policy podem estar intencionalmente `service_role only`; porem viram bloqueio para os modulos admin que precisarem le-las por REST com token admin comum.
- Para a Fase 2, o dashboard nao deve depender de leitura REST direta em tabelas sem `authenticated select` quando o resultado for metrica operacional critica. Preferir read model admin dedicado ou Edge/BFF server-side.

### Supabase - Grants das Fontes Admin

Consulta sobre fontes canonicas mostrou:

- Todas as fontes avaliadas possuem RLS habilitado.
- Algumas tabelas financeiras/operacionais usadas pelo dashboard atual nao possuem `SELECT` para `authenticated`, por exemplo:
  - `financial_ledger_entries`;
  - `payout_batches`;
  - `session_disputes`;
  - `session_payment_attempts`;
  - `session_refunds`;
  - `stripe_customers`;
  - `therapist_connect_account_snapshots`;
  - `therapist_subscription_events`;
  - `therapist_verifications`.
- Isso confirma que contagens admin por REST podem cair corretamente em `unavailable`, mas nao devem ser tratadas como dado zero.

### Edge Functions

`supabase/config.toml` contem muitas funcoes com `verify_jwt = false`.

Classificacao inicial:

- Webhooks e callbacks externos podem permanecer sem JWT se validarem assinatura/replay/idempotencia:
  - `stripe-billing-webhook`;
  - `stripe-connect-webhook`;
  - `zoom-webhook`.
- Login, cadastro, verificacao de email e reset de senha tambem podem exigir `verify_jwt = false`, desde que tenham validacao, rate limit e tokens proprios.
- Funcoes operacionais autenticadas com `verify_jwt = false` precisam ser auditadas antes de exposicao admin:
  - `stripe-create-subscription-checkout`;
  - `stripe-change-therapist-subscription`;
  - `stripe-cancel-therapist-subscription`;
  - `stripe-connect-create-account`;
  - `session-booking-checkout`;
  - `session-reschedule`;
  - `request-session-cancellation`;
  - `confirm-session-by-therapist`;
  - `therapist-schedule-update`;
  - `therapist-blocks-update`;
  - `zoom-video-session-access`.
- Jobs internos sem JWT precisam de segredo interno ou contexto seguro:
  - `auto-confirm-sessions`;
  - `evaluate-transfer-eligibility`;
  - `create-weekly-payout-batch`;
  - `process-payout-batch`;
  - `retry-failed-payout-items`;
  - `reconcile-stripe-transfers`;
  - `zoom-video-session-maintenance`.

### Logs

Tentativas de consultar logs via MCP para `edge-function`, `api` e `postgres` retornaram `fetch failed`. Portanto, logs reais nao foram validados nesta execucao e continuam pendentes para HML/remoto.

### Changelog Supabase Relevante

Breaking changes revisados no changelog Supabase:

- Novas tabelas no schema `public` podem nao ser expostas automaticamente na Data API. Toda tabela/read model admin novo precisa confirmar exposicao, grants e RLS.
- Remocao/migracao de endpoints antigos de logs da Management API pode impactar scripts de observabilidade, se existirem.
- Mudancas self-hosted de gateway/PG17 nao impactam diretamente o Supabase local atual, que esta em Postgres 15 conforme `supabase/config.toml`.

### Decisoes da Fase 1

- Manter o admin shell expondo apenas `/admin`, `/admin/terapias` e `/admin/matching`.
- Nao criar migration nesta fase, porque os findings amplos exigem classificacao por dominio antes de alterar grants/RLS/views.
- Nao corrigir em massa views `SECURITY DEFINER` nesta fase; abrir como trilha P1 de hardening com revisao de contrato publico.
- Fase 2 deve criar read model admin dedicado para dashboard/health, evitando dependencia direta de muitas tabelas com grants heterogeneos.
- Qualquer nova rota admin so entra no registry como `enabled` depois de pagina, dados, permissao, estado vazio/erro e teste existirem.

### Pendencias para Fase 2

- Criar read model/BFF admin para dashboard operacional.
- Transformar findings Supabase Advisor em backlog priorizado P0/P1/P2 com dono por dominio.
- Validar logs reais em HML/remoto.
- Inspecionar Figma admin node `13425:778` via MCP/plugin quando disponivel.
- Definir contrato persistente de auditoria admin antes da primeira mutacao nova.
- Reavaliar `SECURITY DEFINER` views publicas com foco em `security_invoker` ou revogacao de acesso quando aplicavel.

Impacto documental: Documentacao atualizada.

## Correcao da fila de verificacoes - 2026-08-11

Diagnostico confirmado na homologacao com Playwright visivel e operacao somente
leitura: a pagina de profissionais registrava perfis `draft` com ciclo publico
`published`, enquanto a fila de verificacoes permanecia vazia. A publicacao era
concluida antes de uma sincronizacao posterior da Edge Function; falhas nessa
etapa eram registradas sem reverter a publicacao.

Decisao implementada:

- publicacao e entrada em `therapist_verifications` passam a compartilhar a
  mesma transacao no banco;
- perfil publicado elegivel sem fila recebe `submitted`, sem aprovacao
  automatica;
- reenvios apos ajustes ou nao aprovacao reutilizam o registro mais recente;
- perfis aprovados e suspensos nao sao rebaixados;
- o Admin apresenta `Perfil em construcao`, `Aguardando analise` e `Em analise`
  como etapas distintas;
- em `submitted`, a unica acao e iniciar a analise; decisoes ficam disponiveis
  somente em `in_review`.
- a mesma sequencia e validada no banco para impedir que chamadas diretas aos
  comandos pulem a etapa de analise ou reabram uma aprovacao.

Migration: `20260811113000_sync_published_profiles_to_verification_queue.sql`.
Teste pgTAP: `044_therapist_verification_queue_sync.sql`.

Impacto documental: Documentacao atualizada.

## Retomada Admin - 2026-08-09 - Contratos v2 de listas e comandos

Status: executada localmente como endurecimento incremental das fases 1 a 5 do
fechamento Admin, sem criar branch nova.

### Entregas

- Consolidado o patch anterior de dashboard e health de integracoes no commit
  `5b56b7ca` (`fix(admin): centralize dashboard integration read models`).
- Criada a migration
  `supabase/migrations/20260809145029_admin_module_pagination_v2.sql`.
- Criados os contratos:
  - `admin_get_operation_module_v2(p_module text, p_query jsonb)`;
  - `admin_get_finance_module_v2(p_module text, p_query jsonb)`;
  - `admin_execute_operation_command_v2(...)`.
- Criado o parser compartilhado `src/features/admin-shared/admin-list-query.ts`
  para `q`, `status`, `sort`, `page` e `pageSize`.
- As paginas `/admin/profissionais`, `/admin/profissionais/verificacoes`,
  `/admin/pacientes`, `/admin/sessoes`, `/admin/suporte`,
  `/admin/avaliacoes`, `/admin/pagamentos`, `/admin/assinaturas` e
  `/admin/relatorios` passaram a receber filtros/paginacao via URL.
- Financeiro e Relatorios deixaram de usar leitura REST horizontal de tabelas no
  shell; todos os modulos financeiros passam pela RPC v2.
- Verificacoes ganhou comandos adicionais:
  - `verification.pause_review`;
  - `verification.reopen_review`.

### Contrato v2

Entrada `p_query`:

```json
{
  "search": "texto opcional",
  "status": "status allowlisted pela UI",
  "sort": "recent|oldest|status|name|amount",
  "page": 1,
  "pageSize": 12
}
```

Saida:

```json
{
  "generatedAt": "...",
  "module": "...",
  "metrics": {},
  "rows": [],
  "page": {
    "page": 1,
    "pageSize": 12,
    "total": 0,
    "hasNext": false
  },
  "filtersApplied": {}
}
```

### Guardrails preservados

- `anon` nao executa RPCs admin v2.
- `authenticated` pode invocar as RPCs, mas cada funcao valida `auth.uid()` como
  perfil admin ativo antes de retornar dados.
- `service_role` continua permitido somente em contexto servidor.
- Listas continuam sem documentos privados, URL secreta de reuniao, comentario
  completo de review, descricao completa de ticket, payload Stripe, IDs
  externos Stripe e metadados brutos.
- Comandos de verificacao exigem motivo, `requestId`, permissao admin e
  auditoria append-only.

### Validacao executada

Comandos executados:

```bash
npm run typecheck
npx vitest run src/features/admin-shared/admin-list-query.test.ts src/features/admin-operations/admin-operations.queries.test.ts src/features/admin-finance/admin-finance.queries.test.ts src/app/api/admin/operations/route.test.ts
npx supabase db reset
npx supabase test db --local supabase/tests/043_admin_module_pagination_v2.sql
npm run lint
```

Resultados:

- Typecheck: passou.
- Testes unitarios focados: 4 arquivos, 12 testes passaram.
- Supabase db reset: passou com a migration v2.
- pgTAP v2: 19 testes passaram.
- Lint: passou.

### Limite residual conhecido

As RPCs v2 mantem o contrato publico estavel e filtram/paginam server-side sobre
DTOs ja sanitizados, com janela interna limitada a ate 50 registros por modulo.
Isso elimina filtragem local no React e remove REST horizontal do shell, mas nao
substitui ainda uma busca indexada em toda a base para alto volume. Se a base
administrativa crescer alem dessa janela, a implementacao interna da v2 deve ser
trocada por SQL especifico por modulo, mantendo o mesmo contrato de entrada e
saida.

Impacto documental: Documentacao atualizada.

## Execucao Complementar Admin Operations - 2026-08-09

Status: implementada localmente para corrigir Profissionais/Clientes exibindo
zero apesar de haver dados reais.

### Causa-raiz

`src/features/admin-operations/admin-operations.queries.ts` consultava tabelas
canonicas diretamente via PostgREST usando o access token do admin. As RLS
dessas tabelas foram desenhadas para leitura horizontal restrita por paciente,
terapeuta e superficies publicas; portanto o admin nao deve ser tratado como
cliente privilegiado generico das tabelas.

O comportamento correto e distinguir:

- dado real zero;
- acesso restrito;
- falha de consulta;
- configuracao ausente.

### Matriz da Correcao

| Pagina admin | Fonte anterior | Problema | Fonte correta | Acao |
| --- | --- | --- | --- | --- |
| Profissionais | REST direto em `therapist_profiles` | RLS podia transformar dado real em zero/indisponivel | `admin_get_operation_module_v1('professionals')` | Read model admin com DTO minimo |
| Clientes | REST direto em `patient_profiles` | RLS podia transformar dado real em zero/indisponivel | `admin_get_operation_module_v1('patients')` | Read model admin com agregados minimos |
| Sessoes | REST direto em `bookings` | risco de expor URL/dado operacional sensivel | `admin_get_operation_module_v1('sessions')` | DTO sem `meeting_url` |
| Suporte | REST direto em `support_tickets` | risco de expor descricao/contexto sensivel | `admin_get_operation_module_v1('support')` | DTO sem descricao completa |
| Avaliacoes | REST direto em `reviews` | risco de expor comentario completo na lista | `admin_get_operation_module_v1('reviews')` | DTO sem corpo do comentario |
| Verificacoes | REST direto em `therapist_verifications` | risco de expor metadados/documentos privados | `admin_get_operation_module_v1('verifications')` | DTO sem documentos privados |

### Entregas

- Criada a RPC `public.admin_get_operation_module_v1(text, integer, integer)`.
- RPC valida `auth.uid()` e `profiles.role = admin` antes de consultar fontes
  canonicas.
- RPC usa `SECURITY DEFINER`, `set search_path = ''`, schema explicito,
  `revoke` de `public/anon` e `grant execute` apenas para `authenticated` e
  `service_role`.
- Adapter Next passou a chamar a RPC em vez de consultar tabelas diretamente.
- UI passou a mostrar `Acesso restrito` quando a resposta for `401/403`, e
  `Indisponivel` quando houver falha operacional.
- Menu admin ocultou `Verificacoes`, `Integracoes` e `Relatorios` do menu
  principal sem remover as rotas.
- `AuthenticatedShell` passou a aceitar ausencia de `helpHref`; Admin nao
  renderiza mais o card lateral "Precisa de ajuda?".
- Policy de `therapist_private_documents` foi reforcada para exigir
  `uploaded_by = auth.uid()` alem da propriedade do perfil.

### Evidencia Supabase

Consulta no Supabase conectado apos a migration:

- `profiles`: 26;
- `therapist_profiles`: 14;
- `patient_profiles`: 11;
- `bookings`: 44;
- `reviews`: 16;
- `support_tickets`: 2;
- `therapist_verifications`: 0;
- `admin_get_operation_module_v1`: presente.

Com claims de admin no SQL, a RPC retornou:

- Profissionais: `total-professionals = 14`, 12 linhas paginadas;
- Clientes: `total-patients = 11`, 11 linhas paginadas.

Com claims de terapeuta comum, a RPC falhou com `admin permission required`.

### Validacao

Comandos executados:

```bash
npx supabase db reset
npx supabase test db supabase/tests/039_admin_operation_read_models.sql
npm run typecheck
npm run lint
npm run test
npm run build
npx supabase test db
```

Resultados:

- Migration aplicada localmente via reset.
- Teste focado novo: 21 asserts passaram.
- Typecheck: passou.
- Lint: passou.
- Vitest: 98 arquivos, 365 testes passaram.
- Build Next: passou.
- pgTAP completo: 40 arquivos, 1016 testes passaram.

### Pendencias

- Evoluir filtros, busca e paginacao server-side por modulo.
- Detalhes operacionais iniciais foram criados para Profissionais, Clientes,
  Sessoes, Suporte, Avaliacoes e Verificacoes usando RPC segura dedicada.
- Comandos administrativos iniciais foram criados para verificacao,
  suspensao/reativacao, suporte e moderacao. Operacoes financeiras e comandos
  de sessao permanecem pendentes de boundary proprio.
- Aplicar as migrations no ambiente HML antes de validar a UI remota.
- Executar Playwright headed contra HML apos deploy das migrations.

Impacto documental: Documentacao atualizada.

## Execucao Complementar Admin Detalhes - 2026-08-09

Status: implementada localmente como Fase 2 de detalhes operacionais seguros.

### Entregas

- Criada a RPC `public.admin_get_operation_detail_v1(text, uuid)`.
- RPC valida `auth.uid()` como perfil `admin` antes de consultar dados
  horizontais.
- RPC retorna DTO minimizado para:
  - `/admin/profissionais/:id`;
  - `/admin/profissionais/verificacoes/:id`;
  - `/admin/pacientes/:id`;
  - `/admin/sessoes/:id`;
  - `/admin/suporte/:id`;
  - `/admin/avaliacoes/:id`.
- Listagens operacionais passaram a exibir CTA `Ver detalhes`.
- Detalhes exibem seções operacionais, notas de segurança e auditoria recente
  sanitizada via `admin_audit_events`.
- Nao sao expostos:
  - `meeting_url`, JWT ou payload Zoom;
  - comentario completo de avaliacao;
  - descricao completa de ticket;
  - documentos/metadados privados de verificacao;
  - payload Stripe, Authorization, cookies ou service role.

### Validacao

Comandos executados:

```bash
npm run typecheck
npx vitest run src/features/admin-operations/admin-operations.mappers.test.ts src/features/admin-shell/admin-shell-config.test.ts src/app/api/auth/admin/login/route.test.ts
npx supabase db reset
npx supabase test db supabase/tests/039_admin_operation_read_models.sql
```

Resultados:

- Typecheck: passou.
- Vitest focado: 3 arquivos, 11 testes passaram.
- Migration aplicada localmente via reset.
- pgTAP focado: 1 arquivo, 34 testes passaram.

### Pendencias Remanescentes

- Transformar os detalhes iniciais em abas completas por dominio quando houver
  comandos e read models especificos.
- Criar comandos seguros para suspensao, verificacao, suporte e moderacao.
- Criar detalhes financeiros especificos para pagamentos e assinaturas em fase
  propria, sem expor payloads Stripe.
- Validar as novas rotas com Playwright em browser apos iniciar dev server.

Impacto documental: Documentacao atualizada.

## Execucao Complementar Admin Comandos - 2026-08-09

Status: implementada localmente como Fase 3 de comandos operacionais seguros.

### Entregas

- Criada a RPC `public.admin_execute_operation_command_v1(...)`.
- RPC valida `auth.uid()` como perfil `admin`, exige `reason` e `request_id`,
  executa somente acoes allowlisted e grava auditoria append-only via
  `record_admin_audit_event_v1`.
- Criada a rota `POST /api/admin/operations` como BFF autenticado do shell
  admin, com validacao de cookie admin, permissao por capability e payload
  minimizado.
- Criado painel de `Ações administrativas` nas paginas de detalhe elegiveis.
- Acoes habilitadas:
  - suspender/reativar profissional;
  - aprovar/reprovar/solicitar ajuste de verificacao;
  - resolver/reabrir ticket de suporte;
  - ocultar/restaurar avaliacao.
- Acoes deliberadamente fora desta fase:
  - pagamentos, estornos, repasses e conciliacao;
  - cancelamento ou reagendamento de sessoes;
  - publicacao direta de perfil e alteracao manual de plano.
- Superficies publicas e privadas relacionadas sao revalidadas apos comando,
  sem expor secrets, cookies, Authorization, service role, payload Stripe, JWT
  Zoom ou documentos privados.

### Validacao

Comandos executados:

```bash
npm run typecheck
npx vitest run src/app/api/admin/operations/route.test.ts src/features/admin-operations/admin-operations.mappers.test.ts
npx supabase db reset
npx supabase test db supabase/tests/040_admin_operation_commands.sql
npx supabase test db
npm run lint
npm run test
npm run build
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/admin-finance.spec.ts --project=chromium
```

Resultados:

- Typecheck: passou.
- Vitest focado: 2 arquivos, 12 testes passaram.
- Migration aplicada localmente via reset.
- pgTAP focado novo: 1 arquivo, 20 testes passaram.
- pgTAP completo: 41 arquivos, 1049 testes passaram.
- Lint: passou.
- Vitest completo: 100 arquivos, 374 testes passaram.
- Build Next: passou.

### Pendencias Remanescentes

- Criar boundary proprio para comandos de sessao quando houver regra de negocio
  fechada para cancelamento, reagendamento, notificacao, pagamento e Zoom.
- Criar boundary financeiro separado para refund, payout e reconciliacao,
  usando Stripe/webhooks/ledger como fontes de verdade.
- Testar IDOR e fluxo visual com Playwright em browser apos aplicar migrations
  no ambiente HML.

Impacto documental: Documentacao atualizada.

## Execucao de Hardening H1 - 2026-08-08

Status: `TESTED_LOCAL`.

Objetivo desta retomada: iniciar a fase de hardening operacional exigida apos
as cinco fases admin, priorizando findings Supabase/RPC/grants sem criar
branch, commit ou PR.

### Baseline Recebido

- Branch mantida: `dev-antonio`.
- Worktree ja continha alteracoes locais das fases anteriores; elas foram
  preservadas.
- Baseline local repetido antes/depois da correcao:
  - `npm run lint`: passou.
  - `npm run typecheck`: passou.
  - `npm run test`: passou com 91 arquivos e 347 testes.
  - `npm run build`: passou.
  - `npm run test:deno`: passou com 115 testes.
  - `npx supabase test db`: passou primeiro com 22 arquivos e 548 testes; apos
    a migration adicional de Match, passou com 23 arquivos e 559 testes.
  - `npx supabase db lint`: passou sem schema errors.

Observacao corrigida nesta retomada: `next build` registrava o evento
estruturado `public_data_query_failed` para `matching.config` porque
`/sua-jornada` buscava a configuracao publica do Match durante a coleta de dados
do build. Como o ambiente local/restrito nao consegue acessar a URL Supabase
externa nesse momento, o erro era de rede/prerender, nao de RLS/grant da view.
`/sua-jornada` agora chama `await connection()` antes de consultar o Supabase,
mantendo a leitura live em request-time e eliminando o falso erro de build sem
silenciar falhas reais em runtime/API.

### Diagnostico

O Advisor/Supabase MCP conectado aponta para um Postgres local/container
(`172.18.0.2`, usuario `postgres`, Postgres 15.8). Portanto, as evidencias de
grants abaixo sao validas para o ambiente local/MCP conectado. Logs remotos
`edge-function`, `api` e `postgres` continuaram indisponiveis via MCP com
`fetch failed`, logo HML/logs reais nao foram declarados como homologados.

Findings confirmados no Advisor:

- `security_definer_view` em views publicas como `public_home_*`,
  `public_matching_*` e `public_therapist_*`.
- `authenticated_security_definer_function_executable` em RPCs publicas e
  privadas de terapeuta/metricas/reviews.
- `rls_enabled_no_policy` em tabelas fail-closed ou internas.
- Performance Advisor ainda lista FKs sem indice, indices sem uso e policies
  permissivas multiplas.

Causa-raiz corrigida nesta etapa: funcoes internas de sessao/financeiro/job e
helpers de trigger precisavam de um teste explicito de grants para impedir
regressao de execucao direta via Data API por `anon` ou `authenticated`.

### Implementacao

Migration criada:

- `supabase/migrations/20260808210059_harden_internal_financial_rpc_grants.sql`
- `supabase/migrations/20260808212025_harden_public_matching_config_view.sql`
- `supabase/migrations/20260808213122_restrict_public_matching_therapy_themes.sql`
- `supabase/migrations/20260808213926_harden_admin_identity_helper_invoker.sql`
- `supabase/migrations/20260808215022_harden_public_therapy_slug_redirects_view.sql`
- `supabase/migrations/20260808231152_harden_therapist_service_catalog_rpc_grants.sql`
- `supabase/migrations/20260808232113_restore_service_role_service_matching_validator_grant.sql`
- `supabase/migrations/20260808232742_harden_legacy_financial_benchmark_rpc_grant.sql`
- `supabase/migrations/20260808233758_harden_therapist_profile_rpc_grants.sql`
- `supabase/migrations/20260808235102_harden_public_therapy_catalog_table_grants.sql`
- `supabase/migrations/20260809012007_harden_public_matching_therapy_themes_invoker.sql`
- `supabase/migrations/20260809012542_harden_public_therapy_catalog_invoker_views.sql`
- `supabase/migrations/20260809015135_harden_public_therapy_details_invoker.sql`
- `supabase/migrations/20260809020024_harden_public_matching_therapies_invoker.sql`
- `supabase/migrations/20260809020716_harden_public_home_testimonials_invoker.sql`

Teste criado:

- `supabase/tests/021_admin_hardening_internal_rpc_grants.sql`
- `supabase/tests/022_admin_hardening_public_matching_config_view.sql`
- `supabase/tests/023_admin_hardening_public_matching_therapy_themes.sql`
- `supabase/tests/024_admin_hardening_admin_identity_helper_invoker.sql`
- `supabase/tests/025_admin_hardening_public_therapy_slug_redirects.sql`
- `supabase/tests/026_admin_hardening_therapist_service_catalog_rpc.sql`
- `supabase/tests/018_therapist_finance_f3_advanced.sql`
- `supabase/tests/027_admin_hardening_therapist_profile_rpc_grants.sql`
- `supabase/tests/028_admin_hardening_public_therapy_catalog_table_grants.sql`
- `supabase/tests/034_admin_hardening_public_therapy_catalog_invoker_views.sql`
- `supabase/tests/035_admin_hardening_public_therapy_details_invoker.sql`
- `supabase/tests/036_admin_hardening_public_matching_therapies_invoker.sql`
- `supabase/tests/037_admin_hardening_public_home_testimonials_invoker.sql`

Correcao adicional encontrada por navegacao real:

- `src/features/admin-auth/components/admin-login-form.tsx` passou a ampliar a
  area clicavel dos campos do login admin, mantendo label associado e input com
  altura estavel.
- `tests/e2e/auth-click-regression.spec.ts` passou a clicar nos campos
  `E-mail` e `Senha` do admin e validar foco antes do submit.
- `src/app/sua-jornada/page.tsx` passou a aguardar `connection()` antes de
  chamar `getPublicMatchingConfig()`, impedindo fetch Supabase durante
  prerender/build.
- `src/features/public-matching/journey-page-prerender.test.ts` cobre a ordem
  desse boundary para evitar regressao do erro `matching.config`.

RPCs internas mantidas somente para `service_role`:

- `auto_confirm_sessions(timestamptz)`;
- `calculate_session_cancellation_policy(uuid, text, timestamptz)`;
- `confirm_session_service(uuid, session_confirmation_source, uuid, uuid, jsonb)`;
- `create_weekly_payout_batch(date, date, timestamptz, uuid)`;
- `refresh_session_transfer_eligibility(uuid, timestamptz)`;
- `prepare_profile_for_auth_user_delete_v1()`.

Helpers sem execucao externa direta:

- `confirm_session_from_review()`;
- `import_legacy_payment_projection()`;
- `sync_session_payment_projections()`;
- `enforce_therapist_profile_online_only_v1()`;
- `enforce_therapist_service_online_only_v1()`;
- `validate_availability_exception_series_v1()`;
- `validate_service_matching_write_v1()`;
- `ensure_therapy_matching_theme_limit_v1()`;
- `ensure_therapy_has_matching_theme_for_publish_v1(uuid)`;
- `ensure_service_matching_rules_v1(uuid)`.

Read models publicos preservados pelo teste:

- `get_service_available_slots_v1(uuid, timestamptz, timestamptz, integer)`;
- `get_public_therapy_therapists_v1(text, uuid[], uuid[], integer)`.

View publica endurecida nesta retomada:

- `public.public_matching_config` agora usa `security_invoker = true`.
- A decisao foi limitada a essa view porque ela depende apenas de
  `matching_versions`, `matching_themes` e `matching_interests`, que ja possuem
  grants de `SELECT` para `anon`/`authenticated` e policies RLS publicas
  restringindo versoes publicadas e temas/interesses ativos.
- Views como `public_matching_therapy_themes_v`, `public_home_*` e
  `public_therapist_*` nao foram alteradas em massa porque dependem de tabelas
  privadas ou agregacoes sensiveis e precisam de revisao de contrato por DTO.

Contrato publico adicional endurecido:

- `public.public_matching_therapy_themes_v` passou a expor somente relacoes de
  tema para terapias publicadas, publicas, nao arquivadas, visiveis no Match e
  com peso ativo em versao publicada do Match.
- A etapa posterior
  `20260809012007_harden_public_matching_therapy_themes_invoker.sql` concluiu
  o desenho RLS necessario e converteu a view para `security_invoker`, com
  grants de coluna em `therapy_matching_themes`, `matching_therapy_settings`,
  `matching_weights` e `matching_versions`. O acesso direto publico fica
  restrito aos mesmos relacionamentos ja expostos pela view, sem abrir
  `matching_weights.weight`, `reason` ou metadados internos.

Helper admin endurecido:

- `public.is_current_admin()` passou de `SECURITY DEFINER` para
  `SECURITY INVOKER`, mantendo `search_path = ''`.
- A funcao consulta apenas a propria linha visivel do caller em `profiles`, cuja
  policy permite leitura do perfil autenticado, entao nao precisa executar com
  privilegio do owner.
- `anon` perdeu `EXECUTE`; `authenticated` e `service_role` mantiveram
  `EXECUTE` para preservar as policies admin que dependem do helper.
- Ensaio transacional mostrou que converter simultaneamente
  `is_current_therapist_profile`, `is_current_patient_profile` e
  `is_related_patient_to_current_therapist` para `SECURITY INVOKER` causa
  `stack depth limit exceeded`, indicando recursao de RLS. Esses helpers foram
  mantidos como `SECURITY DEFINER` e ficaram como pendencia P1 de redesign das
  policies, nao como ajuste mecanico seguro.

View publica adicional migrada para invoker:

- `public.public_therapy_slug_redirects_v` passou a usar
  `security_invoker = true`.
- A alteracao e segura porque a tabela base `therapy_slug_redirects` ja possui
  `SELECT` explicito para `anon`/`authenticated` e policy publica intencional
  `Public can read therapy slug redirects`.
- O teste garante que a view expoe apenas `old_slug`, `current_slug`,
  `therapy_id` e `created_at`, sem `id`, `created_by_profile_id` ou metadados
  internos.
- `public.public_therapist_slug_redirects_v` nao foi alterada nesta etapa,
  porque a tabela base `therapist_profile_slug_history` nao possui policy
  publica nem `SELECT` para `anon`; converter essa view diretamente exigiria
  abrir uma tabela de historico privada pela Data API.

RPC de catalogo de servicos do terapeuta endurecida:

- `public.list_therapist_service_catalog_v1(uuid)` voltou a ser
  `SERVICE_ROLE_ONLY`.
- Causa-raiz: a migration
  `20260807123000_therapist_services_use_admin_therapy_images.sql` reabriu a
  RPC `SECURITY DEFINER` para `authenticated` ao adicionar imagens do catalogo
  admin. A migration base deixava essa RPC apenas para `service_role`.
- Risco corrigido: chamada direta via Data API por usuario autenticado poderia
  fornecer `p_actor_user_id` arbitrario. Embora a resposta seja majoritariamente
  catalogo, ela tambem expunha `therapistProfileId`, `plan` e limite de servicos
  do ator informado, caracterizando superficie IDOR/P1 desnecessaria.
- Consumidor real: `supabase/functions/therapist-services-command/index.ts`,
  acionado pela rota Next `/api/therapist/services`, autentica o terapeuta via
  JWT e chama a RPC com `service_role`.
- Decisao: revogar `EXECUTE` de `public`, `anon` e `authenticated`; manter
  `service_role`; documentar no comentario da funcao que o ator vem do JWT na
  Edge Function, nao de payload do navegador.

Grant operacional de Match/servicos corrigido apos navegacao real:

- O E2E de `/terapeuta/servicos` revelou `500` no update de um servico com
  matching. Logs locais da Edge Function apontaram
  `permission denied for function ensure_service_matching_rules_v1`.
- Causa-raiz: a migration de hardening anterior tratou o validador
  `ensure_service_matching_rules_v1(uuid)` como helper puramente interno e
  removeu tambem `EXECUTE` de `service_role`. Porem o fluxo real
  `therapist-services-command -> update_therapist_service_with_matching_v1 ->
  replace_therapist_service_matching_v1 -> ensure_service_matching_rules_v1`
  precisa desse grant no boundary server-side.
- Correcao: `ensure_service_matching_rules_v1(uuid)` continua sem `EXECUTE`
  para `public`, `anon` e `authenticated`, mas voltou a ter `EXECUTE` para
  `service_role`.
- Complemento de UI: o formulario de servico agora fecha deterministicamente o
  dialog apos update/criacao bem-sucedidos e mostra erro explicito quando a
  resposta de mutacao nao traz `service`, evitando overlay preso ou sucesso
  aparente.

RPC legado de benchmark financeiro endurecido:

- `get_private_therapist_financial_benchmark_v1(date,date,text)` foi
  classificada como `LEGACY_UNUSED`.
- Causa-raiz: a UI de financeiro do terapeuta deixou de exibir benchmarking,
  mas o wrapper standalone permanecia como RPC `SECURITY DEFINER` executavel
  diretamente por usuarios autenticados via Data API.
- Risco corrigido: superficie desnecessaria para endpoint de benchmark
  financeiro agregado, fora do fluxo consolidado do dashboard avancado.
- Decisao: revogar `EXECUTE` de `public`, `anon`, `authenticated` e
  `service_role` para esse wrapper legado; o contrato consolidado
  `get_private_therapist_advanced_financial_dashboard_v1` permanece como
  superficie ativa do Premium Plus.
- Teste: o pgTAP F3 agora exige erro `42501` para chamada direta autenticada
  do RPC legado e preserva os demais contratos financeiros ativos.

RPCs de Meu Perfil do terapeuta endurecidas contra chamada direta:

- Helpers M1 como `therapist_profile_content_json_m1`,
  `therapist_profile_validate_payload_m1`,
  `therapist_profile_replace_children_m1` e ledger de idempotencia foram
  classificados como `TRIGGER_HELPER`/`INTERNAL_HELPER` sem `EXECUTE` externo.
- Comandos `save_therapist_profile_draft_v1`,
  `discard_therapist_profile_draft_v1`,
  `publish_therapist_profile_draft_v1` e
  `unpublish_therapist_profile_v1` foram classificados como
  `SERVICE_ROLE_ONLY`.
- Causa-raiz HML: consulta Supabase MCP mostrou os helpers e comandos
  `SECURITY DEFINER` de perfil com `anon_execute=true`,
  `authenticated_execute=true` e `service_role_execute=true`, apesar de o
  contrato local esperado ja ser mais fechado.
- Risco corrigido: usuario anonimo/autenticado poderia tentar acionar RPCs de
  perfil via Data API com `p_actor_user_id` em argumento. O fluxo correto e o
  navegador chamar `/api/therapist/profile`, que valida sessao/JWT e delega
  para `therapist-profile-command`.
- Decisao: helpers internos sem `EXECUTE` para `public`, `anon`,
  `authenticated` e `service_role`; read model privado e comandos com
  `EXECUTE` apenas para `service_role`.
- Teste: pgTAP `027_admin_hardening_therapist_profile_rpc_grants.sql` cobre os
  grants de read model, comandos e helpers.

Grants diretos das tabelas publicas do catalogo de terapias endurecidos:

- Tabelas afetadas: `therapies`, `therapy_categories`,
  `therapy_public_content`, `therapy_highlights`, `therapy_benefits` e
  `therapy_faqs`.
- Causa-raiz HML: consulta Supabase MCP mostrou que as tabelas editoriais
  `therapy_public_content`, `therapy_highlights`, `therapy_benefits` e
  `therapy_faqs` estavam com `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
  `REFERENCES`, `TRIGGER` e `SELECT` concedidos diretamente para `anon` e
  `authenticated`.
- Causa-raiz local: as tabelas de catalogo ja nao tinham DML para browser
  roles, mas ainda herdavam `TRUNCATE`, `REFERENCES` e `TRIGGER` de grants
  amplos.
- Risco corrigido: superficie de Data API desnecessaria para mutacao/DDL em
  catalogo publico e conteudo editorial. Publico deve consumir views/projecoes
  seguras; mutacao administrativa deve passar por
  `admin-therapy-catalog-command` e RPCs de dominio.
- Decisao: revogar `ALL` de `public`, `anon`, `authenticated` e `service_role`
  nessas tabelas; reabrir apenas `SELECT` para `anon`/`authenticated` em
  `therapies` e `therapy_categories`; reabrir apenas `SELECT` para
  `authenticated` em tabelas editoriais; manter `SELECT` para `service_role`
  sem privilegios diretos de mutacao/truncate/trigger/reference.
- Teste: pgTAP
  `028_admin_hardening_public_therapy_catalog_table_grants.sql` cobre 126
  asserts explicitos de `has_table_privilege`.

Fundacao de auditoria administrativa append-only criada:

- Criada a tabela `admin_audit_events` como trilha centralizada e sanitizada
  para mutacoes administrativas criticas. Tabelas de evento por dominio
  continuam validas, mas comandos admin devem registrar tambem o evento
  operacional aqui quando forem habilitados.
- Colunas do contrato: `actor_user_id`, `actor_role`, `permission`, `action`,
  `entity_type`, `entity_id`, `previous_state`, `next_state`, `reason`,
  `request_id`, `correlation_id`, `source` e `created_at`.
- Guardrails: `previous_state` e `next_state` precisam ser objetos JSON;
  campos textuais possuem checks de tamanho/minimo; comentarios documentam que
  tokens, cookies, Authorization, secrets, documentos brutos e dados sensiveis
  desnecessarios nao devem ser armazenados.
- Append-only: triggers bloqueiam `UPDATE` e `DELETE` com erro `23514`.
- Escrita: `record_admin_audit_event_v1(...)` e `INSERT` direto ficam apenas
  para `service_role`; `anon` e `authenticated` nao executam a funcao nem
  inserem linhas diretamente.
- Leitura: `authenticated` possui `SELECT` apenas como grant de Data API, mas
  a RLS libera linhas somente para administradores via `is_current_admin()`;
  `anon` nao le.
- Idempotencia: indice parcial por `(source, request_id, action, entity_type)`
  evita duplicacao por retry. A funcao retorna o evento existente em repeticao
  serial e tambem trata `unique_violation` para corrida concorrente do mesmo
  `request_id`.
- Status: `TESTED_LOCAL`. A migration ainda nao foi aplicada em HML porque a
  CLI nao esta vinculada ao projeto remoto e `supabase link` exige access token
  ausente nesta sessao.
- Teste: pgTAP `029_admin_audit_events_foundation.sql` cobre grants,
  execucao do writer, idempotencia, bloqueio de update/delete, RLS de admin vs
  terapeuta, rejeicao de payload invalido e ausencia de colunas obvias de
  segredo.

Fundacao RBAC backend-side criada:

- Criado o catalogo canonico `src/lib/auth/admin-permissions.ts` com
  capabilities explicitas para dashboard, profissionais, pacientes, sessoes,
  pagamentos, repasses, assinaturas, avaliacoes, suporte, terapias, Match,
  integracoes, seguranca, auditoria, relatorios e configuracoes.
- `requireAdminSession({ permission })` passou a validar capability no servidor
  antes de entregar dados de paginas admin. Usuario sem role admin continua
  indo para login; admin autenticado sem capability recebe `notFound()`, sem
  expor a pagina.
- As rotas admin habilitadas passaram a declarar a permissao exigida:
  `/admin`, profissionais, verificacoes, clientes, sessoes, suporte,
  avaliacoes, financeiro, assinaturas, relatorios, terapias, Match,
  integracoes, seguranca e configuracoes.
- `adminModuleRegistry` agora usa o tipo `AdminPermission`; permissao invalida
  falha em typecheck/teste. A rota read-only `/admin/configuracoes` foi
  corrigida de `admin.settings.manage` para `admin.settings.read`, reservando
  `manage` para escrita futura auditada.
- `/api/admin/therapies` passou a mapear `action -> permission` server-side e
  nega com `403` antes de chamar a Edge Function quando o perfil autenticado
  nao e admin/capaz. Leitura de terapias exige `admin.therapies.read`, mutacao
  de terapias exige `admin.therapies.manage`, leitura de Match exige
  `admin.matching.read` e mutacao de Match exige `admin.matching.manage`.
- `/api/admin/media` passou a reutilizar a sessao admin central e exige
  `admin.matching.manage` para upload de imagem publica usada pelo Match.
- A Edge Function `admin-therapy-catalog-command` passou a ter mapeamento
  interno de permissao por comando em `catalog-command.ts`, preservando
  `submitRequest` como fluxo de terapeuta e exigindo role admin para comandos
  administrativos.
- Status: `TESTED_LOCAL`. Ainda falta persistir perfis administrativos
  granulares no banco quando houver papeis alem de `admin`; hoje a role
  `admin` recebe todo o catalogo explicitamente.
- Testes: Vitest cobre catalogo de permissions, sessao admin, registry, API
  `/api/admin/therapies` e upload de midia admin; Deno cobre o mapeamento de
  permissoes da Edge Function.

Ponte transacional entre eventos de Terapias/Match e auditoria central criada:

- Criada a migration
  `20260809003536_mirror_therapy_catalog_events_to_admin_audit.sql`.
- A tabela de dominio `therapy_catalog_events` continua sendo a trilha local do
  Catalogo/Match, mas agora possui trigger `AFTER INSERT` que espelha eventos
  administrativos para `admin_audit_events` na mesma transacao.
- A ponte espelha apenas eventos com `actor_role = 'admin'` e
  `actor_profile_id` presente. Solicitações de terapeuta, como
  `submit_therapy_catalog_request_v1`, continuam fora da auditoria
  administrativa central.
- O espelhamento mapeia eventos `matching_*` e `therapy_matching_*` para
  `admin.matching.manage`; demais eventos de catalogo entram como
  `admin.therapies.manage`.
- Estados `previous_state`/`next_state` que chegam como array ou scalar sao
  embrulhados em objeto JSON antes de entrar em `admin_audit_events`,
  preservando o check de payload objeto da auditoria central.
- Helpers internos criados:
  `admin_audit_json_object_v1(jsonb)`,
  `admin_permission_for_therapy_catalog_event_v1(text)` e
  `mirror_therapy_catalog_event_to_admin_audit_v1()`. Todos ficaram sem
  `EXECUTE` direto para `public`, `anon`, `authenticated` e `service_role`.
- Status: `TESTED_LOCAL`. HML ainda depende da aplicacao das migrations no
  projeto remoto antes de considerar auditoria de Terapias/Match homologada.
- Teste: pgTAP `030_admin_audit_therapy_catalog_bridge.sql` cobre trigger,
  grants dos helpers, mapeamento de permissoes, evento real de Match, estado
  array normalizado, skip de evento de terapeuta e append-only do evento
  espelhado.

### Evidencias Supabase

`npx supabase db reset` aplicou a migration local e os testes SQL passaram.
Consulta direta de grants no banco MCP conectado confirmou:

- `anon` e `authenticated` sem `EXECUTE` para
  `auto_confirm_sessions`, `confirm_session_service`,
  `create_weekly_payout_batch`, `refresh_session_transfer_eligibility`,
  `calculate_session_cancellation_policy` e
  `prepare_profile_for_auth_user_delete_v1`.
- `service_role` com `EXECUTE` nas RPCs consumidas por Edge Functions/jobs.
- helpers de trigger como `confirm_session_from_review`,
  `sync_session_payment_projections` e
  `enforce_therapist_service_online_only_v1` sem `EXECUTE` direto inclusive
  para `service_role`.
- `public.public_matching_config` com reloption `{security_invoker=true}`.
- `public.public_matching_therapy_themes_v` com reloption `{}`, isto e, ainda
  pendente de conversao completa para `security_invoker`.
- `public.is_current_admin` confirmado com `prosecdef = false`, sem
  `EXECUTE` para `anon`, com `EXECUTE` para `authenticated` e `service_role`.
- Consulta Supabase MCP no projeto conectado confirmou o mesmo contrato para
  `is_current_admin`; os helpers de terapeuta/paciente seguem
  `SECURITY DEFINER`, sem `EXECUTE` para `anon`, e ainda exigem redesenho RLS
  antes de migrarem para invoker.
- `public.public_therapy_slug_redirects_v` confirmado com reloption
  `{security_invoker=true}`, `anon` com `SELECT` na view e na tabela base,
  sustentado por policy publica explicita.
- `public.list_therapist_service_catalog_v1(uuid)` confirmado localmente e via
  Supabase MCP antes do patch como `SECURITY DEFINER`, `search_path = ''`,
  `anon_execute=false`, `authenticated_execute=true`,
  `service_role_execute=true`.
- Apos a migration local, consulta direta confirmou:
  `anon_execute=false`, `authenticated_execute=false`,
  `service_role_execute=true`.
- `public.ensure_service_matching_rules_v1(uuid)` confirmado apos reset com
  `anon_execute=false`, `authenticated_execute=false`,
  `service_role_execute=true`.
- `public.get_private_therapist_financial_benchmark_v1(date,date,text)`
  confirmado em HML antes do patch como `anon_execute=false`,
  `authenticated_execute=true`, `service_role_execute=true`.
- Apos a migration local
  `20260808232742_harden_legacy_financial_benchmark_rpc_grant.sql`, consulta
  direta no Postgres local confirmou `anon_execute=false`,
  `authenticated_execute=false`, `service_role_execute=false` para o RPC legado
  standalone de benchmark financeiro.
- Supabase MCP HML confirmou drift dos RPCs de perfil antes do patch:
  `therapist_profile_content_json_m1`,
  `therapist_profile_derived_json_m1`,
  `therapist_profile_published_fields_m1`,
  `therapist_profile_replace_children_m1`,
  `therapist_profile_request_replay_m1`,
  `therapist_profile_store_request_m1`,
  `therapist_profile_validate_payload_m1`,
  `save_therapist_profile_draft_v1`,
  `discard_therapist_profile_draft_v1`,
  `publish_therapist_profile_draft_v1` e
  `unpublish_therapist_profile_v1` estavam com `anon_execute=true`,
  `authenticated_execute=true` e `service_role_execute=true`.
- Apos a migration local
  `20260808233758_harden_therapist_profile_rpc_grants.sql`, consulta direta no
  Postgres local confirmou read model/comandos de perfil com
  `service_role_execute=true` e `anon_execute=false`/
  `authenticated_execute=false`, enquanto helpers internos ficaram sem
  `EXECUTE` tambem para `service_role`.
- Supabase MCP HML confirmou antes do deploy que `therapy_public_content`,
  `therapy_highlights`, `therapy_benefits` e `therapy_faqs` tinham todos os
  privilegios diretos testados como `true` para `anon` e `authenticated`.
- Apos a migration local
  `20260808235102_harden_public_therapy_catalog_table_grants.sql`, consulta
  direta no Postgres local confirmou:
  - `anon` e `authenticated` mantem apenas `SELECT` em `therapies` e
    `therapy_categories`;
  - `anon` nao possui `SELECT` nem privilegios de mutacao/DDL nas tabelas
    editoriais;
  - `authenticated` possui apenas `SELECT` nas tabelas editoriais, ainda
    limitado por RLS/policies admin;
  - `service_role` possui apenas `SELECT` direto nessas seis tabelas.
- Apos a migration local
  `20260809000313_admin_audit_events_foundation.sql`, `supabase db reset`
  aplicou a tabela `admin_audit_events`, as policies, os triggers append-only,
  o writer `record_admin_audit_event_v1(...)` e o indice de idempotencia sem
  erros.
- O teste SQL `029_admin_audit_events_foundation.sql` confirmou 32 contratos:
  `service_role` executa o writer; `anon`/`authenticated` nao executam;
  `authenticated` nao insere/atualiza/deleta diretamente; usuario terapeuta
  autenticado nao le eventos; admin autenticado le; update/delete sao
  bloqueados; replay com mesmo `request_id` nao duplica evento.
- `npx supabase db lint` apos a fundacao de auditoria retornou
  `No schema errors found`.
- Apos a migration local
  `20260809003536_mirror_therapy_catalog_events_to_admin_audit.sql`,
  `supabase db reset` aplicou o trigger
  `z95_mirror_therapy_catalog_event_to_admin_audit` sem erros.
- O teste SQL `030_admin_audit_therapy_catalog_bridge.sql` confirmou 24
  contratos: helper/trigger existem; helpers nao sao executaveis diretamente
  por browser roles; evento real `admin_upsert_matching_theme_v1` cria evento
  de dominio e evento central; evento de terapeuta nao cria auditoria admin;
  estados array sao normalizados; eventos espelhados permanecem append-only.
- `npx supabase test db` passou com 31 arquivos e 801 testes depois da ponte
  transacional de auditoria Terapias/Match.
- `npx supabase db lint` passou novamente depois da ponte transacional, sem
  schema errors.
- Playwright local de `/terapeuta/servicos` passou apos a correcao, cobrindo
  edicao, ativacao, perfil publico, pausa e responsividade. O tail recente do
  Edge Runtime ainda continha os erros antigos anteriores a correcao, mas as
  chamadas posteriores de `therapist-services-command` nao registraram novo
  `[Error]`.
- Consulta Supabase MCP de views publicas mostrava nesta coleta
  `public_matching_config` e `public_therapy_slug_redirects_v` como
  `security_invoker`; depois disso, a etapa local H2 tambem migrou
  `public_therapist_slug_redirects_v` para `security_invoker` com grants de
  coluna e policies publicas minimas. As demais views publicas continuam
  pendentes por dependencia de tabelas privadas, agregacoes ou DTOs sensiveis.
- REST anon do Supabase configurado em `.env.local`, sem expor URL ou chave,
  respondeu `200` com 58 linhas para a query publica exata da view.
- REST anon para `public_matching_therapy_themes_v`, sem expor URL ou chave,
  respondeu `200` para a query publica usada pelo Match.
- Supabase Advisor de seguranca foi reexecutado e nao listou mais
  `public_matching_config` em `security_definer_view` nem `is_current_admin` em
  `authenticated_security_definer_function_executable`; os demais findings de
  views/RPCs continuam pendentes por dominio.

### Evidencias RBAC Admin

- `src/lib/auth/admin-permissions.test.ts` confirmou que o catalogo contem
  capabilities criticas como `admin.professionals.verify`,
  `admin.payments.refund`, `admin.audit.read` e `admin.settings.manage`.
- `src/lib/auth/admin-session.test.ts` confirmou que a sessao admin retorna
  `role: "admin"` e lista explicita de permissions, redireciona sem token e
  rejeita perfil autenticado que nao seja admin.
- `src/features/admin-shell/admin-shell-config.test.ts` passou a validar cada
  permissao com `isAdminPermission()` e garante que Configuracoes permanece
  read-only (`admin.settings.read`).
- `src/app/api/admin/therapies/route.test.ts` confirmou que
  `/api/admin/therapies` encaminha comando apenas depois da validacao
  server-side e que perfil `therapist` autenticado recebe `403` sem chamar
  `admin-therapy-catalog-command`.
- `src/app/api/admin/media/route.test.ts` continuou passando apos a rota
  centralizar a sessao admin e exigir `admin.matching.manage`.
- `supabase/functions/admin-therapy-catalog-command/catalog-command.test.ts`
  confirmou o mapeamento `action -> permission` e rejeicao de role nao admin
  quando o comando exige capability administrativa.

### Evidencias Playwright

- MCP Browser validou que `/admin` sem sessao redireciona para `/admin-login`.
- MCP Browser detectou falha de clique no campo `#email`; apos ajuste, a
  regressao automatizada com Chromium validou clique/foco real em desktop e
  mobile.
- `tests/e2e/admin-release.spec.ts` passou em Chromium com servidor local,
  navegando por todas as rotas admin habilitadas e verificando ausencia de
  secrets renderizados.
- `tests/e2e/public-matching-journey.spec.ts` passou em Chromium com servidor
  local, cobrindo `/sua-jornada`, calculo de Match, terapia, perfil publico e
  reserva sem regressao apos o hardening das views publicas de Match.

### Validacao Final desta Retomada

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:deno
npx supabase db reset
npx supabase test db
npx supabase db lint
npx vitest run src/features/public-home/public-home.fallbacks.test.ts src/features/public-matching/journey-page-prerender.test.ts src/features/public-matching/algorithm.test.ts src/features/public-therapists/therapy-presentation.test.ts src/features/public-therapist-search/public-therapist-search.fallbacks.test.ts src/features/admin-therapy-catalog/admin-therapy-catalog.parsers.test.ts src/features/admin-therapy-catalog/components/admin-therapy-editor.test.tsx src/features/therapist-services/therapist-services-page.test.tsx
npx playwright test tests/e2e/auth-click-regression.spec.ts --project=chromium -g admin
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/admin-release.spec.ts --project=chromium
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/public-matching-journey.spec.ts --project=chromium
npx playwright test tests/e2e/therapist-services.spec.ts --project=chromium
```

Resultados:

- `lint`: passou.
- `typecheck`: passou isolado. Uma execucao paralela com `next build` falhou
  por corrida em `.next/types`, depois passou ao repetir sozinha.
- `test`: passou novamente apos a correcao final com 92 arquivos e 349 testes.
- `build`: passou; manteve o log conhecido de `matching.config`. Chamada REST
  isolada anterior da query publica respondeu `200`. A causa-raiz foi fechada
  nesta retomada movendo a leitura da Jornada para request-time com
  `connection()`; novo `next build` passou sem `public_data_query_failed`.
- `test:deno`: passou com 115 testes.
- `supabase db reset`: passou e aplicou a migration local.
- `supabase test db`: passou com 27 arquivos e 594 testes apos a RPC de
  catalogo de servicos voltar a ser `SERVICE_ROLE_ONLY`.
- `supabase db lint`: passou sem schema errors.
- `supabase test db`: passou novamente com 27 arquivos e 594 testes apos o RPC
  legado standalone de benchmark financeiro perder `EXECUTE` direto para
  `authenticated` e `service_role`.
- `supabase test db`: passou novamente com 28 arquivos e 619 testes apos o
  hardening dos RPCs M1 de perfil do terapeuta.
- `supabase db reset`: passou novamente apos o hardening de grants das tabelas
  de catalogo/editorial.
- `supabase test db`: passou novamente com 29 arquivos e 745 testes apos o
  hardening de grants das tabelas de catalogo/editorial.
- `supabase db reset`: passou novamente apos a fundacao
  `admin_audit_events`, incluindo a protecao de corrida concorrente no writer
  idempotente.
- `supabase test db`: passou novamente com 30 arquivos e 777 testes apos a
  fundacao append-only de auditoria admin.
- `supabase db lint`: passou novamente apos a fundacao de auditoria admin, sem
  schema errors.
- `supabase db reset`: passou novamente apos a ponte transacional entre
  `therapy_catalog_events` e `admin_audit_events`.
- `supabase test db`: passou novamente com 31 arquivos e 801 testes apos a
  ponte transacional de auditoria de Terapias/Match.
- `supabase db lint`: passou novamente apos a ponte transacional, sem schema
  errors.
- `lint`, `typecheck` e `build` foram reexecutados apos a documentacao da
  fundacao de auditoria admin e passaram. O `next build` gerou 101 paginas sem
  erro critico.
- `npx vitest run src/lib/auth/admin-permissions.test.ts src/lib/auth/admin-session.test.ts src/features/admin-shell/admin-shell-config.test.ts src/app/api/admin/therapies/route.test.ts src/app/api/admin/media/route.test.ts`:
  passou com 5 arquivos e 15 testes apos a fundacao RBAC.
- `deno test --allow-env --allow-net supabase/functions/admin-therapy-catalog-command/catalog-command.test.ts`:
  passou com 9 testes apos o mapeamento de permissoes na Edge Function e foi
  repetido apos a ponte transacional de auditoria.
- `typecheck`, `lint` e `build` passaram novamente apos a fundacao RBAC.
  `next build` gerou 101 paginas sem erro critico.
- `typecheck` e `lint` passaram novamente apos a ponte transacional de
  auditoria de Terapias/Match.
- `git diff --check` passou sem apontar whitespace problemático.
- `vitest` focado em catalogo publico/Match/Admin Terapias/Suas Terapias:
  passou com 8 arquivos e 28 testes.
- Playwright public matching journey foi reexecutado apos o hardening de grants
  das tabelas de catalogo/editorial: passou com 2 testes Chromium, navegando
  `/sua-jornada`, resultado do Match, terapia, perfil publico e reserva.
  Primeira tentativa falhou por ausencia de dev server; segunda falhou por
  permissao sandbox do Chromium no macOS; apos subir `npm run dev` e executar
  fora do sandbox, passou.
- Durante esse Playwright, o dev server registrou apenas o warning conhecido de
  `metadataBase` para Open Graph local; nao houve erro 500 nas rotas publicas
  testadas.
- Consulta SQL local direta confirmou `anon`, `authenticated` e `service_role`
  sem `EXECUTE` para `get_private_therapist_financial_benchmark_v1(date,date,text)`.
- Consulta SQL local direta confirmou os grants de Meu Perfil: comandos e read
  model privado somente para `service_role`, helpers internos sem `EXECUTE`
  direto.
- Supabase MCP HML confirmou drift antes do deploy: HML ainda tem
  `authenticated=true` e `service_role=true` para esse RPC legado, portanto a
  migration precisa ser aplicada em HML antes de considerar o finding fechado no
  ambiente alvo.
- Supabase MCP HML confirmou drift adicional antes do deploy nos RPCs M1 de
  perfil do terapeuta: helpers e comandos ainda estavam executaveis por `anon`,
  `authenticated` e `service_role`.
- Supabase Security Advisor HML segue com findings de `security_definer_view`,
  `authenticated_security_definer_function_executable`,
  `rls_enabled_no_policy` e protecao de senha vazada desativada; Performance
  Advisor HML segue com FKs sem indice, indices nao usados e policies
  permissivas multiplas. Esses itens permanecem no backlog por dominio e nao
  foram corrigidos em massa.
- `therapist-services-page`: passou com 1 arquivo e 9 testes, incluindo
  regressao para fechamento do dialog de edicao apos update bem-sucedido.
- Playwright auth-click admin: passou em desktop e mobile.
- Playwright admin release: passou com 1 spec Chromium.
- Playwright public matching journey: passou com 2 testes Chromium.
- Playwright therapist services: passou com 2 testes Chromium apos corrigir
  grant `service_role` do validador de Match e fechamento do dialog.
- Playwright admin finance: passou com 1 teste Chromium para financeiro,
  assinaturas e relatorios read-only.
- Playwright therapist finance: a primeira execucao real revelou que o E2E
  ainda esperava o bloco removido `Benchmark anonimizado`; o teste foi alinhado
  ao contrato de produto e passou com 2 testes Chromium, garantindo as quatro
  abas aprovadas e ausencia de benchmark na UI.
- `npm run test -- therapist-profile`: passou com 8 arquivos e 38 testes.
- Deno focado em `therapist-profile-command` e auth compartilhado: passou com
  21 testes.
- Playwright therapist profile: a primeira execucao real revelou que o E2E
  ainda assumia o CTA antigo `Salvar alterações` para primeira configuracao; o
  teste foi alinhado ao fluxo aprovado (`Publicar alterações` na primeira
  configuracao e `Salvar alterações` nas edicoes posteriores) e passou com 2
  testes Chromium.
- `/admin/seguranca` passou a ler a trilha central `admin_audit_events` em vez
  da trilha de dominio `therapy_catalog_events`. A query server-side seleciona
  apenas campos minimos (`id`, `actor_role`, `permission`, `action`,
  `entity_type`, `reason`, `source`, `created_at`) e nao carrega
  `previous_state`/`next_state` para a UI de resumo.
- A tela de Seguranca agora diferencia auditoria central indisponivel de
  ausencia real de eventos. Falha HTTP/REST/RLS/grant retorna estado
  `unavailable` e a UI instrui a verificar grants, migration aplicada e sessao
  admin, evitando que drift de HML seja mostrado como "sem eventos".
- `requireAdminSession` passou a aceitar `permissions` compostas, preservando
  compatibilidade com `permission` singular. A rota `/admin/seguranca` agora
  exige simultaneamente `admin.security.read` e `admin.audit.read`, impedindo
  que uma superficie visual de seguranca conceda leitura de auditoria central
  sem a capability propria de auditoria.
- RPCs de Agenda e comandos de servicos do terapeuta tiveram os grants
  reassertados em migration aditiva para fechar drift HML reportado pelo
  Advisor:
  - `validate_booking_against_active_holds_v1()` e
    `validate_hold_against_active_bookings_v1()` foram classificadas como
    `TRIGGER_HELPER` e nao possuem execucao direta nem para `service_role`;
  - `transition_booking_status_v1(...)` foi classificada como
    `SERVICE_ROLE_ONLY`;
  - comandos de servicos do terapeuta com `p_actor_user_id`, incluindo
    `list_private_therapist_services_v1`, `create_therapist_service_v1`,
    `update_therapist_service_v1`, `transition_therapist_service_v1`,
    `reorder_therapist_services_v1`,
    `create_therapist_service_with_matching_v1`,
    `update_therapist_service_with_matching_v1` e
    `replace_therapist_service_matching_v1`, ficaram sem `EXECUTE` para
    `anon`/`authenticated` e com `EXECUTE` apenas para `service_role`.
- `upsert_therapist_review_reply_v1(uuid,text,uuid)` foi fechado contra
  chamada direta por browser roles. Causa-raiz: a rota
  `/api/therapist/reviews` chamava uma RPC `SECURITY DEFINER` diretamente com
  JWT autenticado; a funcao validava `auth.uid()`, mas ainda aparecia como
  `authenticated_security_definer_function_executable` no Advisor e mantinha a
  mutacao publicada na Data API.
- Nova Edge Function `therapist-reviews-command` valida o JWT do terapeuta via
  `requireTherapist`, usa service role apenas no runtime Supabase e chama o novo
  wrapper `upsert_therapist_review_reply_for_actor_v1(...)`.
- O wrapper `upsert_therapist_review_reply_for_actor_v1(...)` e
  `SERVICE_ROLE_ONLY`; ele recebe o `actor_user_id` ja validado pela Edge
  Function e preserva o contrato legado da pagina, incluindo idempotencia e
  retorno atualizado da tela de avaliacoes. A RPC legada
  `upsert_therapist_review_reply_v1(uuid,text,uuid)` ficou sem `EXECUTE` para
  `anon`, `authenticated` e `service_role`, sendo usada apenas internamente pelo
  wrapper.
- `src/features/therapist-reviews/therapist-reviews.queries.ts` agora envia
  mutacoes para `/functions/v1/therapist-reviews-command` e nao para
  `/rest/v1/rpc/upsert_therapist_review_reply_v1`.
- Validacao local adicional desta fatia H2:
  - `npx vitest run src/features/admin-platform/admin-platform.queries.test.ts src/features/admin-platform/admin-platform.mappers.test.ts src/features/admin-shell/admin-shell-config.test.ts`:
    passou com 3 arquivos e 12 testes.
  - `npx vitest run src/lib/auth/admin-session.test.ts src/lib/auth/admin-permissions.test.ts src/features/admin-shell/admin-shell-config.test.ts src/features/admin-platform/admin-platform.queries.test.ts`:
    passou com 4 arquivos e 14 testes apos o RBAC composto.
  - `npx vitest run src/features/admin-platform/components/admin-security-page.test.tsx src/features/admin-platform/admin-platform.queries.test.ts src/lib/auth/admin-session.test.ts`:
    passou com 3 arquivos e 9 testes, cobrindo o aviso visual de auditoria
    central indisponivel e diferenciando esse estado de lista vazia real.
  - `npx supabase db reset`: passou, aplicando tambem
    `20260809005451_harden_agenda_service_command_rpc_grants.sql` em base
    reconstruida.
  - `npx supabase test db supabase/tests/031_admin_hardening_agenda_service_command_rpc_grants.sql`:
    passou com 1 arquivo e 35 testes apos o reset.
  - `npx supabase test db supabase/tests/026_admin_hardening_therapist_service_catalog_rpc.sql supabase/tests/003_agenda_a2_transactional_foundation.sql`:
    passou com 2 arquivos e 51 testes. Uma tentativa paralela simultanea com o
    novo teste `031` falhou apenas no setup da extensao pgTAP
    (`LegacyTestDbEnablePgtapError`); reexecutado isoladamente, o `031` passou.
  - `deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/functions/therapist-reviews-command`:
    passou com 4 testes.
  - `npm run test:deno`: passou com 121 testes, incluindo
    `therapist-reviews-command`.
  - `npx vitest run src/features/therapist-reviews/therapist-reviews.queries.test.ts src/features/therapist-reviews/therapist-reviews.mappers.test.ts src/features/therapist-reviews/therapist-reviews.parsers.test.ts`:
    passou com 3 arquivos e 7 testes, provando que a mutacao de resposta usa
    Edge Function e nao a RPC REST direta.
  - `npx supabase test db supabase/tests/012_therapist_reviews_page.sql supabase/tests/032_admin_hardening_therapist_review_reply_rpc_boundary.sql`:
    passou com 2 arquivos e 23 testes apos atualizar o contrato legado de
    avaliacoes para o novo boundary.
  - `npx supabase test db supabase/tests/032_admin_hardening_therapist_review_reply_rpc_boundary.sql supabase/tests/031_admin_hardening_agenda_service_command_rpc_grants.sql`:
    passou com 2 arquivos e 46 testes.
  - `npx supabase db lint`: passou sem schema errors.
  - `npm run typecheck`: passou.
  - `npm run lint`: passou.
  - `npm run build`: passou e gerou 101 paginas.
  - `git diff --check`: passou sem problemas de whitespace.
  - `npx supabase test db supabase/tests/033_admin_hardening_public_therapist_slug_redirects.sql`:
    primeira execucao falhou por `permission denied for table
    therapist_profiles`, confirmando que a policy da tabela de historico de
    slug precisava de um gate publico explicito em `therapist_profiles`. Apos
    grant de colunas minimo e policy para perfis aprovados/publicos, passou
    com 1 arquivo e 19 testes.
  - `npx supabase test db supabase/tests/025_admin_hardening_public_therapy_slug_redirects.sql supabase/tests/033_admin_hardening_public_therapist_slug_redirects.sql`:
    passou com 2 arquivos e 29 testes, cobrindo redirects publicos de terapias
    e terapeutas.
  - `npx supabase test db supabase/tests/023_admin_hardening_public_matching_therapy_themes.sql`:
    passou com 1 arquivo e 19 testes apos converter
    `public_matching_therapy_themes_v` para `security_invoker`.
  - `npx supabase test db supabase/tests/022_admin_hardening_public_matching_config_view.sql supabase/tests/023_admin_hardening_public_matching_therapy_themes.sql supabase/tests/020_match_admin_operational_foundation.sql`:
    passou com 3 arquivos e 54 testes, cobrindo configuracao publica do Match,
    temas publicos de terapia e base operacional do Match.
  - MCP Supabase local confirmou
    `public.public_matching_therapy_themes_v` com reloption
    `{security_invoker=true}`.
  - `npx supabase test db supabase/tests/034_admin_hardening_public_therapy_catalog_invoker_views.sql`:
    passou com 1 arquivo e 21 testes, cobrindo `public_therapies_v`,
    `public_home_therapies`, `public_matching_therapist_counts`, grants de
    coluna e bloqueio de leitura direta de titulo/preco de servico por `anon`.
  - `npx supabase test db supabase/tests/034_admin_hardening_public_therapy_catalog_invoker_views.sql supabase/tests/028_admin_hardening_public_therapy_catalog_table_grants.sql supabase/tests/022_admin_hardening_public_matching_config_view.sql supabase/tests/023_admin_hardening_public_matching_therapy_themes.sql`:
    passou com 4 arquivos e 177 testes, cobrindo catalogo publico, grants de
    tabelas editoriais e Match publico.
  - MCP Supabase local confirmou `public.public_therapies_v`,
    `public.public_home_therapies` e
    `public.public_matching_therapist_counts` com reloption
    `{security_invoker=true}`.
  - A migration local
    `20260809015135_harden_public_therapy_details_invoker.sql` converteu
    `public.public_therapy_details_v` para `security_invoker`, recriou o DTO
    com filtro `therapies.archived_at is null`, abriu apenas colunas editoriais
    publicas necessarias para `anon` e adicionou policies RLS publicas para
    conteudo editorial ligado a terapias publicadas, visiveis e nao
    arquivadas.
  - `npx supabase test db supabase/tests/035_admin_hardening_public_therapy_details_invoker.sql`:
    passou com 1 arquivo e 28 testes, cobrindo a view de detalhe publica, o
    bloqueio de terapias draft/ocultas/arquivadas, grants de coluna para
    `anon`, bloqueio de colunas internas (`created_at`, `updated_at`, `id`) e
    policies RLS editoriais.
  - `npx supabase test db supabase/tests/035_admin_hardening_public_therapy_details_invoker.sql supabase/tests/034_admin_hardening_public_therapy_catalog_invoker_views.sql supabase/tests/028_admin_hardening_public_therapy_catalog_table_grants.sql supabase/tests/023_admin_hardening_public_matching_therapy_themes.sql`:
    passou com 4 arquivos e 194 testes, cobrindo a cadeia publica de detalhe,
    catalogo, grants editoriais e Match publico.
  - Consulta direta no Postgres local confirmou
    `public.public_therapy_details_v` com reloption `{security_invoker=true}`.
    A mesma verificacao confirmou para `anon`: `subtitle` em
    `therapy_public_content` com `SELECT=true`, `created_at` com
    `SELECT=false` e `SELECT` de tabela inteira com `false`.
  - `npx supabase db lint`, `npm run typecheck`, `npm run lint`,
    `npm run build` e `git diff --check` passaram apos este incremento.
  - A migration local
    `20260809020024_harden_public_matching_therapies_invoker.sql` converteu
    `public.public_matching_therapies_v` para `security_invoker`, preservando o
    DTO existente (`id`, `name`, `slug`, descricoes, `image_url`, `status`,
    `therapist_count`, `is_visible_in_matching`) e reforcando filtros de
    terapia publicada, publica, nao arquivada e visivel no Match.
  - A mesma migration revogou privilegios amplos da propria view para
    `public`, `anon`, `authenticated` e `service_role`, reabrindo apenas
    `SELECT` para os tres roles de runtime esperados.
  - A primeira tentativa de `npx supabase db reset` neste incremento falhou com
    deadlock em migration antiga ao recriar `public_home_therapies`. A
    reexecucao imediata passou e aplicou tambem
    `20260809020024_harden_public_matching_therapies_invoker.sql`; o deadlock
    foi tratado como interferencia transitoria de conexao/container, nao como
    erro de schema da migration nova.
  - `npx supabase test db supabase/tests/036_admin_hardening_public_matching_therapies_invoker.sql`:
    passou com 1 arquivo e 18 testes, cobrindo reloption invoker, grants da
    view, ocultacao de terapias desabilitadas/draft/ocultas/arquivadas e
    bloqueio de coluna interna `matching_therapy_settings.created_at` para
    `anon`.
  - `npx supabase test db supabase/tests/036_admin_hardening_public_matching_therapies_invoker.sql supabase/tests/035_admin_hardening_public_therapy_details_invoker.sql supabase/tests/034_admin_hardening_public_therapy_catalog_invoker_views.sql supabase/tests/023_admin_hardening_public_matching_therapy_themes.sql supabase/tests/022_admin_hardening_public_matching_config_view.sql`:
    passou com 5 arquivos e 97 testes, cobrindo a cadeia publica de Match,
    detalhe e catalogo de terapias.
  - Consulta direta no Postgres local confirmou
    `public.public_matching_therapies_v` com reloption
    `{security_invoker=true}`; para `anon`, `SELECT=true`,
    `TRUNCATE=false` e `REFERENCES=false` na view. A mesma verificacao
    confirmou em `matching_therapy_settings`: `therapy_id SELECT=true`,
    `created_at SELECT=false` e `SELECT` de tabela inteira `false`.
  - Depois deste incremento, a lista local de views publicas ainda sem
    `security_invoker` ficou reduzida a `public_home_testimonials`,
    `public_home_therapists`, `public_therapist_profile_content_v`,
    `public_therapist_profile_reviews_v`,
    `public_therapist_profile_services_v`, `public_therapist_profiles_v` e
    `public_therapist_search`.
  - `npx supabase db lint`, `npm run typecheck`, `npm run lint`,
    `npm run test`, `npm run build` e `git diff --check` passaram apos este
    incremento.
  - A migration local
    `20260809020716_harden_public_home_testimonials_invoker.sql` converteu
    `public.public_home_testimonials` para `security_invoker`, preservando o
    DTO publico da home (`author_name`, `body`, `context_label`, `rating`,
    `published_at`, `created_at`) e restringindo a fonte a reviews publicados,
    com comentario nao nulo e tamanho minimo de 24 caracteres.
  - A mesma migration removeu grants legados de `public`/`anon` em
    `reviews`, removeu DML/DDL direto de `authenticated` nessa tabela, abriu
    para `anon` apenas colunas publicas (`id`, `comment`, `rating`, `status`,
    `published_at`, `created_at`) e criou a policy
    `Public can read published testimonial reviews`.
  - `npx supabase test db supabase/tests/037_admin_hardening_public_home_testimonials_invoker.sql`:
    passou com 1 arquivo e 21 testes, cobrindo reloption invoker, grants da
    view, ocultacao de reviews curtos/pendentes/sem comentario, leitura direta
    anon limitada por coluna/RLS e bloqueio de `moderation_reason`/`booking_id`.
  - `npx supabase test db supabase/tests/037_admin_hardening_public_home_testimonials_invoker.sql supabase/tests/012_therapist_reviews_page.sql supabase/tests/032_admin_hardening_therapist_review_reply_rpc_boundary.sql`:
    passou com 3 arquivos e 44 testes, preservando os contratos privados de
    reviews do terapeuta e o boundary de resposta de avaliacao.
  - Consulta direta no Postgres local confirmou
    `public.public_home_testimonials` com reloption `{security_invoker=true}`;
    para `anon`, `SELECT=true`, `TRUNCATE=false` e `REFERENCES=false` na view.
    A mesma verificacao confirmou em `reviews`: `comment SELECT=true`,
    `moderation_reason SELECT=false`, `booking_id SELECT=false`,
    `SELECT` de tabela inteira `false` e `TRUNCATE=false`.
  - Depois deste incremento, a lista local de views publicas ainda sem
    `security_invoker` ficou reduzida a `public_home_therapists`,
    `public_therapist_profile_content_v`,
    `public_therapist_profile_reviews_v`,
    `public_therapist_profile_services_v`, `public_therapist_profiles_v` e
    `public_therapist_search`.
  - `npx supabase db lint`, `npm run typecheck`, `npm run lint`,
    `npm run test`, `npm run build` e `git diff --check` passaram apos este
    incremento.

### Evidencias HML Reais - 2026-08-08

Projeto HML consultado via conector Supabase: `emzwqkmrryuqvqiohqnu`.

Security Advisor remoto:

- Ainda acusa `security_definer_view` para views publicas, incluindo
  `public_matching_config`, `public_matching_therapy_themes_v`,
  `public_home_testimonials`, `public_home_therapists`,
  `public_therapist_profiles_v`, `public_therapist_profile_content_v`,
  `public_therapist_slug_redirects_v`, `public_therapist_profile_reviews_v` e
  `public_matching_therapist_counts`.
- Ainda acusa RPCs `SECURITY DEFINER` executaveis por `authenticated`, incluindo
  helpers/comandos de Meu Perfil (`therapist_profile_*_m1`), comandos de
  servicos do terapeuta (`transition_therapist_service_v1`,
  `update_therapist_service_v1`,
  `update_therapist_service_with_matching_v1`) e funcoes de booking/review como
  `transition_booking_status_v1`, `upsert_therapist_review_reply_v1`,
  `validate_booking_against_active_holds_v1` e
  `validate_hold_against_active_bookings_v1`.
- Ainda acusa `rls_enabled_no_policy` em tabelas intencionalmente fechadas ou
  pendentes de classificacao, incluindo `financial_ledger_entries`,
  `payout_batches`, `session_refunds`, `session_disputes`,
  `stripe_customers`, `therapist_connect_account_snapshots`,
  `therapist_profile_events`, `therapist_subscription_events` e
  `therapist_verifications`.
- Ainda acusa protecao de senha vazada desativada em Supabase Auth.

Performance Advisor remoto:

- Lista muitos `unindexed_foreign_keys`, incluindo dominios de agenda,
  bookings, billing, e-mail, suporte, pagamentos e metricas.
- Lista `unused_index` em indices de reviews, metricas, pagamentos, refunds,
  disputes, legal acceptances e suporte.
- Lista `multiple_permissive_policies` em tabelas operacionais compartilhadas
  entre paciente/terapeuta/admin, incluindo `bookings`, `booking_holds`,
  `booking_intake_responses`, `conversations`, `messages`,
  `patient_profiles`, `reviews`, `session_payments`,
  `therapist_profiles`, `therapist_services`, `therapies`,
  `therapy_catalog_requests`, `therapy_categories` e
  `therapy_slug_redirects`.

Tabelas HML:

- A listagem de tabelas `public` retornou 100+ tabelas de produto, mas nao
  retornou `admin_audit_events`. Portanto a fundacao de auditoria admin criada
  localmente ainda nao esta aplicada em HML.
- HML possui dados reais/sinteticos recentes relevantes para validacao:
  `profiles` 18 linhas, `therapist_profiles` 14, `therapist_services` 3,
  `stripe_webhook_events` 288, `zoom_video_webhook_events` 50,
  `email_delivery_logs` 17 e `therapist_connect_account_snapshots` 28.

Edge Functions HML:

- O conector listou funcoes ativas com `verify_jwt=false` em fluxos publicos,
  autenticados, jobs e webhooks. Exemplos: `stripe-billing-webhook`,
  `stripe-connect-webhook`, `zoom-webhook`, `therapist-auth-signup`,
  `client-auth-signup`, `stripe-create-subscription-checkout`,
  `stripe-change-therapist-subscription`, `stripe-cancel-therapist-subscription`,
  `stripe-create-session-payment`, `session-booking-checkout`,
  `session-reschedule`, `request-session-cancellation`,
  `therapist-schedule-update`, `therapist-blocks-update`,
  `zoom-video-session-access`, `auto-confirm-sessions`,
  `create-weekly-payout-batch`, `process-payout-batch`,
  `retry-failed-payout-items`, `reconcile-stripe-transfers` e
  `zoom-video-session-maintenance`.
- `admin-therapy-catalog-command` esta ativo com `verify_jwt=true`, alinhado ao
  boundary administrativo.
- `therapist-profile-command` e `therapist-services-command` aparecem ativos
  com `verify_jwt=false`; os logs mostram chamadas 200 recentes, mas essas
  funcoes precisam permanecer cobertas por validacao interna de JWT, role,
  requestId e grants service-role-only nos RPCs.

Logs HML:

- Logs de Postgres responderam. O padrao recente mostra checkpoints e o cron
  `select public.purge_temporary_data_v1(now());` executando com sucesso.
- Logs de Edge Functions responderam. Houve chamadas recentes 200 para
  `therapist-profile-command`, `therapist-services-command`,
  `stripe-connect-*`, `stripe-connect-webhook` e `zoom-webhook`.
- Logs de API/Auth responderam. O recorte recente mostra requests 200 para
  `/auth/v1/user`, RPCs privados do shell terapeuta e login por e-mail. O
  relatorio nao copia tokens, cookies, Authorization, payloads sensiveis ou
  segredos.

Conclusao HML desta coleta:

- HML esta acessivel pelo conector, mas nao esta alinhado ao estado local de
  hardening. As migrations locais de auditoria/grants/views precisam ser
  aplicadas no projeto `emzwqkmrryuqvqiohqnu` antes de declarar
  `HOMOLOGATED`.
- Como `admin_audit_events` ainda nao existe em HML, `/admin/seguranca` deve
  mostrar o estado `Auditoria central indisponivel` no ambiente alvo ate o
  deploy das migrations. Isso e esperado e nao deve ser tratado como lista
  vazia.

### Pendencias por Fase

#### Fase 1 - Auditoria, Seguranca P0 e Contratos Base

- Resolver ou justificar views publicas `SECURITY DEFINER` restantes; impacto
  P1 porque podem executar com permissoes do owner em superficies publicas.
  Proxima acao: auditar DTO por view, testar ausencia de campos privados e
  migrar para `security_invoker` somente quando as policies subjacentes
  suportarem. `public_matching_config`, `public_matching_therapy_themes_v`,
  `public_therapies_v`, `public_home_therapies`,
  `public_matching_therapist_counts`, `public_therapy_slug_redirects_v` e
  `public_therapist_slug_redirects_v` ja foram migradas localmente para
  `security_invoker`. No caso de Match e catalogo publico, as migrations abrem
  apenas colunas publicamente necessarias e mantem pesos, motivos, metadados,
  titulos e precos diretos de servicos fechados; no caso de terapeutas, a
  migration tambem cria grants de coluna e policies publicas minimas para
  permitir redirects apenas de perfis aprovados e publicos, sem expor
  `therapist_profile_id`, `id` ou timestamps no DTO publico.
- Classificar todas as RPCs `SECURITY DEFINER` ainda executaveis por
  `authenticated`; impacto P1/P2 conforme contrato. Proxima acao: separar
  `PUBLIC_READ`, `AUTHENTICATED_USER`, `ADMIN`, `SERVICE_ROLE_ONLY`,
  `WEBHOOK_INTERNAL` e criar testes `has_function_privilege`.
  `list_therapist_service_catalog_v1(uuid)` ja foi classificada e corrigida
  como `SERVICE_ROLE_ONLY`; `transition_booking_status_v1(...)`, comandos de
  servicos do terapeuta com Match e
  `upsert_therapist_review_reply_v1(uuid,text,uuid)` tambem foram fechados
  localmente. Falta aplicar as migrations e a Edge Function
  `therapist-reviews-command` em HML e reconsultar o Advisor remoto para
  remover os findings no ambiente alvo.
- Redesenhar helpers RLS de terapeuta/paciente antes de tentar
  `SECURITY INVOKER`; impacto P1 porque a tentativa direta causa recursao de
  RLS (`stack depth limit exceeded`) e nao pode ser aplicada com seguranca.
- Validar logs reais HML de `edge-function`, `api`, `postgres`, `auth` e
  `storage`; impacto P1 para homologacao. Evidencia atual: MCP retornou
  `fetch failed`.
- Confirmar drift Git x HML com endpoint remoto identificado; impacto P1 para
  release. Evidencia atual: MCP conectado e local/container, nao HML provado.
- Monitorar `matching.config public_data_query_failed` em HML depois do deploy;
  impacto P2 residual. Localmente a causa-raiz do build foi corrigida e o erro
  nao apareceu no novo `next build` nem na navegacao Playwright da Jornada.

#### Fase 2 - Shell e Visao Geral Operacional

- Migrar dashboard/integracoes/seguranca para BFF/read models admin dedicados
  onde REST autenticado retornar `Indisponivel`; impacto P2 operacional.
  `/admin/seguranca` ja usa a trilha central `admin_audit_events` e nao mostra
  falha de leitura como lista vazia, mas HML ainda precisa receber as
  migrations de auditoria antes de validar essa leitura no ambiente alvo.
- Adicionar correlationId ponta a ponta em rotas admin server-side; impacto P2
  de observabilidade.
- Reproduzir e diagnosticar logs transitorios de Next dev
  `__webpack_modules__[moduleId] is not a function`; impacto P2.
- Validar responsividade completa em 320, 375, 768, 1024, 1280 e 1440px;
  impacto P2 de UX/admin.

#### Fase 3 - Pessoas, Operacao e Moderacao

- Evoluir as paginas de detalhe iniciais para abas completas por dominio. As
  rotas basicas ja existem para `/admin/profissionais/:id`,
  `/admin/profissionais/verificacoes/:id`, `/admin/pacientes/:id`,
  `/admin/sessoes/:id`, `/admin/suporte/:id` e `/admin/avaliacoes/:id`.
- Comandos seguros iniciais existem para aprovar/rejeitar/solicitar ajuste de
  verificacao, suspender/reativar profissional, resolver/reabrir suporte e
  ocultar/restaurar avaliacao.
- Cancelar/reagendar sessao permanece pendente ate existir boundary proprio de
  dominio que sincronize reserva, pagamento, notificacao e Zoom.
- Evoluir comandos iniciais com `expectedVersion` por dominio quando os read
  models de detalhe passarem a expor versao operacional explicita.
- Testar IDOR/cross-shell para admin, terapeuta, paciente e visitante.

#### Fase 4 - Financeiro, Assinaturas e Relatorios

- Manter financeiro read-only ate existir boundary de comando proprio para
  refund, payout e reconciliacao; impacto P1 por risco financeiro.
- Detalhes `/admin/pagamentos/:id` e `/admin/assinaturas/:id` foram criados
  localmente com RPCs admin e minimizacao de Stripe IDs/payloads. Pendente:
  aplicar migrations em HML e validar navegacao autenticada no ambiente alvo.
- Implementar reconciliacao admin sem edicao direta de ledger/status/amount.
- Homologar Stripe test mode em HML: Billing, Connect, session payment,
  webhook duplicado, assinatura invalida, replay e evento fora de ordem.
- Implementar exports server-side com capability, filtros, limite, rate limit,
  auditoria e protecao contra CSV injection.

#### Fase 5 - Catalogo, Match, Configuracoes, Integracoes e Release

- Manter `/admin/configuracoes` read-only ate existir dominio explicito para
  escrita de feature flags/produto/operacao; impacto P1 se virar key/value
  generico.
- Homologar Zoom Video SDK real em HML com dois contexts Playwright e verificar
  `video_sessions`, `video_session_participations`,
  `zoom_video_webhook_events` e jobs de controle.
- Homologar Email real, incluindo confirmacao, reset e logs
  `email_delivery_logs`.
- Validar cross-shell completo apos cada mutacao admin critica.
- Executar Playwright com cliques reais, console/pageerror/requestfailed e
  Network para todas as rotas habilitadas.
- Reexecutar Advisor final remoto e anexar comparacao before/after antes de
  declarar qualquer estado `HOMOLOGATED`.

Impacto documental: Documentacao atualizada.

## Execucao Complementar Admin Financeiro - 2026-08-09

Status: implementada localmente como aprofundamento da Fase 4, substituindo a
leitura direta das paginas de Pagamentos e Assinaturas por read models RPC
administrativos e adicionando detalhes read-only sanitizados.

### Entregas

- Criada a migration
  `supabase/migrations/20260809054500_admin_finance_read_models.sql`.
- Criadas as RPCs `admin_get_finance_module_v1(text, integer, integer)` e
  `admin_get_finance_detail_v1(text, uuid)`.
- Criadas as rotas dinamicas `/admin/pagamentos/:id` e
  `/admin/assinaturas/:id`.
- As listagens de Pagamentos e Assinaturas passaram a consumir RPCs
  `security definer` com validacao interna de `auth.uid()` como admin, em vez
  de consultar diretamente tabelas financeiras pelo browser.
- Os detalhes mostram estados locais, valores, participantes, ciclo, faturas e
  eventos recentes sem enviar IDs externos Stripe, URLs/PDFs de invoice,
  payloads, metadados brutos ou segredos para o DTO da UI.
- As acoes financeiras continuam fora da UI. Refund, payout, ajuste,
  reconciliacao manual ou mudanca de assinatura exigem boundary proprio com
  RBAC, motivo, idempotencia, Stripe/ledger e auditoria.

### Validacao

Comandos executados:

```bash
npm run typecheck
npx vitest run src/features/admin-finance/admin-finance.mappers.test.ts
npx supabase db reset
npx supabase test db supabase/tests/041_admin_finance_read_models.sql
npx supabase test db
npm run lint
npm run test
npm run build
```

Resultados:

- Typecheck passou.
- Teste focado de mappers passou: 1 arquivo, 5 testes.
- `supabase db reset` passou aplicando a migration nova.
- pgTAP focado passou: 26 testes cobrindo RPCs, grants, bloqueio de
  nao-admin, DTOs sanitizados e modulo invalido fechado.
- pgTAP completo passou: 42 arquivos, 1075 testes.
- Lint passou sem warnings.
- Suite Vitest completa passou: 100 arquivos, 376 testes.
- Build Next passou e incluiu `/admin/pagamentos/[paymentId]` e
  `/admin/assinaturas/[subscriptionId]`.
- Playwright focado passou: 1 spec Chromium, cobrindo login admin, navegacao em
  Pagamentos, Assinaturas e Relatorios por URL direta, clique em detalhe quando
  ha registro no seed e ausencia de `Relatorios` no menu por estar oculto.

### Pendencias Residuais

- Aplicar a migration em HML e validar com sessao admin real.
- Executar Playwright de navegacao em HML nas rotas de detalhe apos deploy.
- Homologar Stripe test mode real para Billing, Connect, pagamentos de sessao,
  webhook duplicado, replay e eventos fora de ordem.
- Criar comandos financeiros apenas quando houver contrato de dominio completo
  para RBAC, auditoria append-only, idempotencia e reconciliacao Stripe/ledger.
- Relatorios/exportacoes seguem ocultos/pendentes de backend server-side
  auditado, limites e protecao contra CSV injection.

Impacto documental: Documentacao atualizada.

## Execucao da Fase 5 - 2026-08-08

Status: implementada localmente como fechamento da superficie admin planejada,
com Configuracoes habilitada, catalogo/Match preservados por comando existente
e checklist de release navegavel.

Referencia visual validada em Figma:

- Arquivo `Projeto Terapeuta Eu Sou Atualizado`;
- node `13425:778`;
- a navegacao admin de referencia inclui `Configuracoes`, mantendo a mesma
  linguagem visual operacional do shell.

Referencia Supabase consultada:

- Changelog de breaking changes em 2026 indica que novas tabelas publicas podem
  nao ser expostas automaticamente a Data API. Decisao aplicada: nao criar
  tabela/migration para configuracoes nesta fase; a pagina usa contratos
  existentes, docs e estado de runtime sem alterar grants.

### Entregas

- Criada a feature `src/features/admin-settings/*`.
- Criada a rota `/admin/configuracoes`.
- `adminModuleRegistry` passou a habilitar `Configuracoes`; com isso todos os
  modulos planejados no registry ficam acessiveis pelo menu.
- O dashboard admin passou a tratar `Configuracoes` como modulo pronto, com link
  para `/admin/configuracoes`.
- Criada a skill local `skills/admin-settings-release/SKILL.md`.
- Atualizados `docs/product/integration-map.md`,
  `docs/product/routes-map.md` e `docs/product/page-inventory.md` para refletir
  que Configuracoes admin e governanca read-only, nao formulario de secrets.
- Criado E2E `tests/e2e/admin-release.spec.ts`, que percorre todas as rotas
  admin habilitadas.

### Comportamento Implementado

- `/admin/configuracoes` exige sessao admin server-side via
  `requireAdminSession`.
- A pagina mostra quatro grupos:
  - Produto;
  - Operacao;
  - Feature Flags;
  - Integracoes.
- A pagina mostra checklist de release com navegacao, sessao admin,
  Supabase publico, comando de Catalogo/Match e protecao financeira.
- A pagina exibe apenas estado e nomes documentados de configuracao, nunca
  valores de secrets.
- Catalogo e Match continuam usando `admin-therapy-catalog-command`; a rota
  `/api/admin/therapies` revalida `therapies`, `matching-config`,
  `therapist-profile` e `therapist-search` apos mutacoes.

### Guardrails Mantidos

- Configuracoes criticas nao sao editadas pelo browser.
- Secrets Stripe, Zoom, Email e Supabase permanecem fora da UI.
- Mutacoes financeiras continuam bloqueadas sem comando auditado.
- Dados demonstrativos nao contam como sucesso de homologacao/producao.
- Supabase/RLS/grants indisponiveis devem aparecer como configuracao ausente ou
  revisao manual, nao como zero saudavel.

### Validacao

```bash
npm run test -- admin-settings.queries admin-shell-config admin-dashboard.queries
npm run typecheck
npm run lint
npm run build
npm run test
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/admin-dashboard.spec.ts tests/e2e/admin-operations.spec.ts tests/e2e/admin-finance.spec.ts tests/e2e/admin-release.spec.ts --project=chromium
```

Resultado:

- Testes focados passaram: 3 arquivos, 7 testes.
- `typecheck` passou.
- `lint` passou apos ajuste de copy para respeitar a politica online-only.
- `build` passou e incluiu `/admin/configuracoes` no mapa de rotas gerado.
- Suite unitaria completa passou: 91 arquivos, 347 testes.
- E2E Playwright em Chromium passou: 4 specs, cobrindo login admin, dashboard,
  operacao, financeiro e navegacao por todas as rotas admin habilitadas.

Observacao de runtime local:

- O dev server registrou um erro transitorio
  `__webpack_modules__[moduleId] is not a function` durante compilacao inicial
  de `/admin`, mas as rotas recompilaram e responderam 200 nos testes. Manter
  como risco residual de ambiente/dev server ate nova reproducao isolada.

### Riscos Residuais

- A pagina de Configuracoes e deliberadamente read-only; edicao governada de
  feature flags ou product config exigira modelo de dominio, auditoria e
  migration propria.
- Homologacao real externa de Stripe, Zoom, Email e HML Supabase segue
  dependente de credenciais/ambiente remoto.
- Paginas de detalhe e mutacoes criticas dos modulos administrativos ainda
  precisam de contratos dedicados quando forem liberadas.

Impacto documental: Documentacao atualizada.

## Execucao da Fase 4 - 2026-08-08

Status: implementada localmente como camada admin read-only para financeiro,
assinaturas, relatorios e diagnostico transacional.

Referencia visual validada em Figma:

- Arquivo `Projeto Terapeuta Eu Sou Atualizado`;
- node `13425:778`;
- navegacao admin expõe `Financeiro` e `Assinaturas` no shell. A rota tecnica
  de financeiro permanece `/admin/pagamentos` por compatibilidade com
  `src/lib/routes`.

Referencia Supabase consultada:

- Changelog `Tables not exposed to Data API automatically` de 2026-08-04.
  Decisao aplicada: leituras bloqueadas por grants/RLS continuam aparecendo como
  `Indisponivel`, sem tratar falha como lista vazia e sem migration ad hoc.

### Entregas

- Criada a feature `src/features/admin-finance/*`.
- Criada a rota `/admin/pagamentos`, exibida no menu como `Financeiro`.
- Criada a rota `/admin/assinaturas`.
- Criada a rota `/admin/relatorios`.
- Criado helper server-side compartilhado
  `src/app/(admin)/admin/finance-route.tsx`.
- `adminModuleRegistry` passou a habilitar `Financeiro`, `Assinaturas` e
  `Relatorios`.
- O dashboard admin passou a apontar o modulo `Financeiro` para
  `/admin/pagamentos`.
- `Relatorios` saiu da lista de modulos pendentes; `Configuracoes` permanece
  oculto para a Fase 5.
- Criada a skill local `skills/admin-finance-subscriptions/SKILL.md`.

### Comportamento Implementado

As paginas da Fase 4 seguem o contrato:

- exigem sessao admin server-side via `requireAdminSession`;
- usam Supabase REST com token autenticado do admin, sem `service_role` no
  navegador;
- carregam contagens agregadas com `Prefer: count=exact`;
- carregam listagens minimas com `no-store`;
- tratam erro, RLS ou grant ausente como `Indisponivel`;
- mantem a UI read-only para dinheiro, assinatura e relatorios.

Fontes canonicas usadas:

- `session_payments`, `session_refunds`, `session_disputes`,
  `financial_ledger_entries`, `payout_batches` e `stripe_transfers` para
  financeiro;
- `therapist_subscriptions`, `billing_plan_prices`, `billing_invoices` e
  `stripe_customers` para assinaturas;
- `therapist_profiles`, `patient_profiles`, `bookings`, `session_payments` e
  `therapist_subscriptions` para mapa de relatorios;
- `stripe_webhook_events`, `zoom_video_webhook_events`, `video_sessions`,
  `email_delivery_logs` e `therapist_connect_accounts` continuam alimentando
  diagnostico de integracoes.

Minimizacao de dados:

- listagem de financeiro nao envia PaymentIntent, Checkout Session, Charge,
  Balance Transaction, IDs externos completos, `metadata` ou payload Stripe;
- listagem de assinaturas nao envia subscription ID, checkout session, latest
  invoice, invoice URL, invoice PDF ou `metadata`;
- relatorios nao exportam CSV no cliente e permanecem pendentes de comando
  server-side auditado;
- falha de leitura nao e apresentada como zero.

### Validacao

Comandos executados:

```bash
npm run test -- admin-shell-config admin-finance.mappers admin-dashboard.queries admin-platform.mappers
npm run typecheck
npm run lint
npm run build
npm run test
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/admin-dashboard.spec.ts tests/e2e/admin-operations.spec.ts tests/e2e/admin-finance.spec.ts --project=chromium
```

Resultados:

- Testes focados: 4 arquivos, 14 testes passaram.
- Revalidacao focada apos ajustes E2E: 2 arquivos, 6 testes passaram.
- Typecheck: passou.
- Lint: passou.
- Build: passou, incluindo as rotas dinamicas `/admin/pagamentos`,
  `/admin/assinaturas` e `/admin/relatorios`.
- Test suite completa: 90 arquivos, 345 testes passaram. A primeira repeticao
  teve erro assincrono transitorio `window is not defined` originado em
  `src/features/therapist-auth/components/auth-shell.test.tsx`; a segunda
  repeticao passou sem erros.
- Playwright Fase 4: 3 specs Chromium passaram, cobrindo login admin,
  dashboard, modulos operacionais da Fase 3 e navegacao real em
  `/admin/pagamentos`, `/admin/assinaturas` e `/admin/relatorios`.

Observacao do build:

- Durante `next build`, apareceu novamente o log estruturado preexistente de
  `matching.config` com `public_data_query_failed`, mas a build concluiu com
  sucesso. O evento segue como risco de hardening de Match/public data, nao
  como regressao da Fase 4.

Observacao do dev server:

- Durante Playwright em `next dev`, houve novamente um log transitorio
  `__webpack_modules__[moduleId] is not a function` durante compilacao sob
  demanda. As respostas finais das paginas foram `200` e os testes passaram.

### Riscos Residuais

- Acoes financeiras continuam bloqueadas ate existirem comandos com RBAC,
  motivo, idempotencia, transacao e auditoria append-only.
- Paginas de detalhe `/admin/pagamentos/:id` e `/admin/assinaturas/:id`
  permanecem pendentes.
- Exports reais de relatorios permanecem pendentes de backend server-side,
  limites, auditoria e protecao contra CSV injection.
- Grants/RLS remotos precisam ser conferidos em HML para evitar leituras
  indisponiveis em tabelas novas.

Impacto documental: Documentacao atualizada.

## Execucao da Fase 2 - 2026-08-08

Status: executada localmente com implementacao incremental da fundacao de
plataforma admin.

### Entregas

- Criada a feature `src/features/admin-platform/*` para health operacional e
  seguranca inicial.
- Criada a rota `/admin/integracoes`.
- Criada a rota `/admin/seguranca`.
- `adminModuleRegistry` passou a habilitar cinco modulos:
  - `/admin`;
  - `/admin/terapias`;
  - `/admin/matching`;
  - `/admin/integracoes`;
  - `/admin/seguranca`.
- Dashboard admin passou a apontar alertas e modulo de integracoes para
  `/admin/integracoes`.
- Dashboard admin passou a apontar o modulo de seguranca para
  `/admin/seguranca`.
- Criada a skill local `skills/admin-platform-health/SKILL.md`.
- Atualizada a skill `skills/admin-dashboard/SKILL.md`.

### Comportamento Implementado

`/admin/integracoes`:

- Mostra health de Stripe, Stripe Connect, Zoom e E-mail.
- Usa contagens reais via REST Supabase autenticado com token admin.
- Leituras bloqueadas por RLS/grants aparecem como `Indisponivel`.
- Falha de infraestrutura ou permissao nao vira zero.
- Nao exibe secrets, webhook secrets, Authorization, cookies ou payloads.

`/admin/seguranca`:

- Mostra superficie admin a partir do `adminModuleRegistry`.
- Mostra quantidade de modulos habilitados e ocultos.
- Explicita findings da Fase 1 como revisao manual:
  - views publicas `SECURITY DEFINER`;
  - funcoes `SECURITY DEFINER` executaveis por `authenticated`;
  - tabelas com RLS sem policy.
- Mostra auditoria recente do catalogo quando acessivel.

### Evidencia Playwright

Validação local em `http://localhost:3001`:

- Sem cookie admin, `/admin/integracoes` redirecionou para `/admin-login`.
- Sem cookie admin, `/admin/seguranca` redirecionou para `/admin-login`.
- Login local com seed documentado (`admin.tes@example.test`) funcionou.
- `/admin/integracoes` abriu autenticada e mostrou:
  - `Stripe`;
  - `Stripe Connect`;
  - `Zoom`;
  - `E-mail`;
  - `Sinais operacionais`;
  - sinais `Indisponivel` quando RLS/grants bloquearam leitura.
- `/admin/seguranca` abriu autenticada e mostrou:
  - `Superficie admin`;
  - `Modulos habilitados: 5`;
  - `Modulos ocultos: 10`;
  - revisoes obrigatorias de `SECURITY DEFINER`;
  - `Auditoria recente`.

### Validacao

Comandos executados:

```bash
npm run test -- admin-shell-config admin-platform.mappers admin-dashboard.queries
npm run typecheck
npm run lint
npm run build
npm run test
```

Resultados:

- Testes focados: 3 arquivos, 11 testes passaram.
- Typecheck: passou.
- Lint: passou.
- Build: passou.
- Test suite completa: 88 arquivos, 338 testes passaram.

Observacao do build:

- Durante `next build`, apareceu log estruturado preexistente de
  `matching.config` com `public_data_query_failed`, mas a build concluiu com
  sucesso. Esse log nao foi causado pelas rotas admin novas, mas deve continuar
  monitorado no hardening de Match/public data.

### Riscos Residuals

- As paginas usam REST Supabase autenticado com token admin e respeitam RLS;
  para evoluir para acoes criticas, a proxima etapa deve criar read models/BFF
  admin dedicados.
- `/admin/seguranca` ainda nao possui trilha append-only propria de auditoria
  administrativa; por enquanto mostra auditoria de catalogo quando acessivel e
  findings como revisao manual.
- Supabase Advisor foi validado localmente na Fase 1; HML/remoto segue
  pendente.
- Figma admin node `13425:778` nao foi inspecionado nesta execucao porque o
  conector Figma nao estava disponivel na sessao.

Impacto documental: Documentacao atualizada.

## Execucao da Fase 3 - 2026-08-08

Status: executada localmente como fundacao read-only dos modulos de pessoas,
operacao e moderacao.

Referencia visual validada em Figma:

- Arquivo `Projeto Terapeuta Eu Sou Atualizado`;
- node `13425:778` (`Page / Admin Pagamentos e repasses — editável`);
- tela de referencia admin mostra `Clientes` na navegacao e KPIs. A rota
  tecnica permanece `/admin/pacientes` por compatibilidade com `src/lib/routes`.

### Entregas

- Criada a feature `src/features/admin-operations/*` para listagens
  administrativas compartilhadas.
- Criada a rota `/admin/profissionais`.
- Criada a rota `/admin/profissionais/verificacoes`.
- Criada a rota `/admin/pacientes`, exibida no admin como `Clientes` conforme
  referencia visual do Figma.
- Criada a rota `/admin/sessoes`.
- Criada a rota `/admin/suporte`.
- Criada a rota `/admin/avaliacoes`.
- Criado helper server-side compartilhado para rotas operacionais admin em
  `src/app/(admin)/admin/operation-route.tsx`.
- `adminModuleRegistry` passou a habilitar os modulos de profissionais,
  verificacoes, clientes, sessoes, suporte e avaliacoes.
- O link de ajuda do shell admin passou a apontar para `/admin/suporte`.
- O dashboard admin passou a apontar a area operacional para `/admin/sessoes`.
- Criada a skill local `skills/admin-people-operations/SKILL.md`.

### Comportamento Implementado

As paginas da Fase 3 seguem o mesmo contrato:

- exigem sessao admin server-side via `requireAdminSession`;
- consomem Supabase REST com token autenticado do admin, sem `service_role` no
  navegador;
- carregam metricas e registros recentes com `no-store`;
- tratam leitura bloqueada por RLS/grants como `Indisponivel`, nunca como zero;
- exibem guardrails de privacidade e dominio em cada modulo;
- nao implementam mutacoes criticas nesta fase.

Fontes canonicas usadas:

- `therapist_profiles` para profissionais;
- `therapist_verifications` para verificacoes;
- `patient_profiles` para clientes/pacientes;
- `bookings` para sessoes;
- `support_tickets` para suporte;
- `reviews` para avaliacoes.

Minimizacao de dados:

- listagem de clientes nao envia telefone, nascimento, consentimentos ou
  `metadata`;
- listagem de sessoes nao envia URL secreta de reuniao;
- listagem de suporte nao envia descricao completa nem contexto diagnostico;
- listagem de avaliacoes nao envia comentario completo;
- listagem de verificacoes nao envia metadados/documentos privados;
- listagem de profissionais nao permite alterar plano, publicacao ou status por
  update livre.

### Validacao

Comandos executados:

```bash
npm run test -- admin-shell-config admin-operations.mappers admin-platform.mappers admin-dashboard.queries
npm run typecheck
npm run lint
npm run build
npm run test
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/admin-dashboard.spec.ts tests/e2e/admin-operations.spec.ts --project=chromium
```

Resultados:

- Testes focados: 4 arquivos, 15 testes passaram.
- Typecheck: passou.
- Lint: passou.
- Build: passou.
- Test suite completa: 89 arquivos, 342 testes passaram.
- Playwright Fase 3: 2 specs Chromium passaram, cobrindo dashboard admin, login
  admin, `/admin/profissionais`, `/admin/profissionais/verificacoes`,
  `/admin/pacientes` (`Clientes`), `/admin/sessoes`, `/admin/suporte`,
  `/admin/avaliacoes`, menu admin e ausencia dos campos tecnicos sensiveis
  `meeting_url`, `documents_metadata` e `diagnostic_context` no HTML
  renderizado.

Observacao do build:

- Durante `next build`, apareceu novamente o log estruturado preexistente de
  `matching.config` com `public_data_query_failed`, mas a build concluiu com
  sucesso. O evento continua como risco de hardening de Match/public data, nao
  como regressao da Fase 3.

Observacao do dev server:

- Durante Playwright em `next dev`, houve um log transitorio
  `__webpack_modules__[moduleId] is not a function` enquanto rotas eram
  compiladas sob demanda. As respostas das paginas foram `200` e os testes
  passaram; nao foi reproduzido no `next build`.

### Riscos Residuais

- Esta fase deixa os modulos funcionais para observacao/listagem, mas ainda nao
  entrega paginas de detalhe nem mutacoes criticas.
- Aprovar verificacao, suspender profissional, resolver suporte, ocultar
  avaliacao, cancelar/reagendar sessao e outras acoes precisam de comandos de
  dominio, permissao, motivo, versao esperada e auditoria append-only antes de
  serem habilitadas.
- Ainda nao ha read models admin dedicados por RPC/view privada para todos os
  modulos; as listagens respeitam RLS/grants atuais e podem mostrar
  `Indisponivel` quando o banco bloquear leitura.
- Supabase Advisor em HML/remoto segue pendente.
- Figma admin node `13425:778` foi inspecionado nesta retomada. Ainda faltam
  nodes especificos de detalhe/listagem, caso existam, para evoluir a proxima
  camada visual.

Impacto documental: Documentacao atualizada.
