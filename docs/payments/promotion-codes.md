# Códigos promocionais Stripe no TES

Atualizado em 2026-08-26.

## Autoridade e arquitetura

O benefício financeiro é um **Coupon** da Stripe. O texto digitado pela pessoa
é um **Promotion Code** que aponta para esse Coupon. O TES não mantém catálogo,
tabela, seed ou lista hardcoded de códigos: a Edge Function consulta a Stripe,
valida o contexto TES e passa `discounts: [{ promotion_code }]` ao criar uma
nova Checkout Session.

Os dois fluxos continuam em Stripe Embedded Checkout e usam `locale: pt-BR`:

- sessão: `/reserva` -> `/api/public/reservation/checkout` ->
  `stripe-create-session-payment`;
- assinatura: `/terapeuta/checkout` ->
  `/api/therapist/subscription-checkout` ->
  `stripe-create-subscription-checkout`;
- contingência da assinatura: Checkout hospedado criado pela mesma Edge
  Function, com o mesmo Promotion Code já aplicado.

Aplicar, remover ou trocar o código cria outra Checkout Session. O iframe
anterior é destruído e remontado com o novo `clientSecret`. O navegador envia
apenas o código, a tentativa e a sessão a substituir; IDs de Promotion Code,
Coupon, totais e valores nunca são aceitos como autoridade do navegador.

## Metadata TES obrigatória

Defina no **Promotion Code**, não apenas no Coupon:

- sessão: `tes_checkout_scope=session`;
- assinatura: `tes_checkout_scope=subscription`.

O TES falha fechado quando a metadata está ausente ou divergente. Em
assinaturas, o Coupon também precisa ter `applies_to.products` explícito com o
Product Stripe de Premium, Premium Plus ou ambos. Em sessões, o preço/produto é
dinâmico; por isso o isolamento depende da metadata do Promotion Code.

Um código novo corretamente configurado passa a funcionar assim que estiver
ativo na Stripe, sem deploy, migration ou insert no TES.

## Configuração no Stripe Dashboard

Sempre selecione primeiro **Test mode**. Os nomes de menu podem variar conforme
a versão do Dashboard:

1. Em Product catalog/Coupons, crie o Coupon com percentual ou valor fixo em
   BRL, duração e limites globais.
2. Para assinatura, limite o Coupon aos Products corretos em
   `applies_to.products`. Não deixe a lista vazia.
3. Crie um Promotion Code para o Coupon e defina código público, atividade,
   expiração, máximo de resgates, cliente, primeira compra e valor mínimo
   quando aplicável.
4. Salve o Promotion Code e abra a página de detalhes dele. No bloco **Metadata**
   (não no campo **Code** desta janela), clique em **Add metadata** e adicione
   `tes_checkout_scope` = `session` para sessões, ou
   `tes_checkout_scope` = `subscription` para assinaturas. O valor deve ser
   exatamente um dos dois; não coloque os dois valores no mesmo Promotion Code.
   Se a versão do Dashboard não exibir a edição de metadata, atualize o objeto
   salvo pela Stripe CLI/API em **Test mode**, usando o ID exibido nos detalhes:
   `stripe promotion_codes update promo_xxx -d
"metadata[tes_checkout_scope]=session"` (ou `subscription`).
5. Valide a campanha em Test mode, com navegador visível e webhook assinado,
   antes de repetir a configuração em Live mode.

Não reutilize o mesmo Promotion Code entre sessão e assinatura. Um Coupon pode
originar códigos distintos, mas cada Promotion Code TES possui um único escopo.

## Modelos de campanha

### Sessões

- percentual: Coupon `percent_off`, `duration=once`;
- valor fixo: Coupon `amount_off` com `currency=brl`, `duration=once`;
- uso único: `max_redemptions=1` no Promotion Code, ou restrição equivalente
  por cliente quando a campanha exigir;
- expiração, primeira compra, valor mínimo e limite de resgates são definidos
  na Stripe e revalidados ao criar o Checkout;
