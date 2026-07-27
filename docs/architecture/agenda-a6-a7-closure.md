# Fechamento A6/A7 - Checkout de reserva e refinamento do Calendario

Data: 2026-07-27

Status: implementado localmente.

## Escopo A6

A6 cria a orquestracao autenticada entre disponibilidade publica, hold
transacional, booking e Checkout Stripe sem criar uma nova autoridade
financeira.

Edge Function:

- `session-booking-checkout`.

Entrada:

- `serviceId`;
- `startsAt`;
- `requestId`;
- `holdTtlSeconds` opcional, entre 60 e 900 segundos.

Fluxo:

1. autentica a pessoa paciente pelo bearer token;
2. consulta `get_service_available_slots_v1`;
3. seleciona o slot exato por `startsAt`;
4. usa o timezone e `endsAt` retornados pelo banco;
5. chama `reserve_booking_hold_v1` com idempotencia;
6. chama `consume_booking_hold_v1` com a mesma idempotencia;
7. inicia `stripe-create-session-payment` com o bearer original da pessoa
   paciente.

`session-booking-checkout` nao chama a Stripe API diretamente, nao calcula
comissao, nao grava `session_payments` e nao confirma pagamento. A funcao
financeira existente continua criando a Checkout Session com snapshot do
booking, e a confirmacao de pagamento continua exclusivamente no webhook
Stripe.

## Autoridades preservadas

| Informacao               | Autoridade preservada                               |
| ------------------------ | --------------------------------------------------- |
| Slot reservavel          | `get_service_available_slots_v1` + trigger do hold  |
| Reserva temporaria       | `booking_holds` e `reserve_booking_hold_v1`         |
| Booking                  | `bookings` e `consume_booking_hold_v1`              |
| Preco/duracao de reserva | snapshots A2 em hold/booking                        |
| Pagamento                | `session_payments.financial_status`                 |
| Checkout Stripe          | `stripe-create-session-payment`                     |
| Confirmacao de pagamento | `stripe-billing-webhook`                            |
| Sessao logica Zoom       | criacao posterior a `financial_status = paid`       |
| Repasses                 | ledger, elegibilidade, lotes e transfers do Gate F0 |

## Idempotencia e retomada

`requestId` deve ser um UUID estavel por tentativa de reserva. Repetir a mesma
chamada com os mesmos dados reutiliza o hold/booking ja consumido e o Checkout
idempotente da funcao financeira. Reutilizar a chave com dados diferentes e
tratado como conflito.

Se a chamada de Checkout falhar depois de o booking ser criado, o cliente pode
repetir a mesma requisicao. O banco devolve o mesmo booking e a funcao
financeira tenta iniciar ou recuperar o pagamento correspondente.

## Escopo A7

A7 fecha as pendencias funcionais do Calendario em `/terapeuta/agenda`:

- filtros por busca, terapia e estado;
- contador acessivel de resultados filtrados;
- lista cronologica mobile dedicada para encontros, holds e bloqueios;
- preservacao do `TESDialog` para detalhe do encontro;
- mensagens vazias explicitas quando filtros removem todos os itens;
- foco visivel e controles com areas de toque de pelo menos 44px.

O estado navegavel de data e visualizacao permanece na URL:

- `aba=calendario`;
- `visao=day|week|month`;
- `data=YYYY-MM-DD`.

Os filtros A7 sao estado local da tela neste marco. Eles nao alteram o contrato
de leitura `get_therapist_calendar_v1`.

## Privacidade

O endpoint publico de slots continua nao expondo participantes, holds,
bookings, motivos de indisponibilidade ou dados clinicos. A funcao A6 usa
`service_role` somente dentro da Edge Function autenticada para executar RPCs
restritas. O navegador nao recebe service role, secrets Stripe, JWT Zoom,
URL de host, dados bancarios ou payload financeiro interno.

## Validacao

Testes adicionados:

- `supabase/functions/session-booking-checkout/booking-checkout-command.test.ts`;
- cobertura React dos filtros e da lista cronologica em
  `therapist-calendar.test.tsx`.

Comandos esperados:

- `npm run test:deno`;
- `npm run test`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- `npx supabase db reset`;
- `npx supabase db lint --schema public`;
- `npx supabase test db`.

## Pendencias

- Integrar a rota publica `/reserva` ao novo contrato
  `session-booking-checkout`; a rota ainda nao esta implementada nesta arvore.
- Homologar A6 ponta a ponta com Stripe test mode, Supabase Functions locais e
  webhook real/Stripe CLI.
- Revalidar com leitor de tela real antes de producao, pois a verificacao local
  automatizada cobre semantica e foco, mas nao substitui uso assistivo real.
