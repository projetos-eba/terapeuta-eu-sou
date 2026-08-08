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
| `/admin` | Visao geral | Evoluir para dashboard operacional real |
| `/admin/profissionais` | Profissionais | Implementar |
| `/admin/profissionais/verificacoes` | Verificacoes | Implementar |
| `/admin/pacientes` | Clientes | Implementar |
| `/admin/sessoes` | Sessoes | Implementar |
| `/admin/pagamentos` | Pagamentos | Implementar |
| `/admin/avaliacoes` | Avaliacoes | Implementar |
| `/admin/assinaturas` | Assinaturas | Implementar |
| `/admin/terapias` | Terapias | Revisar, endurecer e homologar |
| `/admin/matching` | Match | Revisar, endurecer e homologar |
| `/admin/integracoes` | Integracoes | Implementar |
| `/admin/seguranca` | Seguranca | Implementar |
| `/admin/relatorios` | Relatorios | Implementar |
| `/admin/configuracoes` | Configuracoes | Implementar |
| `/admin/suporte` | Suporte | Implementar |

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
- Correcao aplicada: `src/features/admin-shell/admin-shell-config.ts` agora possui `adminModuleRegistry` com `status`, `permission`, `group` e `key`; somente modulos `enabled` entram na navegacao.
- Correcao aplicada: `helpHref` do shell admin foi movido para `/admin` enquanto `/admin/suporte` estiver `hidden`.
- Teste atualizado: `src/features/admin-shell/admin-shell-config.test.ts` valida que modulos ocultos nao aparecem no menu nem no help link e que todo modulo possui contrato de permissao.

### Matriz Inicial de Modulos

| Modulo | Rota | Status Fase 1 | Permissao inicial |
| --- | --- | --- | --- |
| Visao geral | `/admin` | enabled | `admin.dashboard.read` |
| Terapias | `/admin/terapias` | enabled | `admin.therapies.read` |
| Match | `/admin/matching` | enabled | `admin.matching.read` |
| Profissionais | `/admin/profissionais` | hidden | `admin.professionals.read` |
| Verificacoes | `/admin/profissionais/verificacoes` | hidden | `admin.professionals.verify` |
| Pacientes | `/admin/pacientes` | hidden | `admin.patients.read` |
| Sessoes | `/admin/sessoes` | hidden | `admin.sessions.read` |
| Suporte | `/admin/suporte` | hidden | `admin.support.read` |
| Avaliacoes | `/admin/avaliacoes` | hidden | `admin.reviews.read` |
| Pagamentos | `/admin/pagamentos` | hidden | `admin.payments.read` |
| Assinaturas | `/admin/assinaturas` | hidden | `admin.subscriptions.read` |
| Integracoes | `/admin/integracoes` | hidden | `admin.integrations.read` |
| Seguranca | `/admin/seguranca` | hidden | `admin.security.read` |
| Relatorios | `/admin/relatorios` | hidden | `admin.reports.read` |
| Configuracoes | `/admin/configuracoes` | hidden | `admin.settings.manage` |

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