- total zero é permitido quando a Stripe confirma um desconto de 100% ou um
  valor fixo igual ao subtotal. A Checkout Session permanece a autoridade e o
  webhook `checkout.session.completed` confirma a reserva; não existe cobrança,
  comissão ou repasse sobre valor zero. Um desconto que exceda o subtotal é
  recusado para evitar total negativo.

### Premium, Premium Plus ou ambos

- percentual ou valor fixo em BRL;
- duração `once`, `repeating` ou `forever` conforme a campanha;
- Premium: `applies_to.products=[Product Premium]`;
- Premium Plus: `applies_to.products=[Product Premium Plus]`;
- ambos: inclua os dois Products no mesmo Coupon;
- o Promotion Code sempre usa `tes_checkout_scope=subscription`.

Para “3 meses grátis”, configure `percent_off=100`, `duration=repeating` e
`duration_in_months=3`. Isso é desconto de 100% nas três primeiras cobranças,
não um estado `trialing`. Trial verdadeiro exige estratégia separada com regras
de elegibilidade, encerramento e cobrança; está fora desta entrega.

Na homologação, confirme que o Checkout coleta e mantém uma forma de pagamento
apta para a primeira cobrança após o período integralmente descontado.

## Datas e ativação

- fim do Coupon: `redeem_by`;
- fim do Promotion Code: `expires_at`;
- início futuro: Promotion Code não possui `starts_at` nativo.

Para início futuro, crie o Promotion Code inativo e ative-o manualmente no
Dashboard na data planejada. Após a ativação, o TES o aceita imediatamente. Não
há scheduler TES nesta fase.

## Campanha de lançamento — TERAPEUTAFUNDADOR

Esta campanha usa o Product canônico do Premium Plus. Não existe Product
paralelo de fundador. Test Mode permanece ativo para homologação; Live Mode é
provisionado inativo e não recebe transações ou eventos de teste.

- código público exato: `TERAPEUTAFUNDADOR`;
- oferta: Premium Plus mensal;
- período para novos resgates: de 01/09/2026 00:00 até 10/09/2026 23:59:59,
  no horário de Brasília;
- expiração técnica: 11/09/2026 00:00 em Brasília;
- restrição: primeira transação do Customer;
- benefício: Coupon de 100%, `duration=repeating` e
  `duration_in_months=3`;
- forma de pagamento: obrigatoriamente coletada no Checkout, mesmo com total
  inicial igual a zero;
- após as três cobranças integralmente descontadas: R$ 79,90 por mês no
  Premium Plus enquanto a assinatura permanecer ativa e sem mudança de plano.

O preço público normal do Premium Plus permanece R$ 129,90 por mês. Para a
campanha, o backend resolve `offer_key=therapist_founder` a partir da metadata
da Stripe e troca para um Price mensal oculto de R$ 79,90 antes de criar o
Checkout. O navegador nunca envia esse Price nem escolhe o valor promocional.
O Coupon é limitado ao mesmo Product Premium Plus, portanto o código não pode
ser aplicado ao Premium.

O bootstrap idempotente de Test Mode mantém o Promotion Code ativo para
homologação. O bootstrap Live cria o código inativo; a ativação é manual no
Dashboard em 01/09/2026 00:00 America/Sao_Paulo. A expiração nativa é
11/09/2026 00:00 no mesmo fuso.

```bash
npm run payments:bootstrap:test
npm run payments:verify:test
npm run payments:bootstrap:live
npm run payments:verify:live
```

O comando Live exige uma chave Live explícita, só cria/configura objetos e
executa leituras de confirmação. Ele não cria Customer, Checkout, assinatura,
fatura, pagamento nem evento de teste.

Ao trocar de plano, o próximo Price é sempre o Price público normal, sem
preservar o Price fundador. Depois do encerramento definitivo, uma
nova assinatura não recupera a oferta porque a Stripe aplica a restrição de
primeira transação. Cancelamento ao fim do período preserva apenas o período já
contratado; não cria direito futuro ao preço fundador após o encerramento.

