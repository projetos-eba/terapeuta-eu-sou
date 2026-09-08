# ADR-019: elegibilidade de Transfer baseada somente na liquidação Stripe

## Status

Aceito em 2026-09-04. Substitui apenas o gate temporal descrito no ADR-015;
confirmação bilateral, bloqueios, lote semanal, `source_transaction`, Payout e
conciliação permanecem inalterados.

## Contexto

O fluxo aplicava uma espera fixa de 24 horas depois da confirmação da sessão e,
em seguida, aguardava a disponibilização da cobrança pela Stripe. Como a
Balance Transaction já representa o período real de liquidação, a espera local
duplicava tempo sem acrescentar evidência financeira.

## Decisão

- `service_confirmed_at` inicia imediatamente a análise financeira.
- Sem Balance Transaction `available`, `available_on` vencido e snapshot
  consultado nas últimas duas horas, o pagamento fica `waiting_settlement`.
- Com a evidência válida e sem bloqueio, disputa, reembolso ou impedimento
  Connect, o pagamento passa a `eligible` para o próximo lote semanal.
- `waiting_safety_period` permanece no enum e nos parsers apenas como contrato
  legado. Ele não é mais produzido e é apresentado como “Em liquidação”.
- A migração reavalia pagamentos ativos ainda não loteados. Ela não cria lote,
  Transfer, Payout nem altera confirmação, presença ou permissões do Zoom.
- O reconciliador horário mantém a visão quase em tempo real. O lote semanal
  revalida as candidatas no cutoff e continua sendo a autoridade de reserva,
  evitando conflito ou esquecimento entre os jobs.

## Consequências

O terapeuta deixa de ver uma etapa artificial e acompanha diretamente a
liquidação. A remoção não antecipa dinheiro indisponível: falhas, evidência
ausente, divergente ou desatualizada continuam fechadas. Políticas históricas
permanecem ligadas aos pagamentos para auditoria, enquanto a política V9 define
zero dia de espera para novos pagamentos.
