# ADR-022 — Presença, ausência e responsabilização financeira da sessão

Data: 2026-09-16  
Status: aceita em código; ativação financeira futura condicionada à revisão jurídica e à homologação Stripe.

## Contexto

O estado da reserva, isoladamente, não prova que uma sessão ocorreu. O TES já
possuía eventos confiáveis do Zoom, confirmação bilateral e regras financeiras
V9/V10, mas não consolidava de forma única a chegada à sala de espera, o join
confiável, a tolerância de dez minutos e a responsabilidade por uma sessão não
realizada. Isso permitia que uma sessão passada continuasse visualmente
“Confirmada” e não distinguia falta do cliente, falta do terapeuta e falta de
ambos.

## Decisão

- A evidência é consolidada por booking e versão. “Presente em T+10” significa
  chegada autenticada à sala de espera ou `session.user_joined` confiável até o
  fim da tolerância.
- Depois de T+10: terapeuta presente/cliente ausente gera `no_show_patient`;
  cliente presente/terapeuta ausente gera `no_show_therapist`; ambos ausentes
  gera `no_show_both`. Se ambos chegaram, mas os joins bilaterais não se
  confirmarem até o fim, o caso fica `requires_review`.
- `no_show_therapist`, `no_show_both` e `requires_review` abrem incidente
  administrativo, bloqueiam elegibilidade financeira e nunca chamam a Stripe
  automaticamente. O Admin decide com justificativa e chave idempotente.
- Reagendamento preserva o mesmo pagamento e não cria Charge ou Transfer. O
  paciente escolhe depois um horário autoritativo do mesmo terapeuta.
- Reembolso V10 reutiliza o comando integral existente: tenta Transfer Reversal
  antes do Refund, mas o Refund integral não depende do sucesso do Reversal. A
  diferença não recuperada vira dívida compensável em Transfers futuros.
- Quando o Admin atribui a falha ao TES, o reembolso integral não tenta
  Transfer Reversal, não reduz o repasse do terapeuta e não cria dívida: o
  custo permanece integralmente com a plataforma.
- Na falta exclusiva do paciente, o encerramento técnico da sala é confirmado
  antes da transição final. A presença autenticada do terapeuta confirma a
  prestação para o gate semanal V9 sem transformar a reserva em “concluída”;
  ela permanece identificada como `no_show_patient`.
- Taxa Stripe não é multa. Seu eventual ressarcimento exige valor real
  reconciliado, responsabilidade confirmada do terapeuta, reembolso concluído e
  snapshot de uma política futura juridicamente aprovada.
- A política `tes-payments-v11-attendance-accountability` nasce inativa. Ela
  não se aplica retroativamente e é a única que poderá autorizar retenção em
  ausência dupla ou ressarcimento do custo de processamento.
- Reincidência conta somente incidentes cuja responsabilidade do terapeuta foi
  confirmada pelo Admin. O sistema sugere revisão humana; não suspende
  automaticamente.

## Consequências

- Paciente, terapeuta e Admin recebem estados explícitos de sessão não
  realizada e de pagamento em análise.
- Chegada e join permanecem evidências distintas. Token, preflight, mídia local
  ou ausência temporária não contam como presença confiável.
- Reservas V9 continuam sob o mecanismo semanal e exigem a conciliação própria
  de seus Transfers. Reservas V10 usam o fluxo de Transfer direto. Histórico de
  Payout nunca é reescrito.
- A retenção por ausência dupla exige, além do gate jurídico, um gate
  operacional específico para recuperação do repasse sem reembolso. A dívida
  de taxa fica bloqueada até publicação jurídica, aceite imutável e homologação
  externa.

## Validação obrigatória antes de produção

- `npx supabase db reset`, pgTAP e lint do banco em Docker local;
- concorrência entre classificação, decisão Admin, Transfer, Payout, Reversal,
  Refund e compensação;
- Stripe Test Mode com Reversal total, saldo insuficiente e recuperação tardia;
- QA visual nas três áreas e prova de que nenhuma taxa foi estimada ou aplicada
  a snapshots antigos.
