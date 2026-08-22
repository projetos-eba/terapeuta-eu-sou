# Fase 5 — Operação e QA de Mensagens + Suporte

> Este relatório registra a qualificação HML do domínio de Mensagens e
> Suporte realizada antes da Wave 4 de moderação de perfil. O fechamento local
> completo e a promoção coordenada das Waves 1–4 estão registrados em
> `docs/agent-work/wave-5-release-qualification-report.md`.

Data: 2026-08-21  
Ambiente de qualificação: HML (`Terapeuta-Eu-Sou-Homolog`)  
Produção: não alterada  
Status: **PASS — pronto para Release Candidate**

## Objetivo e decisão de escopo

Esta fase qualificou os fluxos já entregues nas Fases 1–4. Não foram adicionadas
features grandes, não foi criado um canal de resposta por e-mail e não houve
alteração no domínio de pagamentos, Zoom ou booking. A conversa canônica de
suporte continua autenticada dentro do TES; e-mail, quando existir para esse
domínio, será somente notificação.

## Operação qualificada

### Suporte TES

O cenário HML com BrowserContexts independentes de terapeuta e Admin passou:

1. terapeuta abre ticket com descrição plain text e recebe protocolo;
2. Admin localiza o ticket na Inbox e o atribui;
3. Admin altera prioridade, inicia atendimento e responde publicamente;
4. terapeuta visualiza a resposta e responde no mesmo ticket;
5. Admin adiciona nota interna sem alterar a thread pública;
6. Admin resolve o ticket;
7. terapeuta reabre explicitamente, retornando a `waiting_support`.

O backend confirmou os estados `open`, `in_progress`, `waiting_requester`,
`waiting_support` e `resolved`. A Inbox continua ordenando trabalho que aguarda
TES antes de chamados sem ação imediata.

### Mensagens estruturadas

O E2E HML V2 passou nas duas direções usando contextos independentes:

- terapeuta escolhe template, revisa preview imutável e envia para paciente;
- paciente lê o corpo resolvido pelo servidor e o CTA allowlisted;
- paciente repete o fluxo para terapeuta;
- refresh mantém o conteúdo e o contexto coerentes.

Resultado obrigatório: **PARTICIPANT FREE TEXT BYPASS = BLOCKED**.

## Segurança e abuso

Foram revalidados em HML, no pgTAP e nas rotas:

- requester não lê ticket de outro requester;
- requester recebe somente mensagens públicas do próprio ticket;
- nota `internal` nunca aparece no DTO, query ou tela do requester;
- requester não altera prioridade, atribuição ou lifecycle administrativo;
- APIs administrativas exigem sessão Admin e permissões `admin.support.*`;
- autoria e requester são derivados da sessão, nunca de campos do browser;
- `body`, `message`, `description` e `html` continuam rejeitados em mensagens
  estruturadas;
- CTA/URL arbitrária, template de direção errada e parâmetro fora da allowlist
  continuam rejeitados;
- `support_ticket_messages` não pode ser usado para contornar `messages`.

O fluxo de participante permanece sem escrita REST autenticada direta. O corpo
final é resolvido pela RPC e a escrita de `messages` continua protegida por RLS.

## Rate limiting e idempotência

Os limites server-side existentes foram revisados e permanecem ativos:

- abertura: no máximo 12 tickets por hora por requester;
- resposta pública do requester: no máximo 12 mensagens por 10 minutos;
- criação e resposta usam `request_id` idempotente;
- nota interna, resposta Admin, atribuição, prioridade e lifecycle usam
  request IDs e auditoria;
- retry com o mesmo request ID retorna o registro canônico e não cria cópia;
- duplo submit é bloqueado pelo estado de loading da UI e pela constraint/RPC.

Os contratos de `P0001` são convertidos pelas APIs em `429` com mensagem
operacional segura. Não foi executado flood deliberado em HML para não deixar
centenas de tickets de teste persistidos; a proteção e seus limites são
exercitados pela implementação SQL e pelos testes de rota/pgTAP.

## Atualização, não lidos e observabilidade

Notificações persistentes usam `event_key` único por perfil e `read_at`, evitando
duplicidade em retries. Existem eventos in-app para ticket criado, ticket
atualizado e mensagem recebida; a Central e os shells exibem estado não lido.
O detalhe de suporte mantém a thread como fonte canônica após refresh.

