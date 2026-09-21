# ADR-022 — Presença, ausência e responsabilização financeira da sessão

Data: 2026-09-16  
Status: histórico de presença; regras de qualidade, confirmação e financeiro atualizadas pela ADR-023. A política financeira futura permanece inativa.

## Contexto

O estado da reserva, isoladamente, não prova que uma sessão ocorreu. O TES já
possuía eventos confiáveis do Zoom, confirmação bilateral e regras financeiras
V9/V10, mas não consolidava de forma única a chegada à sala de espera, o join
confiável, a tolerância de dez minutos e a responsabilidade por uma sessão não
realizada. Isso permitia que uma sessão passada continuasse visualmente
“Confirmada” e não distinguia falta do cliente, falta do terapeuta e falta de
ambos.

## Decisão

- A evidência é consolidada por tentativa estável da reserva, que só muda com reagendamento efetivo. “Presente em T+10” significa
  chegada autenticada à sala de espera ou `session.user_joined` confiável até o
  fim da tolerância. T+10 exato ainda pertence à janela; depois desse instante,
  cada participante só pode reentrar se sua **própria** chegada ou entrada foi
  registrada no prazo. A chegada do cliente não legitima a entrada tardia do
  terapeuta.
- Depois de T+10: terapeuta presente/cliente ausente gera `no_show_patient`;
  cliente presente/terapeuta ausente gera `no_show_therapist`; ambos ausentes
  gera `no_show_both`. Se ambos chegaram, mas os joins bilaterais não se
  confirmarem até o fim, o caso fica `requires_review`.
- `no_show_therapist`, `no_show_both` e `requires_review` abrem incidente
  administrativo e nunca chamam Stripe automaticamente. A classificação não bloqueia,
  duplica, estorna nem libera Transfer. Ausência do terapeuta, isolada ou conjunta,
  admite somente reembolso integral por decisão explícita e justificada do Admin;
  a ausência exclusiva do cliente preserva o procedimento existente.
- Na ausência dupla, paciente e terapeuta recebem somente o estado neutro de
  encontro/sessão não realizada e a orientação para o TES. A classificação
  `no_show_both`, as chegadas, joins, evidências e a decisão financeira ficam
  visíveis somente à operação administrativa.
- O finalizador filtra evidências classificáveis antes do limite da fila;
  sessões antigas com entrada bilateral e trabalhos de encerramento ainda
  pendentes não podem impedir a análise das demais. Após `no_show_therapist`
  ou `no_show_both`, o acesso é negado imediatamente e um trabalho versionado
  encerra a sala ativa por ID persistido ou uma única correspondência exata de
  nome no provedor. Correspondência ambígua exige intervenção, nunca um
  encerramento por aproximação.
- O formulário de qualidade exige entrada confiável de ambos e encerramento.
  A resposta “Não” indica que uma sessão realizada não foi bem-sucedida; não
  classifica ausência e não confirma em nome de ninguém. Sem entrada bilateral,
  o formulário e a fila de avaliações ficam ocultos; suporte segue acessível.
- A transição de status incrementa a versão da reserva sem criar tentativa nova.
  Presenças, confirmações e relatos da tentativa anterior não são herdados após
  reagendamento. Relatos legados permanecem históricos, sem reinterpretação.
- Reagendamento preserva o mesmo pagamento e não cria Charge ou Transfer. O
  paciente escolhe depois um horário autoritativo do mesmo terapeuta.
- Reembolso V10 reutiliza o comando integral existente: tenta Transfer Reversal
  antes do Refund, mas o Refund integral não depende do sucesso do Reversal. A
  diferença não recuperada vira dívida compensável em Transfers futuros.
- Quando o Admin atribui a falha ao TES, o reembolso integral não tenta
  Transfer Reversal, não reduz o repasse do terapeuta e não cria dívida: o
  custo permanece integralmente com a plataforma.
- Na falta exclusiva do paciente, a reserva é classificada após T+10 e a sala
  é encerrada com proteção de tentativa/versão; não se aguarda o Zoom para
  bloquear entrada nem se afirma confirmação individual ou repasse concluído.
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
  realizada, qualidade e financeiro separados; uma sala lógica ainda `ready`/`active`
  durante o encerramento técnico não é apresentada como disponível.
- O badge e a rail de pendências do terapeuta não tratam ausência dupla como
  “Atenção”; a sessão permanece visível como não realizada, enquanto a fila
  detalhada permanece exclusiva do Admin.
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

- aplicação progressiva de migrations, pgTAP e lint em banco local isolado,
  preservando o volume e os dados existentes; `db reset` exige autorização;
- concorrência entre classificação, decisão Admin, Transfer, Payout, Reversal,
  Refund e compensação;
- Stripe Test Mode com Reversal total, saldo insuficiente e recuperação tardia;
- QA visual nas três áreas e prova de que nenhuma taxa foi estimada ou aplicada
  a snapshots antigos.
