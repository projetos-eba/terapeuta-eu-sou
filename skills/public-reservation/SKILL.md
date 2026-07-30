# Skill Local — Reserva Pública

## Escopo

Use esta skill ao implementar ou refatorar `/reserva` e `/reserva/sucesso`.

## Fontes obrigatórias

- `AGENTS.md`
- Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13273:3114`
- `docs/product/sitemap.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/design-system/design-system.md`
- `docs/product/glossary.md`
- `src/lib/routes.ts`
- `src/features/public-reservation`
- `src/features/therapist-profile/queries/public-profile.ts`
- `src/features/booking/services/public-booking.ts`
- Supabase Functions `session-booking-checkout` e `stripe-create-session-payment`

## Rotas

- Canônica: `routes.public.reservation` -> `/reserva`
- Sucesso: `routes.public.reservationSuccess` -> `/reserva/sucesso`
- Login cliente: `routes.public.clientSignIn`
- Cadastro cliente: `routes.public.clientSignUp`
- Pós-reserva do cliente: `routes.patient.home`

## Contrato de URL

`/reserva` deve aceitar e preservar:

- `service`: UUID do serviço do terapeuta.
- `slot`: instante ISO do horário escolhido.
- `duration`: duração em minutos para resumo visual.
- `price`: preço em centavos para resumo visual.
- `therapist`: slug público do terapeuta.
- `therapy`: slug da terapia.
- `source`: origem, como `match` ou `therapy`.
- `etapa`: `momento`, `preparar` ou `pagamento`.
- `date`: data de referência da janela de agenda quando a pessoa navega pelas
  setas sem selecionar um slot.

Preço, duração e terapeuta na URL são snapshot visual. A reserva real deve ser
revalidada no servidor antes do checkout.

## Backend

- `/api/public/reservation/checkout` lê o cookie HTTP-only
  `tes_patient_access_token`.
- `/api/auth/client/session` expõe somente resumo seguro do próprio paciente
  autenticado para header público, reserva e logout.
- `/reserva` deve hidratar terapeuta, serviço e disponibilidade a partir das
  mesmas views públicas usadas em `/terapeutas/:slug`. Não criar grade local de
  horários.
- A API chama `session-booking-checkout` com `serviceId`, `startsAt`,
  `requestId` e `holdTtlSeconds`.
- `session-booking-checkout` revalida slot, cria hold/booking, consome hold e
  chama `stripe-create-session-payment`.
- Redirecionamento de sucesso nunca confirma pagamento. Apenas webhook Stripe
  atualiza pagamento/booking de forma definitiva.
- Não coletar número de cartão, CVC ou dados bancários no Next.

## Componentes esperados

- `ReservationPage`
- `ReservationStepper`
- `ReservationSummary`
- `AuthStep`
- `PrepareForm`
- `CheckoutButton`
- `PolicyCard`
- `ReservationSuccessPage`

## Copy responsável

- Paciente vê “encontro” como termo primário.
- “Sessão” pode aparecer somente em contexto legal/financeiro quando
  necessário.
- Não prometer cura, diagnóstico, resultado, satisfação garantida ou reembolso
  fora de política formal.
- Deixar claro que o TES é online-only.

## QA

- `/reserva` sem query deve renderizar sem quebrar e orientar escolha de horário.
- `/reserva?service=<uuid>&slot=<iso>&duration=50&price=17000&therapist=ana-oliveira`
  deve mostrar resumo completo.
- A agenda mostra uma janela de 5 dias. Quando o horário selecionado está ao
  menos 2 dias à frente de hoje, a janela pode mostrar 2 dias anteriores e 2
  seguintes; datas anteriores a hoje nunca devem aparecer como reserváveis.
- Setas de navegação avançam/retrocedem 2 dias via `date`, bloqueando o
  retrocesso que cairia antes da data atual e sem gerar slot artificial.
- A etapa "Preparar meu encontro" exige horário ainda disponível e conta de
  cliente autenticada; o checkout real exige `service` + `slot` e revalida no
  servidor.
- Visitante deve ver opções de login/cadastro de cliente com `next`.
- Cliente autenticado deve ver dados de conta no fluxo e no pagamento, sem
  campos editáveis nesta etapa.
- Cliente autenticado deve conseguir chamar `/api/public/reservation/checkout`.
- Slot inexistente/indisponível deve retornar erro seguro.
- Sem Supabase configurado, submit deve retornar erro controlado sem expor
  segredo.
- Mobile deve empilhar formulário e resumo sem sobreposição.
- `npm run typecheck`, `npm run lint`, `npm run build`.

## Pendências conhecidas

- Homologação real do checkout exige Supabase local/remoto e Stripe test mode
  configurados.
- A tela depende das views públicas de perfil/serviço para refletir a agenda do
  terapeuta; se essas views estiverem indisponíveis, a agenda aparece vazia em
  vez de usar dados demonstrativos silenciosos.
- Dados opcionais de preparo do encontro ainda não são persistidos no booking.
- Cupom visual depende de política futura de descontos.
