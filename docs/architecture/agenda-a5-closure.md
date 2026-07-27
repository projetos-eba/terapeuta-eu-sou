# Fechamento A5 - Slots autoritativos e Calendario

Data: 2026-07-27

Status: implementado e validado localmente.

## Escopo

A5 consolida a disponibilidade reservavel no Postgres e entrega a primeira
interface funcional do Calendario da Agenda. O frame de referencia e
`13366:5342` do arquivo Figma `Projeto Terapeuta Eu Sou Atualizado`.

O marco nao implementa o checkout A6 nem altera as autoridades de booking,
pagamento, realizacao, presenca, cancelamento ou reagendamento.

## Fontes canonicas

| Informacao                                  | Autoridade                             |
| ------------------------------------------- | -------------------------------------- |
| Timezone de negocio                         | `therapist_schedule_settings.timezone` |
| Faixas semanais                             | `availability_rules`                   |
| Excecoes e bloqueios                        | `availability_exceptions`              |
| Duracao e terapia                           | `therapist_services` e `therapies`     |
| Cadencia, buffers, antecedencia e horizonte | `therapist_service_booking_settings`   |
| Reserva operacional                         | `bookings`                             |
| Reserva temporaria                          | `booking_holds`                        |
| Pagamento                                   | `session_payments.financial_status`    |
| Cor de calendario                           | `therapies.calendar_color_key`         |

`bookings.payment_status` permanece somente como projecao de compatibilidade.

## Fluxo de dados

```text
terapeuta + servico
  -> timezone e configuracao A3
  -> regras semanais
  -> excecoes positivas
  -> subtracao de bloqueios A4
  -> duracao + cadencia + buffers
  -> antecedencia + horizonte
  -> validacao de round-trip DST
  -> subtracao de bookings ativos
  -> subtracao de holds ativos
  -> slots publicos seguros
```

O endpoint publico `get_service_available_slots_v1` recebe somente o servico e
o intervalo desejado. Ele nao retorna paciente, terapeuta, motivo de bloqueio,
hold, pagamento ou qualquer dado clinico.

Ao criar um hold, o trigger `validate_booking_hold_schedule_v1` repete a
validacao autoritativa no banco. Conflitos A2 continuam retornando seus codigos
especificos antes de um erro generico de slot.

## Contratos

### `get_service_available_slots_v1`

- contrato versionado;
- intervalo semiaberto `[start, end)`;
- timezone explicito;
- cor canonica da terapia;
- slots ja filtrados por booking e hold;
- leitura permitida para `anon`, `authenticated` e `service_role`;
- sem identificadores ou detalhes de participantes.

### `get_therapist_calendar_v1`

- identidade derivada de `auth.uid()`;
- acesso apenas para terapeuta ativo e dono dos dados;
- visoes `day`, `week` e `month`;
- bookings compostos pelo read model de Sessoes;
- pagamento derivado de `session_payments`;
- holds, bloqueios, atencoes e demanda agregada;
- cores obtidas da terapia, nunca gravadas como classe CSS;
- sem credenciais Zoom, payload de host ou dados privados do Match.

## Interface

A rota canonica continua `/terapeuta/agenda`, com:

- `aba=calendario`;
- `visao=day|week|month`;
- `data=YYYY-MM-DD`.

A data e a visualizacao ficam na URL. Horarios e Bloqueios continuam nas abas
existentes e compartilham os mesmos registros. Encontros abrem um `TESDialog`
e seguem para `/terapeuta/sessoes/[bookingId]`.

Desktop usa calendario e trilho contextual. Tablet move o trilho para baixo.
Mobile preserva navegacao por scroll horizontal, areas de toque e drawer do
shell. O layout final de A7 foi parcialmente antecipado; filtros avancados e
uma lista cronologica mobile dedicada permanecem para o refinamento A7.

## Cores

`therapies.calendar_color_key` aceita somente:

- `purple`;
- `green`;
- `orange`;
- `blue`;
- `pink`;
- `neutral`.

O banco persiste a chave semantica. O frontend e responsavel pelo mapeamento
para tokens e classes, permitindo evolucao visual sem gravar CSS no schema.

## Seguranca e concorrencia

- funcoes internas do slot engine nao sao executaveis pelo browser;
- o calendario privado deriva o terapeuta da sessao;
- terapeuta suspenso e paciente nao executam o calendario;
- o endpoint publico nao revela a causa da indisponibilidade;
- holds e bookings continuam protegidos por advisory lock e exclusao GiST;
- A5 nao recria logica financeira, Stripe ou Zoom;
- o Next.js usa somente token autenticado e chave publicavel.

## Testes

`supabase/tests/008_agenda_a5_slot_engine.sql` cobre:

- schema e constraint de cores;
- grants publicos e privados;
- contrato e privacidade do endpoint;
- duracao, bloqueios, bookings e holds;
- rejeicao de hold fora da agenda;
- idempotencia e conflito;
- identidade, RLS e terapeuta suspenso;
- visoes e range do calendario.

Vitest cobre parser e estados principais do componente. Playwright cobre dados
reais, dialogo, detalhe da sessao, navegacao entre abas, dia/semana/mes e
responsividade.

## Pendencias

- A6 deve orquestrar slot, hold, booking e checkout Stripe em Edge Function
  autenticada.
- A7 deve concluir filtros, lista mobile dedicada e refinamento de
  acessibilidade com leitores de tela.
- A disponibilidade publica atual ainda precisa migrar consumidores legados do
  preview TypeScript para `get_service_available_slots_v1`.
- Homologacao de DST em timezones adicionais e carga com grandes agendas deve
  ocorrer antes de producao.
