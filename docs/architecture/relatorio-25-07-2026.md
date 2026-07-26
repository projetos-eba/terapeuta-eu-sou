# Relatório de Arquitetura do Shell, Agenda e Sessões

Data da revisão: 2026-07-26

Status: A1, F0, fundação Zoom Z0 e A2 implementados; A3 é o próximo marco

Escopo: shell autenticado, Agenda, Sessões, financeiro e sala online

Projeto: Terapeuta Eu Sou

## 1. Resumo executivo

O shell do terapeuta é uma boa base para a evolução do produto. A
implementação atual já oferece:

- um shell autenticado reutilizável;
- navegação derivada do plano e de capabilities;
- autenticação centralizada por sessão;
- dashboard Premium Plus integrado ao Supabase;
- scaffolds sem 404 para as áreas ainda não implementadas;
- fundações de disponibilidade, bookings, sessões, reagendamentos e RLS;
- contratos e projeções já usados pelo paciente;
- Gate Financeiro F0 concluído;
- fundação Zoom pós-pagamento com outbox, Meeting SDK e webhooks.
- fundação transacional A2 com snapshots, holds, exclusão de conflitos,
  transições auditadas e reagendamento versionado.

Agenda e Sessões devem evoluir sobre essas estruturas. Não devem formar um
segundo domínio transacional nem duplicar dados para paciente e terapeuta.

As principais decisões desta revisão são:

1. adotar rotas canônicas unificadas em `/terapeuta/*`;
2. manter `/basico`, `/pro` e `/plus` somente como aliases de transição;
3. autorizar recursos por sessão, capability e RLS, nunca pelo pathname;
4. manter um booking para uma sessão no MVP;
5. ratificar `session_payments` como fonte financeira canônica já implementada;
6. manter `zoom_meetings` como fonte operacional da sala e
   `bookings.meeting_url` apenas como legado;
7. reutilizar e adaptar tabelas existentes antes de criar novas;
8. tratar o motor TypeScript de slots como preview; holds, bookings e conflitos
   já são protegidos no Postgres, enquanto a composição completa de slots
   permanece para A5;
9. estabilizar contratos e decisões antes de novas migrations;
10. implementar Agenda por incrementos funcionais, sem começar pela reprodução
    visual integral do calendário;
11. preservar os invariantes concluídos no Gate Financeiro F0;
12. tratar a fundação Zoom como implementada, mas bloquear go-live até concluir
    ZAK, topologia de hosts, cron, webhook remoto e testes RLS específicos.

## 2. Fontes analisadas

### 2.1 Fontes locais

- `AGENTS.md`;
- `docs/architecture/project.md`;
- `docs/architecture/supabase-mvp-domain.md`;
- `docs/product/sitemap.md`;
- `docs/product/routes-map.md`;
- `docs/product/integration-map.md`;
- `docs/product/page-inventory.md`;
- `docs/design-system/design-system.md`;
- `README.md`;
- `package.json`;
- `src/lib/routes.ts`;
- `src/lib/permissions.ts`;
- `src/domain/tes/*`;
- `src/features/therapist-shell/*`;
- `src/features/therapist-dashboard/*`;
- `src/features/availability/*`;
- `src/features/bookings/*`;
- `src/features/booking-detail/*`;
- `src/features/patient-encounters/*`;
- `src/lib/auth/therapist-session.ts`;
- `docs/payments/architecture.md`;
- `docs/payments/stripe-secrets-setup.md`;
- `docs/payments/internal-operations-token.md`;
- `skills/payments-billing/SKILL.md`;
- `src/domain/payments/*`;
- `supabase/functions/_shared/payments/*`;
- Edge Functions Stripe Billing, Connect, sessões e repasses;
- migration `20260725100000_payments_billing_connect_foundation.sql`;
- migrations, testes SQL e seed do Supabase;
- `docs/zoom/*.md`;
- `docs/architecture/adr/ADR-004-meeting-security.md`;
- `skills/zoom-integration/*`;
- `src/features/zoom/*`;
- `src/app/api/zoom/meeting-access/route.ts`;
- `supabase/functions/_shared/zoom/*`;
- Edge Functions `zoom-meeting-access`, `zoom-jobs-process` e `zoom-webhook`;
- migrations `20260725170000_zoom_integration_foundation.sql` e
  `20260725183000_zoom_integration_hardening.sql`;
- scripts em `scripts/zoom/*` e template
  `supabase/schedules/zoom-jobs-cron.sql`.

### 2.2 Figma

Arquivo: `Projeto Terapeuta Eu Sou Atualizado`  
File key: `OSXJi8tknHHCj82MTY2NbG`

Nodes relevantes:

- `12272:2`: Jornadas dos Usuários;
- `5999:10563`: Design Telas;
- `13366:7600`: dashboard Premium Plus;
- `13366:8393`: `Page / Minha agenda / Bloqueios`.

O node `13366:8393` confirma:

- as abas Calendário, Horários e Bloqueios;
- bloqueios de dia inteiro e de horário parcial;
- recorrência;
- filtros e busca;
- resumo dos bloqueios;
- pacientes e sessões impactados;
- regras de notificação e reagendamento;
- sidebar Premium Plus;
- topbar de referência com o nome Carlos.

Nome, avatar, plano e contadores exibidos no produto devem sempre vir da sessão
e dos dados reais. O nome Carlos no Figma é conteúdo de referência, não contrato
de produção.

### 2.3 Zoom oficial

Consultado em 2026-07-26:

