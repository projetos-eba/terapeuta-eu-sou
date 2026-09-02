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
- Para cliente autenticado, `/reserva` lê no servidor, com o bearer do próprio
  paciente e RLS, apenas `starts_at`/`ends_at` de bookings ativos e holds ativos
  não expirados. Slots que sobrepõem `[starts_at, ends_at)` são ocultados.
- Falha nessa leitura nunca confirma agenda livre: mostrar indisponibilidade
  honesta e manter o trigger/checkout como autoridade final.
- O slot é um instante UTC. Resumo, dia de referência e faixa de horário devem
  ser formatados explicitamente no timezone retornado por
  `get_service_available_slots_v1`; o timezone do servidor nunca é autoridade
  de apresentação.
- A API chama `session-booking-checkout` com `serviceId`, `startsAt`,
  `requestId`, `termsAccepted` e `holdTtlSeconds`. Sem aceite obrigatório, o
  endpoint deve falhar antes de criar hold, booking ou pagamento.
- `session-booking-checkout` revalida slot, cria hold/booking, consome hold e
  chama `stripe-create-session-payment`. Falha antes de persistir a Checkout
  deve compensar o booking consumido; a manutenção recupera o mesmo órfão após
  o prazo como segunda barreira.
- O hold inicial nasce somente ao montar `Confirme sua reserva`, dura 300
  segundos e usa `reservationExpiresAt`/`serverNow` retornados pelo backend. Não
  renderizar cronômetro em `momento` ou `preparar`, nem reiniciar o prazo por
  remount, refresh ou troca de cupom.
- A retomada usa apenas `/reserva?booking=<uuid>&etapa=pagamento`. O servidor
  autentica o paciente e hidrata serviço, preço, horário e terapeuta do snapshot
  persistido; parâmetros equivalentes enviados pelo navegador não são
  autoridade. `payment_retry` não cria hold nem contador enquanto o formulário
  Stripe está aberto.
- `PATIENT_SCHEDULE_CONFLICT` deve virar `patient_schedule_conflict` 409 na
  Edge e voltar como `PATIENT_SCHEDULE_CONFLICT` na API Next, com copy TES. A
  Stripe não pode ser iniciada após esse erro.
- A experiência de pagamento usa Stripe Embedded Checkout. O backend retorna
  apenas o `clientSecret` da Checkout Session incorporada; dados de cartão ficam
  nos componentes oficiais da Stripe.
- O campo de código promocional fica no `ReservationSummary`, fora do iframe.
  Aplicar/remover chama a rota com `action=replace`, cria uma nova tentativa,
  destrói o checkout anterior e remonta o iframe sem recarregar a página.
- Durante a substituição promocional, o navegador não pode iniciar abandono.
  `pagehide` e desmontagem React não são sinais suficientes de abandono porque
  também ocorrem durante refresh e transições internas. O hold inicial conserva
  o prazo absoluto e é liberado pelo contador aberto ou pela manutenção; uma
  `payment_retry` nunca dispara abandono de booking.
- A transição interna entre `preparar` e `pagamento`, inclusive pelo
  voltar/avançar do navegador, não é abandono. O aceite dos Termos e o
  `checkoutAttemptId` devem ser preservados somente no estado do histórico da
  aba, associado à combinação serviço/horário. Ao retornar ao pagamento, a
  mesma tentativa idempotente deve ser reutilizada. A Edge Function deve
  resolver primeiro o hold/booking da mesma tentativa, antes de consultar os
  slots disponíveis, pois a própria reserva pendente deixa o horário oculto.
  Nunca persistir nesse estado texto de preparo ou dados de pagamento.
- Na etapa de pagamento, `ShellHelpCard` aparece no resumo lateral antes da
  Política de cuidado. Seu CTA abre o formulário autenticado de novo chamado
  em `TESDialog` sobre a própria reserva, sem navegar ou recarregar o checkout.
  Após a criação, o protocolo persistido é confirmado e a pessoa retorna ao
  pagamento; não criar rota ou fonte de suporte paralela.
- O navegador nunca envia Promotion Code ID, Coupon ID ou totais como
  autoridade. A Edge Function resolve o código na Stripe e exige
  `tes_checkout_scope=session`.
- Redirecionamento de sucesso nunca confirma pagamento. Apenas webhook Stripe
  atualiza pagamento/booking de forma definitiva.
- `/reserva/sucesso` consulta o status autenticado por no máximo 30 segundos e
  só mostra confirmação quando `session_payments.financial_status=paid` e o
  booking está `confirmed`; expiração, conflito e falha têm estados honestos.
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
- Avançar de `preparar` para `pagamento` e voltar para `preparar` deve manter
  o aceite dos Termos e deixar o CTA de pagamento habilitado. Ao avançar outra
  vez, a requisição precisa reutilizar o mesmo `checkoutAttemptId`, sem envio
  de abandono ou criação de uma segunda reserva.
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
- No momento da reserva, o quadro verde de conta conectada ocupa toda a coluna
  de informações em telas grandes, quebra o e-mail com segurança e não exibe
  o status textual “Celular confirmado”.
- Cliente autenticado deve conseguir chamar `/api/public/reservation/checkout`
  somente com `termsAccepted: true`.
- Slot inexistente/indisponível deve retornar erro seguro.
- Slots que coincidem com encontros do paciente ficam ocultos e exibem a nota
  explicativa somente quando ao menos um slot foi removido. Um slot exatamente
  consecutivo permanece disponível.
- URL antiga em `preparar`/`pagamento` com conflito do paciente volta para
  `momento`, mostra “Você já tem outro encontro nesse horário. Escolha outro
  momento.” e mantém o CTA bloqueado.
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
- Aplicar/remover cupom não pode enviar abandono; uma solicitação atrasada de
  Checkout anterior não pode cancelar a tentativa atual.
- A etapa de pagamento não exibe CTA para `#stripe-checkout`, pois o Checkout
  já está visível nessa mesma etapa.
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
- A exclusão GiST redundante por paciente fica para janela posterior após
  auditoria de volume/lock; o hotfix usa advisory lock namespaced e trigger.
- O Figma `13273:3114` exigiu reautenticação durante o hotfix de 2026-08-28.
  Detalhe visual adicional: `Não identificado nos arquivos analisados.`
