# Fechamento do marco A3 - Horários

Data: 2026-07-26

Status: concluído.

## Escopo entregue

O marco A3 consolidou a configuração de horários do terapeuta sem antecipar o
motor autoritativo de slots:

- A3.0 definiu autoridades e limites no ADR-006;
- A3.1 criou settings versionados, read model e comando atômico;
- A3.2 entregou a interface responsiva e funcional;
- A3.3 fechou contratos, segurança, concorrência, testes e evidências.

## Fontes canônicas

| Conceito                 | Fonte                                  |
| ------------------------ | -------------------------------------- |
| Timezone de negócio      | `therapist_schedule_settings.timezone` |
| Versão otimista          | `therapist_schedule_settings.version`  |
| Faixas semanais          | `availability_rules`                   |
| Duração                  | `therapist_services.duration_minutes`  |
| Cadência e buffers       | `therapist_service_booking_settings`   |
| Auditoria e idempotência | `therapist_schedule_events`            |
| Leitura autenticada      | `get_therapist_schedule_v1()`          |
| Escrita autenticada      | Edge `therapist-schedule-update`       |
| Comando transacional     | `save_therapist_schedule_v1()`         |

## Fluxo de dados

```text
Página /terapeuta/agenda?aba=horarios
  -> requireTherapistSession
  -> get_therapist_schedule_v1() com auth.uid()
  -> parser TypeScript versionado
  -> formulário por terapia, sem escopo geral
  -> POST /api/therapist/schedule
  -> Edge therapist-schedule-update
  -> valida access token, papel e status
  -> save_therapist_schedule_v1()
  -> advisory lock + expectedVersion + requestId
  -> regras/settings/evento em uma transação
```

O frontend nunca recebe chave administrativa. A função Next encaminha apenas
o access token autenticado para a Edge Function.

## Concorrência e idempotência

- o advisory lock serializa comandos do mesmo terapeuta;
- `expectedVersion` impede overwrite silencioso;
- versão obsoleta retorna `schedule_version_conflict`;
- o mesmo `requestId` retorna `idempotentReplay = true`;
- replay não incrementa versão e não duplica evento;
- cada regra exige uma terapia existente e não arquivada;
- regras gerais e específicas sobrepostas são rejeitadas;
- serviços de outro terapeuta são rejeitados.

A cobertura evita concorrência baseada em temporização de processos. O pgTAP
verifica a presença do lock e exercita o comportamento observável de uma
segunda gravação com versão obsoleta.

## Segurança e privacidade

- o read model deriva identidade de `(select auth.uid())`;
- Ana e Rafael leem somente seus settings e eventos;
- paciente não acessa read model nem tabelas A3;
- `authenticated` não executa o comando de escrita;
- somente `service_role` executa a RPC, atrás da Edge Function;
- terapeuta suspenso não lê nem altera horários;
- eventos não contêm tokens, conteúdo clínico ou payloads externos;
- o read model não expõe ator nem identificador de idempotência.

## Matriz de testes

| Camada         | Evidência                                                                              |
| -------------- | -------------------------------------------------------------------------------------- |
| Vitest         | view model, parsers, UI, vazio versus erro, validação local, sucesso, conflito e cópia |
| Deno           | payload da Edge, limites, duplicidade e mapeamento sanitizado de erros                 |
| pgTAP          | 33 invariantes A3; grants, RLS, versão, lock, replay, auditoria e bloqueios            |
| Playwright     | login, leitura, salvamento reversível, isolamento, desktop, tablet e mobile            |
| Supabase reset | migrations e seed aplicados do zero                                                    |
| DB lint        | schema público sem erros                                                               |

Comandos de fechamento:

```text
npx supabase db reset
npx supabase db lint --schema public
npx supabase test db
npm run test:deno
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright test tests/e2e/therapist-agenda-sessions.spec.ts --project=chromium
```

## Limites preservados

- A3 configura disponibilidade; não confirma slot reservável.
- A5 continua responsável por compor regras, exceções, bookings, holds,
  buffers, timezone e fronteiras `[start, end)`.
- A4 implementará bloqueios, recorrência, impacto e resolução.
- Reagendamento automático continua ausente até existir workflow próprio.
- A projeção de timezone em `therapist_profiles.metadata` permanece dívida de
  compatibilidade monitorada.

## Prontidão para A4

A4 pode reutilizar:

- timezone e versão otimista da agenda;
- `availability_exceptions` como base de investigação, sem assumir que o
  contrato atual já cobre recorrência;
- identidade e status validados pela Edge Function;
- padrão de read model versionado;
- padrão de comando com advisory lock, request ID e evento sanitizado;
- estados de erro e conflito da interface de Agenda.

A4 não deve inserir bloqueios diretamente pelo cliente nem duplicar as regras
de conflito que pertencem ao banco e ao futuro motor A5.
