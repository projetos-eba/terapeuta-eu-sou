# Fechamento do marco A4 - Bloqueios

Data: 2026-07-27

Status: concluído.

## Escopo entregue

- bloqueio de dia inteiro ou faixa parcial;
- escopo geral ou por terapia;
- recorrência diária e semanal;
- conversão timezone-safe para instantes UTC;
- pesquisa e filtros refletidos na URL;
- identificação de bookings impactados;
- resolução explícita `keep_booking`;
- remoção lógica de ocorrência ou série;
- auditoria, idempotência e versão otimista;
- interface responsiva com loading, erro e vazio.

## Fontes canônicas

| Conceito               | Fonte                                    |
| ---------------------- | ---------------------------------------- |
| Intervalo bloqueado    | `availability_exceptions`                |
| Definição recorrente   | `availability_exception_series`          |
| Impacto em booking     | `availability_exception_booking_impacts` |
| Auditoria/idempotência | `availability_exception_events`          |
| Timezone e versão      | `therapist_schedule_settings`            |
| Reserva existente      | `bookings`                               |
| Leitura                | `get_therapist_blocks_v1()`              |
| Escrita                | Edge `therapist-blocks-update`           |

O comando versionado `create_therapist_block_v2` preserva o comando A4
existente e acrescenta, de forma atômica, o conjunto de sessões confirmadas
com pagamento `paid` afetadas pelo bloqueio. A resposta contém somente os
dados operacionais necessários para o alerta da interface: pessoa, terapia,
data, horário e fuso.

## Fluxo

```text
/terapeuta/agenda?aba=bloqueios
  -> requireTherapistSession
  -> get_therapist_blocks_v1() com auth.uid()
  -> parser TypeScript v1
  -> formulário/filtros/lista responsivos
  -> POST /api/therapist/blocks
  -> Edge therapist-blocks-update
  -> valida token, papel, status e payload
  -> RPC service_role only
  -> advisory lock + versão + requestId
  -> série + ocorrências UTC + impactos + evento
```

## Invariantes

- um bloqueio não altera o status, o pagamento ou o horário de um booking;
- recorrências são limitadas a um ano e no máximo 90 ocorrências;
- instantes persistidos são UTC e o timezone IANA permanece no registro;
- intervalos seguem a semântica semiaberta `[start, end)`;
- remoção preserva histórico;
- replay não duplica série, ocorrência, impacto, evento ou notificação;
- apenas o terapeuta responsável lê seus bloqueios e impactos;
- paciente não executa o read model;
- terapeuta suspenso ou rejeitado não executa comandos.

## Interface

A tela mantém o frame de Agenda e os tokens TES:

- título, tabs e hierarquia tipográfica do módulo;
- indicadores de bloqueios, recorrência e impacto;
- busca, motivo e situação;
- cards com data, faixa, escopo, recorrência e estado textual;
- painel explícito de sessões impactadas;
- modal de criação e confirmação de remoção;
- controles com foco visível e área de toque mínima;
- layout em uma coluna no mobile.

O node de referência é `13366:8393`. A inspeção semântica pelo Figma MCP ficou
indisponível nesta sessão. A fidelidade visual foi baseada no frame compartilhado
de Agenda/Horários e nos tokens locais, e deve receber uma comparação pixel a
pixel quando o conector estiver disponível.

## Testes

| Camada     | Cobertura                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Vitest     | parsers, contrato, criação, remoção de série e resolução de impacto                                               |
| Deno       | ações, ranges, all-day e erros sanitizados da Edge                                                                |
| pgTAP      | Invariantes de schema, grants, RLS, timezone, impacto, booking preservado, versão, replay, remoção, suspensão e filtro de conflitos pagos |
| Playwright | login, dados reais, criação/remover reversível e screenshots desktop/tablet/mobile                                |

## Pendências para produção

- comparação visual direta com o frame Figma quando o MCP estiver disponível;
- A5 deve incluir somente exceções `active` e `is_available = false`;
- cancelamento/reagendamento de sessão impactada continua nos workflows próprios;
- edição de série pode ser adicionada após definição de produto;
- envio externo de comunicação só deve ocorrer quando o booking efetivamente mudar.