## Tentativas, webhooks e reconciliação

`session_payment_attempts` registra cada Checkout de sessão. A troca usa
compare-and-swap em `session_payments.stripe_checkout_session_id`, marca a
tentativa anterior como `superseded` e expira o Checkout anterior. Se outra
troca vencer a corrida, a nova sessão Stripe é expirada e o frontend recebe um
conflito recuperável.

Eventos `expired`, `async_payment_failed`, `payment_intent.payment_failed` e
`payment_intent.canceled` de tentativas superseded não alteram o pagamento nem
cancelam a reserva atual. Um pagamento real confirmado por uma tentativa
anterior continua válido; depois do primeiro sucesso, as tentativas irmãs
abertas são expiradas.

O webhook usa `Checkout Session.amount_subtotal`,
`total_details.amount_discount` e `amount_total`. `session_payments`, comissão,
valor do terapeuta e ledger são reconciliados sobre o valor efetivamente
cobrado. Redirect do navegador nunca confirma sessão nem ativa plano.

## Desativação e rollback

Para interromper uma campanha, desative o Promotion Code no Dashboard. Não
delete código local nem altere banco. Checkouts já concluídos permanecem
auditáveis; checkouts abertos devem ser substituídos/remontados para refletir a
remoção. Se houver incidente, desative o código, suspenda novas divulgações e
revise tentativas, webhooks e totais antes de reativar.

## Diagnóstico seguro

- “inválido ou indisponível”: código inexistente, inativo, expirado, esgotado ou
  Coupon inválido;
- “não é válido para este pagamento”: metadata TES ausente/divergente;
- “não é válido para o plano”: Product não está em `applies_to.products`;
- “não pode ser usado nesta sessão”: duração incompatível ou desconto fixo maior
  que o subtotal;
- “pagamento foi atualizado”: tentativa concorrente ou Checkout anterior já
  deixou de estar aberto.

Mensagens da interface não exibem IDs Stripe, metadata, payloads, nomes de API
ou infraestrutura. Evidências e logs não devem conter secrets nem dados de
cartão.

## Checklist de homologação

- [ ] Test mode confirmado em toda a cadeia.
- [ ] Código percentual e fixo válido em sessão.
- [ ] Código de 100% e código fixo igual ao subtotal concluem uma sessão sem
      cobrança, com confirmação somente por webhook.
- [ ] Premium, Premium Plus e ambos respeitam Products explícitos.
- [ ] 100% repeating por três meses mantém forma de pagamento futura.
- [ ] `TERAPEUTAFUNDADOR` funciona somente no Premium Plus mensal, dentro da
      janela e em primeira transação.
- [ ] Após a terceira cobrança zerada, a assinatura gera R$ 79,90 por mês.
- [ ] Premium, mudança de plano e nova assinatura após encerramento não herdam
      o Price fundador.
- [ ] Inexistente, inativo, expirado, esgotado, outro escopo/produto, cliente,
      primeira compra e mínimo falham com copy sanitizada.
- [ ] Aplicar, remover, reaplicar, trocar código e trocar plano.
- [ ] Duplo clique e concorrência não deixam dois checkouts cobrando.
- [ ] Evento antigo expirado/falhado não cancela a tentativa atual.
- [ ] Pagamento real de tentativa anterior é aceito uma vez e expira irmãs.
- [ ] Subtotal, desconto, total, comissão, terapeuta e ledger convergem.
- [ ] Campo nativo Stripe não aparece; interface Stripe está em pt-BR.
- [ ] Desktop, tablet, mobile e fallback hospedado validados.
- [ ] Webhook duplicado e fora de ordem permanece idempotente.
- [ ] Logs/evidências não contêm secrets ou dados de cartão.

Comandos principais estão em `package.json` e em
`docs/payments/stripe-phase-3-homologation.md`.