- [Server-to-Server OAuth](https://developers.zoom.us/docs/internal-apps/create/):
  app ativado, credenciais server-side e scopes mínimos;
- [OAuth `account_credentials`](https://developers.zoom.us/docs/integrations/oauth/):
  token de uma hora, sem refresh token;
- [validação e assinatura de webhooks](https://developers.zoom.us/changelog/platform/webhook-url-validation/):
  challenge periódico, secret token e `x-zm-signature`;
- [autorização do Meeting SDK](https://developers.zoom.us/docs/meeting-sdk/auth/):
  JWT gerado no backend e ZAK associado ao host;
- [Meeting SDK Web](https://developers.zoom.us/docs/meeting-sdk/web/client-view/meetings-webinars/):
  `role = 1` e ZAK para iniciar; `role = 0` para participante.

Essas fontes confirmam a direção técnica implementada, mas não substituem a
homologação do app TES no Zoom Marketplace.

## 3. Parecer arquitetural

### 3.1 O que está bem direcionado

- Separar Agenda de Sessões.
- Compartilhar booking, pagamento, serviço e horário entre os dois papéis.
- Tratar disponibilidade recorrente, bloqueios e bookings como conceitos
  diferentes.
- Impedir que o frontend seja responsável por concorrência.
- Manter ciclos de vida separados para booking, pagamento, realização e
  repasse.
- Exigir auditoria para alterações operacionais.
- Tratar bloqueios com sessões existentes como fluxo de impacto.
- Usar DTOs específicos por papel sobre uma mesma fonte transacional.
- Projetar mobile como lista cronológica quando uma grade semanal não couber.
- Alimentar insights apenas com dados reais e agregados.

### 3.2 O que precisava ser corrigido

- O plano não deve continuar como parte da rota canônica.
- Stripe concluiu o Gate F0, mas ainda exige homologação externa ponta a ponta
  antes de produção.
- Zoom possui fundação e hardening local implementados; produção ainda depende
  de configuração do Marketplace, ZAK, licença/capacidade de hosts, cron remoto
  e webhook remoto.
- O relatório anterior propunha tabelas equivalentes às existentes.
- `ServiceStatus` já representa publicação do serviço e não pode representar a
  execução da sessão.
- Reagendamento, disputa e pagamento não devem virar estados de booking.
- `pendingSessionConfirmations` não existe no domínio atual.
- `session_occurrences` não possui justificativa suficiente no MVP.
- `session_payments` já possui backfill e projeções transacionais para
  `payments`, `bookings.payment_status` e `booking_payment_receipts`.
- Accounts v2 já trata eventos snapshot e thin.
- Pagamentos assíncronos, eventos fora de ordem, refunds, reversões e transfers
  vinculadas à Charge já foram endurecidos no F0.
- `bookings.meeting_url` continua legado; a implementação Zoom não grava
  `start_url`, ZAK ou passcode nele.
- O acesso Zoom ainda aceita terapeuta bloqueado por
  `allowBlockedStatus: true`; isso deve ser corrigido antes do go-live.
- A autorização de entrada consulta `bookings.payment_status`, que é projeção.
  O gate de acesso deve confirmar também `session_payments.financial_status`.
- A rota Next prioriza o cookie do terapeuta quando cookies de paciente e
  terapeuta coexistem; a sessão pretendida precisa ser desambiguada.
- O host padrão único não é uma topologia de produção suficiente para agenda
  concorrente de vários terapeutas.
- Participações ainda usam `participant_role = unknown` e não possuem pgTAP
  específico; não podem sustentar presença financeira ou clínica.
- As fases locais do módulo não devem usar a mesma nomenclatura das fases
  globais de `project.md`.

## 4. Decisão de rotas

### 4.1 Decisão

As rotas canônicas da área autenticada devem representar o domínio, e não o
plano comercial do terapeuta.

Proposta:

| Área                  | Rota canônica                     |
| --------------------- | --------------------------------- |
| Início                | `/terapeuta`                      |
| Agenda                | `/terapeuta/agenda`               |
| Pacientes             | `/terapeuta/pacientes`            |
| Histórico da pessoa   | `/terapeuta/pacientes/:patientId` |
| Sessões               | `/terapeuta/sessoes`              |
| Detalhe da sessão     | `/terapeuta/sessoes/:bookingId`   |
| Mensagens             | `/terapeuta/mensagens`            |
| Serviços              | `/terapeuta/servicos`             |
| Meus serviços         | `/terapeuta/servicos/meus`        |
| Financeiro            | `/terapeuta/financeiro`           |
| Avaliações            | `/terapeuta/avaliacoes`           |
| Métricas e relatórios | `/terapeuta/insights`             |
| Aura                  | `/terapeuta/assessor-ia`          |
| Perfil                | `/terapeuta/perfil`               |
| Configurações         | `/terapeuta/configuracoes`        |
| Suporte               | `/terapeuta/suporte`              |

As rotas públicas de autenticação continuam:

- `/terapeuta/login`;
- `/terapeuta/cadastro`;
- `/terapeuta/checkout`.

O perfil público canônico continua em `/terapeutas/:slug`. O alias singular
`/terapeuta/:slug` deve ser analisado na migração para evitar colisão conceitual
com a nova área autenticada.

### 4.2 Fundamentação

Básico, Premium e Premium Plus não são três produtos independentes. São níveis
de acesso sobre:

- o mesmo terapeuta;
- o mesmo shell;
- os mesmos bookings;
- os mesmos pacientes;
- os mesmos serviços;
- os mesmos pagamentos;
- os mesmos relacionamentos.

Com plano na URL:

- links mudam após upgrade ou downgrade;
- favoritos e histórico do navegador ficam instáveis;
- redirects se multiplicam;
- componentes podem inferir autorização pelo pathname;
- testes precisam repetir o mesmo fluxo em três árvores;
- novas features exigem três entradas de rota;
- a URL revela um atributo comercial que não identifica o recurso.

Com rota unificada:

- o link de Agenda permanece estável;
- a navegação é montada pela capability;
- páginas compartilhadas não são duplicadas;
- upgrade e downgrade alteram acesso, não endereço;
- a autorização fica próxima ao dado;
- o shell continua exibindo plano e bloqueios contextuais.

### 4.3 Regra de autorização

O pathname não concede acesso.

Cada página protegida deve:

1. validar a sessão autenticada;
2. validar o papel `therapist`;
3. validar o status do terapeuta;
4. consultar plano e capabilities no backend;
5. limitar o DTO entregue à página;
6. depender de RLS ou RPC para acessar dados;
7. renderizar estado bloqueado ou redirecionar de forma segura.

O cookie de plano continua sendo apenas hint.

### 4.4 Migração compatível

Os namespaces existentes não devem desaparecer abruptamente.

Estratégia:

1. criar as rotas canônicas compartilhadas;
2. migrar a navegação interna para `/terapeuta/*`;
3. manter `/basico/*`, `/pro/*` e `/plus/*` como wrappers de redirect;
4. usar redirects temporários durante o período de validação;
5. atualizar links internos, documentação e testes;
6. validar upgrade, downgrade e bookmarks;
7. tornar os redirects permanentes somente após a estabilização;
8. remover wrappers apenas em uma mudança futura explicitamente aprovada.

Essa compatibilidade não significa manter três implementações.

## 5. Vocabulário canônico

| Termo           | Definição                                                     |
| --------------- | ------------------------------------------------------------- |
| Disponibilidade | Regra recorrente que permite derivar horários reserváveis.    |
| Exceção         | Período adicionalmente disponível ou indisponível.            |
| Bloqueio        | Exceção indisponível com intenção operacional explícita.      |
| Slot            | Intervalo final que pode ser reservado naquele instante.      |
| Hold            | Reserva temporária e exclusiva de um slot.                    |
| Booking         | Compromisso transacional entre paciente, terapeuta e serviço. |
| Sessão          | Realização do serviço associada ao booking.                   |
| Encontro        | Nome amigável usado nas interfaces do paciente.               |
| Atendimento     | Termo descritivo, sem representar uma entidade técnica.       |
| Reagendamento   | Processo que propõe e aplica alteração de horário.            |
| Cancelamento    | Processo que encerra o booking conforme política.             |
| Repasse         | Movimentação financeira do valor elegível ao terapeuta.       |

### 5.1 Booking e sessão no MVP

No MVP:

- um booking representa um único compromisso;
- esse compromisso corresponde a uma única sessão;
- dados de realização podem ser anexados ao booking;
- resumos permanecem em `booking_session_summaries`;
- presença pode evoluir para uma tabela específica;
- não será criada `session_occurrences` sem necessidade comprovada.

Uma entidade separada passa a fazer sentido quando houver:

- pacotes com várias sessões;
- recorrência materializada;
- substituição de terapeuta;
- múltiplas tentativas de execução;
- sessão iniciada independentemente do booking original.

## 6. Estado atual do projeto

### 6.1 Shell e autenticação

| Item                                     | Estado        |
| ---------------------------------------- | ------------- |
| Shell compartilhado                      | Implementado  |
| Variante terapeuta                       | Implementada  |
| Navegação única por plano/capability     | Implementada  |
| Sessão validada pelo Supabase            | Implementada  |
| Bloqueio de terapeuta suspenso/rejeitado | Implementado  |
| Dashboard Premium Plus                   | Implementado  |
| Dashboard Básico/Premium                 | Scaffold      |
| Agenda                                   | Em construção |
| Sessões do terapeuta                     | Em construção |
| Demais áreas Plus                        | Em construção |

### 6.2 Domínio e banco

| Estrutura                                 | Decisão                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `therapist_services`                      | Reutilizar                                       |
| `availability_rules`                      | Reutilizar e fortalecer                          |
| `availability_exceptions`                 | Reutilizar para exceções simples                 |
| `therapist_service_booking_settings`      | Reutilizar                                       |
| `bookings`                                | Adaptado na A2 com snapshot, versão e conflito   |
| `booking_events`                          | Auditoria A2 com ator, origem e request ID       |
| `booking_reschedule_requests`             | Evoluído na A2 com expiração e aplicação         |
| `booking_session_summaries`               | Reutilizar                                       |
| `therapist_service_cancellation_policies` | Reutilizar                                       |
| `payments`                                | Manter apenas como projeção legada temporária    |
| `bookings.payment_status`                 | Tratar como projeção temporária                  |
| `booking_payment_receipts`                | Tratar como projeção de recibo                   |
| `session_payments`                        | Implementado; fonte financeira canônica          |
| `financial_policy_versions`               | Implementado; versiona regras financeiras        |
| `financial_ledger_entries`                | Implementado com lançamentos compensatórios      |
| `therapist_subscriptions`                 | Implementado com proteção temporal               |
| `therapist_connect_accounts`              | Accounts v2 com eventos snapshot e thin          |
| `payout_batches` e itens                  | Implementados; E2E Stripe ainda não homologado   |
| `stripe_webhook_events`                   | Reserva atômica, lease, retry e idempotência     |
| `booking_holds`                           | Implementado na A2 antes do checkout             |
| bloqueios recorrentes                     | Adaptar schema após ADR                          |
| `zoom_meetings`                           | Fonte operacional canônica da sala Zoom          |
| `zoom_meeting_jobs`                       | Outbox idempotente com retry e dead letter       |
| `zoom_webhook_events`                     | Inbox idempotente e auditoria sanitizada         |
| `zoom_meeting_participations`             | Evidência operacional; papel ainda não atribuído |
| `session_occurrences`                     | Não criar no MVP atual                           |
| outbox                                    | Implementada para Zoom; reutilizar o padrão      |

### 6.3 Integrações

| Integração                 | Estado verificado                                              |
| -------------------------- | -------------------------------------------------------------- |
| Supabase Auth              | Implementado                                                   |
| Supabase RLS               | Parcialmente implementado                                      |
| Dashboard RPC              | Implementado                                                   |
| Match determinístico       | Implementado                                                   |
| Stripe Checkout de sessão  | Implementado com confirmação síncrona e assíncrona             |
| Stripe Billing funcional   | Implementado em test mode; E2E Stripe ainda não homologado     |
| Stripe Connect             | Accounts v2 com eventos snapshot e thin implementado           |
| Webhooks Stripe            | Assinados, reservados atomicamente, idempotentes e ordenados   |
| Zoom                       | Fundação local implementada; homologação externa pendente      |
| Ledger e repasses          | Ledger, Charge de origem, conciliação e reversão implementados |
| Observabilidade definitiva | Não identificado nos arquivos analisados.                      |

### 6.4 Evidência desta revisão

Executado em 2026-07-26:

- `npx supabase db reset`: passou com as duas migrations Zoom;
- `npx supabase db lint --schema public`: passou sem erro;
- `npx supabase test db`: 26 testes existentes passaram;
- teste Vitest de `ZoomMeetingAdapter`: 3 testes passaram;
- `npm run typecheck`: passou;
- `npm run lint`: passou sem warnings de código;
- `npm run test`: 12 arquivos e 50 testes passaram;
- `npm run build`: passou com 55 rotas;
- grants por coluna confirmam que authenticated não lê host ID, UUID,
  passcode, `start_url` ou metadata sensível;
- RPCs Zoom confirmadas sem `EXECUTE` para `anon` e `authenticated`.

Não reexecutado nesta revisão:

- Deno Zoom, porque o binário `deno` não está instalado no host;
- testes reais contra Zoom/Marketplace, que exigem secrets e
  `ALLOW_REAL_ZOOM_TESTS=true`;
- smoke remoto de webhook, ZAK e cron de produção.

A entrega mergeada registra sucesso no teste real de criação/update/delete,
smoke local de webhook e fluxo real de fila. Esses resultados são evidência da
entrega anterior e devem ser revalidados no ambiente alvo antes do go-live.

Lacuna de cobertura: não existe arquivo pgTAP Zoom em `supabase/tests/`. As
policies e grants foram inspecionados, mas ainda não têm regressão automatizada.

Nota de ferramenta: `npx supabase db lint` sem filtro também inspeciona a
extensão pgTAP e reportou diagnósticos internos dela. O lint restrito ao schema
de aplicação, `--schema public`, passou sem erro.

## 7. Fontes de verdade e estados

### 7.1 Dimensões separadas

Um atendimento pode estar simultaneamente:

- com booking confirmado;
- com pagamento aprovado;
- ainda não realizado;
- com presença não registrada;
- sem repasse elegível.

As dimensões devem permanecer separadas:

| Dimensão             | Responsabilidade                         |
| -------------------- | ---------------------------------------- |
| `bookingStatus`      | Validade do compromisso e do horário.    |
| `paymentStatus`      | Ciclo da cobrança do paciente.           |
| `fulfillmentStatus`  | Execução da sessão.                      |
| `attendanceStatus`   | Presença de paciente e terapeuta.        |
| `rescheduleStatus`   | Negociação de novo horário.              |
| `cancellationStatus` | Solicitação e resolução de cancelamento. |
| `transferStatus`     | Elegibilidade e repasse ao terapeuta.    |

`ServiceStatus` permanece reservado ao cadastro do serviço:

- `draft`;
- `active`;
- `paused`;
- `archived`.

### 7.2 Booking

Estados atuais preservados:

```text
draft
pending_payment
confirmed
completed
cancelled_by_patient
cancelled_by_therapist
no_show_patient
no_show_therapist
refunded
```

`refunded` é um estado legado que mistura booking e pagamento. Não deve ser
removido sem plano de migração, mas também não deve orientar novos fluxos.

Não adicionar ao booking:

- `reschedule_requested`;
- `cancel_requested`;
- `payment_failed`;
- `contested`;
- `held`.

Esses estados pertencem a processos próprios. Um hold antecede o booking
confirmado e não precisa ser um booking incompleto.

### 7.3 Reagendamento

Estados mínimos:

```text
pending
accepted
rejected
cancelled
expired
applied
```

O schema atual cobre os quatro primeiros, exceto `expired` e `applied`.
Contrapropostas e múltiplas propostas devem ser avaliadas antes de ampliar a
tabela.

### 7.4 Contadores do shell

O read model compartilhado deve expor somente métricas existentes:

```ts
type TherapistShellCounters = {
  unreadMessages: number;
  unreadNotifications: number;
  pendingRescheduleRequests: number;
  pendingPayments: number;
  pendingReviewReplies: number;
  impactedBookings: number;
};
```

Não usar `pendingSessionConfirmations` antes da criação de um workflow real.

## 8. Agenda

### 8.1 Calendário

Responsabilidades:

- mostrar bookings;
- mostrar bloqueios;
- permitir visão de dia, semana e mês;
- destacar eventos que precisam de ação;
- abrir detalhes da sessão;
- apresentar agenda cronológica no mobile;
- representar status com texto ou ícone além da cor.

### 8.2 Horários

Responsabilidades:

- ativar dias da semana;
- configurar várias faixas;
- copiar faixas;
- configurar duração e intervalo;
- configurar buffers;
- respeitar timezone IANA;
- configurar antecedência e horizonte;
- validar sobreposição;
- apresentar preview de slots.

Regras recorrentes não criam bookings.

### 8.3 Bloqueios

Responsabilidades:

- bloquear dia inteiro ou faixa parcial;
- classificar motivo;
- suportar recorrência aprovada;
- pesquisar e filtrar;
- detectar bookings impactados;
- exigir decisão sobre conflitos;
- preservar histórico;
- notificar participantes;
- registrar auditoria.

Criar um bloqueio não cancela silenciosamente bookings existentes.

### 8.4 Motor de slots

O slot final combina:

```text
disponibilidade recorrente
+ exceções disponíveis
- bloqueios
- bookings ativos
- holds ativos
- buffers
- antecedência mínima
- horizonte máximo
+ duração do serviço
= slots reserváveis
```

O motor atual em TypeScript é útil para preview, mas ainda não pode ser a
autoridade transacional porque:

- avalia datas no timezone do processo;
- não aplica de forma completa o timezone IANA da regra;
- filtra conflito por serviço, permitindo colisão entre serviços diferentes;
- não protege concorrência;
- não possui hold;
- não possui constraint transacional;
- ainda não tem testes dedicados.

O backend deve recalcular disponibilidade no momento do hold e da reserva.

## 9. Sessões

Agenda responde:

> Quando estou disponível e o que está marcado?

Sessões responde:

> Qual atendimento preciso executar, concluir ou resolver?

A lista de Sessões deve permitir:

- próximas;
- hoje;
- pagamento pendente;
- reagendamento solicitado;
- concluídas;
- canceladas;
- não comparecimento;
- problemas operacionais.

O detalhe deve reunir:

- paciente;
- serviço;
- horário;
- modalidade;
- pagamento;
- link seguro;
- intake compartilhado;
- política;
- eventos;
- resumo;
- avaliação;
- suporte.

Paciente e terapeuta devem consumir um DTO-base compartilhado, com extensões e
ações específicas por papel.

## 10. Segurança da sessão online

### 10.1 Estado implementado

O campo `bookings.meeting_url` permanece legado e não é a fonte da sala. A
fundação atual usa:

- `zoom_meetings` para estado operacional da reunião;
- `zoom_meeting_jobs` como outbox de create, update, cancel e reconcile;
- `zoom_webhook_events` como inbox idempotente e trilha sanitizada;
- `zoom_meeting_participations` para eventos operacionais de presença;
- views `patient_zoom_meeting_summary_v` e
  `therapist_zoom_meeting_summary_v` com `security_invoker`;
- `zoom-meeting-access` para autorizar booking, pagamento, janela e papel;
- Meeting SDK JWT gerado no backend;
- ZAK solicitado somente para o terapeuta e nunca persistido;
- `zoom-jobs-process` protegido por token interno;
- `zoom-webhook` com limite de corpo, challenge-response,
  `x-zm-signature`, proteção temporal e deduplicação;
- enfileiramento após `session_payments.financial_status = paid`.

`start_url_encrypted` e `passcode_encrypted` existem como reserva de schema, mas
não são preenchidos pelo fluxo atual. A implementação prefere recuperar os
dados mínimos do provedor sob demanda e não persistir `start_url` ou ZAK.

### 10.2 Controles confirmados

- migrations aplicam em `supabase db reset`;
- RPCs Zoom são executáveis apenas por `service_role`;
- authenticated lê somente colunas seguras de `zoom_meetings`, sob RLS;
- jobs e eventos de webhook não têm leitura direta autenticada;
- tópico remoto usa referência opaca e não inclui conteúdo clínico;
- create/update revalidam pagamento canônico no processador;
- cancelamento remoto trata `404` como sucesso idempotente;
- locks de job expirados podem ser recuperados;
- evento `meeting.started` não regride reunião encerrada ou cancelada.

### 10.3 Bloqueios antes de produção

1. remover `allowBlockedStatus: true` do acesso do terapeuta ou criar exceção
   explícita e auditada;
2. validar `session_payments.financial_status` também no endpoint de acesso, sem
   depender apenas da projeção `bookings.payment_status`;
3. definir uma topologia de hosts licenciados por terapeuta ou um alocador com
   controle de concorrência; `ZOOM_DEFAULT_HOST_USER_ID` único é apenas base de
   desenvolvimento;
4. resolver a precedência ambígua entre cookies de paciente e terapeuta;
5. confirmar scopes e ZAK no Zoom Marketplace;
6. configurar cron remoto e webhook público validado;
7. adicionar pgTAP de RLS para paciente, terapeuta responsável, terapeuta
   externo, suspenso e usuário anônimo;
8. definir deduplicação semântica e atribuição de papel nas participações antes
   de usá-las como evidência de comparecimento;
9. decidir retenção LGPD dos eventos operacionais;
10. homologar licença, concorrência, rate limits e falhas reais do provedor.

## 11. Financeiro

### 11.1 Estado atual

`session_payments` é a fonte financeira canônica. Permanecem representações
legadas somente como projeções de compatibilidade:

- `payments`;
- `bookings.payment_status`;
- `booking_payment_receipts`.

O Gate F0 adicionou backfill idempotente, projeção transacional para
`payments`, `bookings.payment_status` e `booking_payment_receipts`, além de
revogar escrita direta de `service_role` em `payments`.

Também já existem:

- catálogo e assinaturas Stripe Billing;
- contas conectadas Accounts v2;
- Checkout de sessão;
- políticas financeiras versionadas;
- refunds, disputas e confirmação de serviço;
- ledger append-only;
- lotes e itens de repasse;
- transfers e reversões modeladas;
- registro idempotente de eventos Stripe.

### 11.2 Resultado do Gate F0

1. `session_payments` mantido como única fonte transacional;
2. dados equivalentes de `payments` importados com política legada explícita;
3. projeções sincronizadas por trigger e escrita direta de `service_role`
   revogada em `payments`;
4. Checkout só confirma sessão quando `payment_status = paid`;
5. pagamentos assíncronos e `payment_intent.processing` tratados;
6. reserva de webhook atômica, com lease, retry e proteção concorrente;
7. pagamentos e assinaturas protegidos contra eventos fora de ordem;
8. plano resolvido pelo Price ID efetivo;
9. eventos snapshot e thin de Accounts v2 tratados;
10. terapeuta `suspended` ou `rejected` bloqueado nas operações financeiras,
    preservando somente Billing Portal e cancelamento;
11. repasse exige terapeuta aprovado, Connect pronto, Charge reconciliada e
    usa `source_transaction`;
12. refunds, disputas ganhas e reversões geram ledger compensatório;
13. reconciliação recupera Charge, Balance Transaction, taxa e valor líquido;
14. RLS de ownership e funções SQL privadas cobertas por pgTAP.

Trade-off: o webhook ainda processa o evento dentro da Edge Function após
reservá-lo no inbox SQL. Uma fila assíncrona dedicada continua recomendada antes
de volume alto, mas não é necessária para iniciar A2 nem altera os invariantes
financeiros agora garantidos.

## 12. Compatibilidade entre os shells

| Domínio             | Terapeuta        | Paciente                       | Fonte                 |
| ------------------- | ---------------- | ------------------------------ | --------------------- |
| Próximo atendimento | Início/Agenda    | Início/Encontros               | booking               |
| Disponibilidade     | Agenda/Horários  | Seleção de horário             | slot engine           |
| Bloqueio            | Agenda/Bloqueios | Slot removido ou reagendamento | exceção/bloqueio      |
| Sessão              | Sessões          | Sessões/Encontros              | booking + projeção    |
| Pagamento           | Financeiro       | Pagamento/recibo               | session payment       |
| Reagendamento       | Agenda/Sessões   | Ação no encontro               | reschedule request    |
| Cancelamento        | Agenda/Sessões   | Ação no encontro               | cancellation workflow |
| Link online         | Sessão           | Sessão                         | meeting projection    |
| Avaliação           | Avaliações       | Avaliar encontro               | review                |
| Mensagem            | Mensagens        | Mensagens                      | conversation/message  |
| Perfil              | Meu perfil       | Perfil público                 | versão publicada      |
| Serviço             | Serviços         | Serviço escolhido              | therapist service     |
| Histórico           | Pacientes        | Minha jornada                  | bookings + summaries  |

As diferenças devem estar nas permissões, DTOs e ações, não na duplicação dos
registros.

## 13. Regras técnicas críticas

### 13.1 Concorrência

Dois pacientes não podem reservar intervalos sobrepostos do mesmo terapeuta.

Proteções necessárias:

- transação;
- hold com TTL;
- idempotency key;
- lock adequado;
- constraint de exclusão quando compatível;
- recálculo no backend;
- webhook idempotente.

O conflito independe do serviço escolhido.

### 13.2 Timezone

- Persistir timestamps em UTC.
- Persistir timezone IANA.
- Não usar apenas offset.
- Interpretar recorrência no timezone do terapeuta.
- Converter somente nas bordas.
- Testar horário de verão histórico e mudança de timezone.

### 13.3 Auditoria

Eventos relevantes devem registrar:

- ator;
- origem;
- booking;
- estado anterior;
- estado novo;
- request ID;
- timestamp;
- motivo;
- política aplicada;
- metadados sem dados sensíveis desnecessários.

### 13.4 Privacidade

Aura e analytics podem usar dados agregados e operacionais autorizados.

Não expor automaticamente:

- notas privadas;
- conteúdo clínico;
- respostas privadas do Match;
- documentos;
- credenciais de reunião;
- dados financeiros internos;
- PII sem necessidade.

## 14. Roadmap do módulo Agenda e Sessões

Para não conflitar com as fases globais de `project.md`, este módulo usa o
prefixo `A`.

| Marco | Objetivo                                        |
| ----- | ----------------------------------------------- |
| A0    | Auditoria e decisões                            |
| F0    | Hardening financeiro para produção (concluído)  |
| A1    | Rotas e contratos compartilhados (concluído)    |
| Z0    | Fundação técnica Zoom (concluída fora de ordem) |
| A2    | Banco, RLS e funções transacionais (concluído)  |
| A3    | Horários                                        |
| A4    | Bloqueios                                       |
| A5    | Motor autoritativo de slots                     |
| A6    | Orquestração de hold, booking e checkout        |
| A7    | Calendário do terapeuta                         |
| A8    | Compatibilidade integral com paciente           |
| A9    | Produto Zoom e presença (parcialmente entregue) |
| A10   | Reagendamento e cancelamento                    |
| A11   | Pós-sessão, financeiro e repasse                |
| A12   | Insights                                        |

## 15. Fase Agenda 1 - Rotas e contratos compartilhados

### 15.1 Objetivo

Unificar a área autenticada em `/terapeuta/*`, preservar os namespaces atuais
como redirects de transição e criar uma linguagem técnica única para Agenda,
booking e Sessões. A fase não altera schema financeiro nem inicia Zoom.

Resultado em 2026-07-25:

- namespace `/terapeuta/*` implementado;
- redirects 307 dos aliases implementados com preservação de deep link e query;
- autorização por namespace removida;
- navegação, login e retornos Stripe migrados;
- contratos, erros e DTOs compartilhados criados;
- preview de disponibilidade validado e coberto por testes;
- ADRs, vocabulário, matriz do schema e skill local criados;
- nenhuma migration ou dependência adicionada.

### 15.2 Pré-condições

- decisões arquiteturais deste relatório aprovadas;
- namespace autenticado `/terapeuta/*` aprovado;
- `/terapeutas/*` preservado exclusivamente para busca e perfil público;
- migrations atuais revisadas;
- inventário dos links legados e URLs de retorno concluído;
- worktree conhecido;
- Supabase local disponível para validação;
- nenhuma dependência nova sem aprovação;
- Gate F0 concluído e validado antes do início de A2.

### 15.3 Pacote A1.1 - ADRs

ADRs criados para:

1. rota canônica unificada, aliases legados e colisão com o alias público
   `/terapeuta/:slug`;
2. booking e sessão no MVP;
3. ratificação de `session_payments` e transição das projeções legadas;
4. segurança da reunião online;
5. disponibilidade, bloqueios e autoridade do slot engine.

Cada ADR deve registrar:

- contexto;
- decisão;
- alternativas;
- consequências;
- compatibilidade;
- estratégia de migração;
- riscos;
- critérios de revisão futura.

### 15.4 Pacote A1.2 - Unificação de rotas

Arquitetura aprovada:

- `/terapeuta` é a entrada autenticada;
- `/terapeuta/agenda`, `/terapeuta/pacientes`, `/terapeuta/sessoes`,
  `/terapeuta/mensagens`, `/terapeuta/servicos`, `/terapeuta/financeiro`,
  `/terapeuta/avaliacoes`, `/terapeuta/insights`, `/terapeuta/assessor-ia`,
  `/terapeuta/perfil`, `/terapeuta/configuracoes`, `/terapeuta/plano` e
  `/terapeuta/suporte` são rotas estáveis;
- plano e capability controlam conteúdo e ações, nunca o endereço;
- `/basico/*`, `/pro/*` e `/plus/*` redirecionam para a rota equivalente;
- query string e identificadores válidos são preservados nos redirects;
- `/terapeutas` e `/terapeutas/:slug` continuam públicos;
- o alias público singular `/terapeuta/:slug` deve ser removido após redirect
  específico para `/terapeutas/:slug`, evitando colisão com a área autenticada.

Alterações previstas:

1. adicionar as rotas canônicas em `src/lib/routes.ts`;
2. migrar navegação e links internos do shell;
3. retirar `namespace` da autorização de `requireTherapistSession`;
4. autorizar por papel, status, plano mínimo e capability;
5. criar a árvore compartilhada `src/app/(therapist)/terapeuta/*`;
6. transformar as árvores `/basico`, `/pro` e `/plus` em redirects finos;
7. atualizar URLs de retorno Stripe hoje fixadas em `/basico/pagamento` e
   `/pro/plano`;
8. preservar `/terapeuta/login`, `/terapeuta/cadastro` e
   `/terapeuta/checkout`;
9. criar testes de redirect, deep link, query string, upgrade, downgrade e
   capability gate;
10. validar que nenhuma rota pública `/terapeutas/*` foi interceptada.

### 15.5 Pacote A1.3 - Tipos canônicos

Reutilizar de `src/domain/tes`:

- `BookingStatus`;
- `PaymentStatus`;
- `ServiceStatus`;
- `AvailabilityRule`;
- tipos base de profile, serviço e booking.

Criar somente o que falta:

- `FulfillmentStatus`;
- `AttendanceStatus`;
- `RescheduleStatus`;
- `CancellationStatus`;
- `ScheduleBlockType`;
- `AvailableSlot`;
- `BookingHoldStatus`;
- `DomainErrorCode`.

Eliminar a duplicação de:

- `BookingStatus` em `src/features/bookings/booking.types.ts`;
- `BookingPaymentStatus` quando equivalente a `PaymentStatus`;
- tipos de slot presos à feature de perfil público.

Features podem declarar view models, mas não novos enums de domínio
equivalentes.

### 15.6 Pacote A1.4 - Erros de domínio

Catálogo inicial:

```text
SLOT_NOT_AVAILABLE
SLOT_HELD_BY_ANOTHER_USER
INVALID_AVAILABILITY_RANGE
OVERLAPPING_AVAILABILITY_RULE
BOOKING_CONFLICT
BOOKING_ALREADY_PAID
BOOKING_CANNOT_BE_RESCHEDULED
BLOCK_IMPACTS_EXISTING_BOOKINGS
SESSION_ACCESS_NOT_OPEN
INVALID_STATE_TRANSITION
```

Cada erro deve possuir:

- código estável;
- mensagem interna não exposta;
- mensagem segura de UI;
- categoria;
- possibilidade de retry;
- status HTTP sugerido somente na camada de transporte.

### 15.7 Pacote A1.5 - DTO compartilhado

Criar um contrato-base sem dados indevidos:

```ts
type SharedBookingSummary = {
  bookingId: string;
  patient: PersonSummary;
  therapist: PersonSummary;
  service: ServiceSummary;
  startsAt: string;
  endsAt: string;
  timezone: string;
  modality: "online" | "in_person";
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
};
```

Extensão do paciente:

- ações de pagamento;
- cancelamento;
- reagendamento;
- entrada na sessão;
- avaliação;
- recibo.

Extensão do terapeuta:

- dados operacionais permitidos do paciente;
- solicitação de reagendamento;
- execução da sessão;
- presença;
- resumo compartilhado;
- status financeiro resumido.

O DTO-base não deve retornar:

- host URL;
- notas privadas;
- conteúdo clínico;
- margem interna TES;
- dados do Match;
- documentos.

### 15.8 Pacote A1.6 - Matriz do schema

Produzir documento versionado com:

- tabela atual;
- responsabilidade atual;
- consumidor atual;
- RLS existente;
- decisão reutilizar/adaptar/substituir/criar;
- migration futura;
- risco de compatibilidade.

Essa matriz deve cobrir pelo menos:

- serviços;
- disponibilidade;
- exceções;
- settings;
- bookings;
- eventos;
- reagendamentos;
- resumos;
- pagamentos;
- recibos;
- reuniões;
- mensagens;
- avaliações;
- notificações.

### 15.9 Pacote A1.7 - Disponibilidade

Nesta fase o motor TypeScript continua sendo preview, mas deve:

- usar tipos canônicos;
- bloquear booking do terapeuta independentemente do serviço;
- aplicar buffers nos intervalos de conflito;
- rejeitar intervalos inválidos;
- tornar explícita a limitação de timezone;
- não ser usado para confirmar reserva;
- receber testes determinísticos.

A decisão sobre geração timezone-safe e transacional no Postgres/RPC pertence à
Fase A2.

### 15.10 Pacote A1.8 - Testes

Testes unitários:

- construção de rotas canônicas;
- redirects dos aliases `/basico`, `/pro` e `/plus`;
- preservação de deep link, identificador e query string;
- gates de plano e capability independentes da URL;
- upgrade e downgrade sem troca de namespace;
- type guards dos estados;
- transições permitidas e proibidas;
- erros de domínio;
- disponibilidade sobreposta;
- conflito entre serviços diferentes;
- buffers;
- exceção indisponível;
- exceção disponível;
- antecedência mínima;
- horizonte;
- período vazio;
- duração diferente por serviço;
- divisão por zero quando houver métricas.

Testes de contrato:

- `/terapeutas/*` permanece público e não é capturado pelo shell autenticado;
- `/terapeuta/:slug` redireciona para `/terapeutas/:slug` durante a transição;
- URLs de retorno Stripe apontam somente para `/terapeuta/*`;
- DTO paciente não contém dados do terapeuta restritos;
- DTO terapeuta não contém dados privados do paciente;
- mesmo booking produz horário e serviço idênticos nos dois papéis;
- status visual não altera status transacional.

Não serão criados testes SQL de tabelas ainda inexistentes nesta fase. Os testes
financeiros de webhook, idempotência, reconciliação e RLS pertencem ao Gate F0 e
podem evoluir em paralelo, sem serem confundidos com os critérios de A1.

### 15.11 Pacote A1.9 - Documentação

Atualizar e manter sincronizados:

- este relatório;
- `docs/architecture/project.md`;
- `docs/architecture/supabase-mvp-domain.md`;
- `docs/product/sitemap.md`;
- `docs/product/routes-map.md`;
- `docs/product/integration-map.md`;
- `docs/product/page-inventory.md`;
- `AGENTS.md`;
- skills locais de autenticação, dashboard, Agenda/Sessões e pagamentos.

A documentação canônica registra `/terapeuta/*` como arquitetura aprovada e
identifica `/basico/*`, `/pro/*` e `/plus/*` como estado executável legado. A
remoção da marcação de transição só ocorre após a estratégia estar refletida em
`src/lib/routes.ts`, nos redirects e nos testes.

### 15.12 Arquivos implementados

Criados:

- `docs/architecture/adr/ADR-001-therapist-canonical-routes.md`;
- `docs/architecture/adr/ADR-002-booking-session-boundary.md`;
- `docs/architecture/adr/ADR-003-session-payments-source-of-truth.md`;
- `docs/architecture/adr/ADR-004-meeting-security.md`;
- `docs/architecture/adr/ADR-005-availability-authority.md`;
- `docs/architecture/therapist-domain-vocabulary.md`;
- `docs/architecture/therapist-schema-evolution-matrix.md`;
- `src/domain/tes/booking-contracts.ts`;
- `src/domain/tes/availability-contracts.ts`;
- `src/domain/tes/domain-errors.ts`;
- árvore compartilhada em `src/app/(therapist)/terapeuta/*`;
- redirects finos em `next.config.mjs` para os namespaces legados;
- testes correspondentes;
- skill local compartilhada de Agenda/Sessões.

Alterados:

- `src/domain/tes/index.ts`;
- `src/lib/routes.ts`;
- `src/lib/auth/therapist-session.ts`;
- configuração de navegação do shell do terapeuta;
- layouts e páginas antes distribuídos entre `/basico`, `/pro` e `/plus`,
  removidos após a criação dos redirects;
- `src/features/bookings/booking.types.ts`;
- `src/features/bookings/booking-status.ts`;
- `src/features/availability/services/availability-service.ts`;
- `supabase/functions/stripe-connect-create-account-link/index.ts`;
- `supabase/functions/stripe-create-billing-portal/index.ts`;
- consumidores dos tipos duplicados;
- documentos listados no pacote A1.9.

Nenhuma migration foi criada na Fase A1; os tipos gerados do banco não foram
alterados.

### 15.13 Ordem de execução

1. ADRs.
2. Inventário de links, redirects e colisões.
3. Rotas canônicas, shell compartilhado e redirects.
4. Migração de URLs de retorno e links internos.
5. Vocabulário.
6. Matriz do schema.
7. Tipos canônicos.
8. Erros de domínio.
9. DTO compartilhado.
10. Ajustes seguros no preview de disponibilidade.
11. Testes.
12. Atualização documental.
13. QA final.

### 15.14 Critérios de aceite

- `/terapeuta/*` funciona como namespace autenticado canônico;
- `/basico/*`, `/pro/*` e `/plus/*` redirecionam sem perder deep link ou query;
- `/terapeutas/*` continua sendo exclusivamente público;
- o alias público singular não colide com o shell autenticado;
- navegação, login e URLs de retorno Stripe usam as rotas canônicas;
- nenhuma autorização inferida pela URL;
- uma única definição TypeScript de cada status;
- `ServiceStatus` preservado para serviços;
- reagendamento e pagamento fora do booking status;
- conflito de agenda independe do serviço;
- limitações de timezone explícitas;
- contratos não expõem dados privados;
- nenhuma tabela duplicada criada;
- nenhuma migration executada;
- nenhuma dependência adicionada;
- testes de rotas, redirects e capability gates aprovados;
- typecheck aprovado;
- lint aprovado;
- testes Vitest aprovados;
- build aprovado;
- diff documental sem referências quebradas.

### 15.15 Fora do escopo

Esta lista registra o escopo histórico de A1. Zoom foi implementado depois, no
marco independente Z0.

- implementação visual da Agenda;
- migrations de disponibilidade;
- holds;
- hardening de cobrança, assinatura, Connect, ledger e repasses do Gate F0;
- Zoom durante A1;
- remoção imediata dos aliases legados; eles permanecem como redirects;
- IA generativa;
- prontuário clínico.

## 16. Fases posteriores

### A2 - Banco e RLS

Resultado em 2026-07-26:

- snapshots imutáveis de título, duração, preço, moeda e buffers em `bookings`;
- `occupied_during` persistido para indexação GiST sem depender de expressões
  não imutáveis de `timestamptz`;
- `booking_holds` com TTL, idempotência, estados terminais e conversão atômica
  para booking `draft`;
- exclusão de sobreposição por terapeuta, independente do serviço;
- advisory lock por terapeuta para serializar conflitos entre as tabelas de
  holds e bookings;
- versionamento otimista e catálogo SQL de transições compatível com
  `src/domain/tes`;
- eventos de booking com ator, origem, request ID, estado anterior e novo;
- reagendamento com snapshot original, expiração, uma solicitação pendente por
  booking, resolução pela contraparte e estado final `applied`;
- job idempotente `update` ou `cancel` no outbox Zoom quando a sala já existe;
- checkout Stripe de sessão alterado para cobrar o snapshot do booking, sem
  consultar preço ou título mutável do serviço;
- RLS de leitura para os participantes e RPCs de escrita restritos a
  `service_role`, destinados a Edge Functions autenticadas;
- duas migrations, tipos Supabase regenerados e 41 testes pgTAP específicos;
- seed corrigido para não manter dois encontros ativos sobrepostos da mesma
  terapeuta.

Limite intencional:

- A2 entrega as primitivas transacionais, não endpoints públicos de Agenda;
- o preview TypeScript ainda não é o motor de slots autoritativo;
- A5 implementará a composição completa de disponibilidade e A6 fará a
  orquestração autenticada entre hold, booking, `session_payments` e Stripe;
- nenhuma tabela financeira, ledger ou estrutura Zoom paralela foi criada.

### A3 - Horários

- leitura e edição;
- múltiplas faixas;
- cópia;
- timezone;
- buffers;
- preview;
- validação;
- estados vazios e erros.

### A4 - Bloqueios

- bloqueio simples;
- recorrência;
- impacto;
- resolução;
- auditoria;
- notificações.

### A5 - Slots

- endpoint autoritativo;
- timezone;
- buffers;
- exceções;
- bookings;
- holds;
- concorrência.

### A6 - Hold e booking

- hold com TTL;
- idempotência;
- snapshot;
- integração do hold e booking com `stripe-create-session-payment`;
- confirmação usando o fluxo Stripe existente após o Gate F0.

### A7 - Calendário

- dia;
- semana;
- mês;
- lista mobile;
- filtros;
- detalhe;
- acessibilidade.

### A8 - Paciente

- reflexo dos mesmos bookings;
- pagamento;
- cancelamento;
- reagendamento;
- sessão;
- avaliação.

### A9 - Sala online

Fundação já entregue em Z0:

- criação/update/cancel/reconcile por outbox;
- Meeting SDK para paciente e terapeuta;
- janela de acesso;
- webhooks e auditoria sanitizada;
- páginas de ajuda e adapter de interface.

Escopo restante de A9:

- bloquear terapeuta suspenso/rejeitado;
- validar pagamento canônico no gate de acesso;
- eliminar ambiguidade entre cookies de papéis diferentes;
- definir alocação e capacidade de hosts;
- homologar ZAK e Meeting SDK no Marketplace;
- configurar cron e webhook remotos;
- atribuir papel e deduplicar participações;
- cobrir RLS e acesso com pgTAP e E2E;
- integrar presença ao produto sem convertê-la automaticamente em prova
  financeira ou clínica.

### A10 - Reagendamento e cancelamento

- integração e hardening das políticas e tabelas existentes;
- contraproposta;
- expiração;
- reembolso;
- bloqueio urgente;
- disputas operacionais.

### A11 - Pós-sessão e financeiro

- confirmação e contestação sobre as estruturas existentes;
- elegibilidade de repasse;
- reconciliação do ledger;
- lotes e transferências;
- refunds, disputes e reversões;
- nenhuma segunda fonte financeira.

### A12 - Insights

- ocupação;
- demanda;
- cancelamentos;
- recorrência;
- horários ociosos;
- métricas agregadas.

## 17. Testes indispensáveis do roadmap

### Disponibilidade

- faixas sobrepostas;
- faixa cruzando meia-noite;
- dia desativado;
- timezone;
- horário de verão histórico;
- buffers;
- durações diferentes;
- exceção parcial;
- recorrência com horizonte.

### Concorrência

- dois pacientes no mesmo slot;
- serviços diferentes no mesmo horário;
- hold expirado;
- retry;
- webhook duplicado;
- webhook fora de ordem.

### Segurança

- paciente acessando booking de outro paciente;
- terapeuta acessando paciente de outro terapeuta;
- manipulação de preço;
- manipulação de therapist ID;
- alteração direta de status;
- vazamento de host URL;
- enumeração de IDs;
- RLS por papel.

### Financeiro

- Checkout concluído sem pagamento confirmado;
- eventos assíncronos de sucesso e falha;
- webhook duplicado, concorrente e fora de ordem;
- assinatura com evento antigo não sobrescreve estado novo;
- terapeuta suspenso ou rejeitado não inicia operação financeira;
- Connect Accounts v2 e eventos de capability;
- transferência vinculada à charge por `source_transaction`;
- refund, dispute, reversão e reconciliação;
- isolamento RLS e idempotência do seed financeiro.

### Zoom

- paciente não acessa booking de outro paciente;
- terapeuta externo, suspenso ou rejeitado não recebe payload de host;
- acesso confirma `session_payments.financial_status = paid`;
- cookies simultâneos não trocam o papel efetivo;
- ZAK nunca é retornado ao paciente nem persistido;
- RPCs Zoom não são executáveis por `anon` ou `authenticated`;
- RLS não expõe host ID, UUID, passcode, `start_url` ou payload de webhook;
- jobs concorrentes reservam uma única unidade;
- lock expirado é recuperado e retry chega a dead letter;
- webhook duplicado e replay temporal não duplicam efeito de negócio;
- evento fora de ordem não regride reunião encerrada;
- cancelamento/reembolso invalida acesso e enfileira cancelamento;
- múltiplas sessões simultâneas respeitam a capacidade real de hosts;
- cron, webhook remoto, rate limit e indisponibilidade do Zoom são observáveis.

### UX

- desktop, tablet e mobile;
- teclado;
- leitor de tela;
- contraste;
- zoom de 200%;
- loading;
- erro;
- agenda vazia;
- nomes longos;
- grande volume.

## 18. Conclusão

O shell do terapeuta deve evoluir como uma única aplicação autenticada,
independente do plano na URL. Plano e capability continuam essenciais, mas
pertencem à autorização e à composição da experiência, não à identidade do
recurso.

A decisão arquitetural central permanece:

> Agenda, booking, sessão, pagamento e repasse compartilham referências, mas
> possuem responsabilidades e ciclos de vida próprios.

A Fase Agenda 1 foi concluída com a unificação compatível de rotas e contratos.
O Gate F0 consolidou os invariantes financeiros e a fundação Z0 antecipou parte
de A9 sem alterar a ordem transacional: Stripe confirma, a outbox provisiona e
o backend autoriza a entrada.

A2 concluiu as primitivas que tornam a reserva concorrente e auditável. A3 é o
próximo marco para edição de horários e preview; A5 continuará responsável pela
composição autoritativa de slots e A6 pela orquestração de checkout. Em
paralelo, os bloqueios de produção listados em A9 devem ser fechados antes de
liberar sessões Zoom reais aos usuários.