Não existe, nesta fase, um sistema adicional de unread por thread de suporte;
isso permanece follow-up pós-launch, pois não é necessário para operar o fluxo
qualificado.

Mutations administrativas gravam `admin_audit_events` com ação, ator, entidade,
request/correlation ID quando aplicável e before/after mínimo. Corpos completos
de mensagens, tokens e secrets não são gravados no audit log público.

## E-mail e notificações

A infraestrutura de e-mail Hostinger/outbox permanece íntegra e com retry,
claim/complete e deduplicação por entrega lógica. O inventário atual não possui
action keys de e-mail de suporte; portanto esta fase não inventou um disparo
novo. Suporte usa as notificações in-app já versionadas (`support_ticket_created`
e `support_ticket_updated`) e o ticket autenticado continua sendo a fonte
canônica.

Essa é uma limitação de escopo pós-launch, não uma falha de segurança: nota
interna não gera notificação pública e nenhum conteúdo interno é enviado por
e-mail.

## Compatibilidade

Tickets históricos sem `support_ticket_messages` permanecem legíveis. A rota de
detalhe materializa a `description` legada como mensagem pública sintética com
ID determinístico `legacy-initial:<ticketId>`, sem backfill destrutivo. Tickets
com thread usam exclusivamente as mensagens persistidas; a descrição não é
duplicada.

Mensagens estruturadas legadas sem `template_id` continuam legíveis e a V1
permanece compatível como wrapper da V2.

## QA visual, responsivo e acessibilidade

Playwright validou Central, suporte, Inbox, detalhe, thread, composer e preview
em desktop (1440px), tablet (768px) e mobile (390px), incluindo foco do
textarea, scroll da thread, textos longos e ausência de overflow horizontal.
Também foram verificados labels, nomes acessíveis de ações, foco/teclado,
feedback de loading/erro e status que não dependem apenas de cor.

O Chromium headless não simula o teclado virtual nativo; o reflow mobile e o
foco do composer foram validados. Não há ferramenta axe instalada no projeto,
portanto não foi declarada uma auditoria automatizada além das verificações
semânticas existentes.

## Migrations e HML

As migrations das Fases 1–4 foram aplicadas em sequência no projeto HML,
incluindo:

- `20260821210644_harden_structured_participant_messaging.sql`;
- `20260821213315_therapist_support_ticket_threads.sql`;
- `20260821224500_admin_support_thread_read.sql`;
- `20260821233000_admin_support_inbox_operations.sql`;
- `20260822010000_structured_participant_messages_v2.sql`.

A listagem remota foi conferida após o deploy e o runtime publicado nas branches
de homologação. Nenhuma migration ou mutation foi aplicada em produção.

## Validação técnica executada

- `npm run typecheck` — PASS;
- `npm run lint` — PASS, sem erros ou warnings ESLint do domínio;
- `npm run test` — PASS, **150 arquivos / 582 testes**;
- `npm run test:deno` — PASS, **159 testes**;
- `npx supabase test db` — PASS, **72 arquivos / 1.567 testes pgTAP**;
- `npx supabase db lint` — PASS, somente warnings preexistentes fora de
  mensagens/suporte;
- `npm run build` — PASS, 111 páginas estáticas geradas;
- `git diff --check` — PASS;
- E2E HML suporte — PASS, **3 testes**;
- E2E HML autenticação multi-persona — PASS, **1 teste**;
- E2E HML mensagens estruturadas V2 — PASS, **3 testes**.

## Pendências reais

- action keys de e-mail transacional para suporte ainda não existem; criar em
  fase posterior somente com contrato de destinatário, outbox e templates
  aprovados;
- unread específico por thread pode ser evoluído depois do lançamento;
- auditoria automatizada com axe e teclado virtual real exige device/browser
  externo, não disponível nesta execução.

Nenhuma pendência acima é P0/P1 para o domínio qualificado, e nenhuma permite
texto livre entre paciente e terapeuta.

## Resultado e gate final

Suporte pode ser operado por usuários reais e Admin sem vazamento de contexto
interno: **SIM**.

Paciente e terapeuta continuam incapazes de conversar por texto livre: **SIM**.

O domínio está pronto para entrar no Release Candidate global do TES: **SIM**.

**PHASE 5 — PASS**  
**MESSAGING + SUPPORT DOMAIN READY FOR RELEASE CANDIDATE**

> Entre terapeuta e paciente, o TES controla a linguagem. Entre usuário e TES,
> o TES controla o acesso — não a conversa.
