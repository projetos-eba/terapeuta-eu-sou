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
- `docs/payments/promotion-codes.md`
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
  horários. Quando houver `slot` na URL, deve consultar e revalidar o dia local
  específico pelo contrato autoritativo, inclusive para datas entre 31 e 90 dias.
- O slot é um instante UTC. Resumo, dia de referência e faixa de horário devem
  ser formatados explicitamente no timezone retornado por
  `get_service_available_slots_v1`; o timezone do servidor nunca é autoridade
  de apresentação.
- A API chama `session-booking-checkout` com `serviceId`, `startsAt`,
  `requestId`, `termsAccepted` e `holdTtlSeconds`. Sem aceite obrigatório, o
  endpoint deve falhar antes de criar hold, booking ou pagamento.
- `session-booking-checkout` revalida slot, cria hold/booking, consome hold e
  chama `stripe-create-session-payment`.
- A experiência de pagamento usa Stripe Embedded Checkout. O backend retorna
  apenas o `clientSecret` da Checkout Session incorporada; dados de cartão ficam
  nos componentes oficiais da Stripe.
- O campo de código promocional fica no `ReservationSummary`, fora do iframe.
  Aplicar/remover chama a rota com `action=replace`, cria uma nova tentativa,
  destrói o checkout anterior e remonta o iframe sem recarregar a página.
- O navegador nunca envia Promotion Code ID, Coupon ID ou totais como
  autoridade. A Edge Function resolve o código na Stripe e exige
  `tes_checkout_scope=session`.
- Redirecionamento de sucesso nunca confirma pagamento. Apenas webhook Stripe
  atualiza pagamento/booking de forma definitiva.
- Não coletar número de cartão, CVC ou dados bancários no Next.

## Componentes esperados

- `ReservationPage`
- `ReservationStepper`
- `ReservationSummary`
- `AuthStep`
- `PrepareForm`
- `CheckoutButton`/container de Embedded Checkout
- `PromotionCodeField` de domínio compartilhado em `src/features/payments`
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
- Cada coluna de dia deve exibir no máximo 11 horários de uma vez; quando
  houver mais opções, a lista usa rolagem interna sem aumentar indefinidamente
  a altura da página.
- Setas de navegação avançam/retrocedem 2 dias via `date`, bloqueando o
  retrocesso que cairia antes da data atual e sem gerar slot artificial.
- A etapa "Preparar meu encontro" exige conta de cliente autenticada, slot e
  aceite explícito dos Termos de Uso/Política de Privacidade. Todos os CTAs
  devem compartilhar a mesma fonte de verdade do aceite.
- Acesso direto a `etapa=pagamento` sem aceite deve voltar para preparação sem
  criar checkout.
- O checkout real exige `service` + `slot` + `termsAccepted` e revalida serviço,
  preço, duração e slot no servidor.
- O texto opcional compartilhado no preparo é controlado pelo fluxo, enviado
  no checkout como `sharedNote` e salvo em `booking_intake_responses` para ser
  exibido sem alteração no detalhe autenticado do encontro.
- Visitante deve ver opções de login/cadastro de cliente com `next`.
- O botão `Voltar para agenda e horários` no fluxo da reserva retorna ao perfil
  público do terapeuta em `/terapeutas/[slug]`; sem slug, retorna à listagem
  pública de terapeutas.
- Cliente autenticado deve ver dados de conta no fluxo e no pagamento, sem
  campos editáveis nesta etapa.
- Cliente autenticado deve conseguir chamar `/api/public/reservation/checkout`
  somente com `termsAccepted: true`.
- Slot inexistente/indisponível deve retornar erro seguro.
- Cupom percentual/fixo válido deve exibir subtotal, desconto e total da
  resposta Stripe; total zero por desconto autorizado deve concluir pelo
  webhook assinado, enquanto outro escopo, código inválido, desconto acima do
  subtotal e concorrência devem falhar fechado sem desmontar definitivamente a
  tentativa válida.
- O iframe não deve mostrar o campo nativo “Add code” e todo o checkout deve
  usar `pt-BR`.
- Evento expirado/falhado de tentativa superseded não pode cancelar a reserva;
  um pagamento real anterior ainda deve ser aceito uma única vez.
- Um slot `2026-08-24T12:10:00.000Z` no timezone `America/Sao_Paulo` deve ser
  exibido como `09:10`, inclusive no resumo antes do checkout.
- Sem Supabase configurado, submit deve retornar erro controlado sem expor
  segredo.
- Mobile deve empilhar formulário e resumo sem sobreposição.
- `npm run typecheck`, `npm run lint`, `npm run build`.

## Copy Safety

- Payment and reservation feedback must use human TES language; never expose
  backend, webhook or other implementation terms to the visitor or patient.

## Pendências conhecidas

- Homologação real do checkout exige Supabase local/remoto e Stripe test mode
  configurados.
- A tela depende das views públicas de perfil/serviço para refletir a agenda do
  terapeuta; se essas views estiverem indisponíveis, a agenda aparece vazia em
  vez de usar dados demonstrativos silenciosos.
- Homologar externamente campanhas e corridas de substituição em Stripe test
  mode antes de produção; consulte `skills/stripe-promotions`.
