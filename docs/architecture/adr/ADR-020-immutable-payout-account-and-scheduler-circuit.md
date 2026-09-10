# ADR-020 — Conta imutável do repasse e circuito do scheduler

Status: aceito em 2026-09-08.

## Contexto

Um terapeuta pode ter gerações histórica e atual de conta Connect. O grupo do
lote já congela a conta válida no momento da reserva, mas a etapa de claim
voltava a relacionar contas apenas pelo terapeuta. Com duas gerações, um item
era multiplicado e o upsert falhava antes de qualquer chamada à Stripe. Como o
cron assíncrono observava somente a entrega ao `pg_net`, o run continuava sendo
readquirido sem registrar a falha real.

## Decisão

1. O destino de um item é exclusivamente a conta registrada em
   `payout_batch_therapists.connect_account_id`, alcançada pelo grupo do item.
2. Uma nova geração de conta nunca altera itens, intenções, Transfers, Payouts
   ou ledger históricos.
3. Itens sem intenção de Transfer podem ser removidos da reserva pela rotina
   canônica de encerramento; itens com intenção permanecem no destino original
   e exigem reconciliação.
4. Falhas do worker pertencem ao run e validam o dono do lease. As três
   primeiras aplicam backoff de 15, 30 e 60 minutos. A quarta marca o run como
   `failed`, libera o lease e abre incidente crítico deduplicado.
5. Retomada manual é interna, exige `service_role`, o run em circuito aberto e
   o mesmo lote. Progresso confirmado zera as falhas consecutivas.
6. O endpoint público mantém erro genérico; detalhes sanitizados permanecem
   apenas em tabelas operacionais protegidas.
7. `balance_insufficient` e `insufficient_funds` representam indisponibilidade
   transitória da plataforma. Não podem transformar o pagamento em bloqueio
   terminal nem atribuir o motivo ao terapeuta.
8. O worker verifica o saldo BRL disponível contra toda a obrigação não
   transferida antes do claim. Insuficiência falha antes de criar novas
   intenções e segue o circuito do run.
9. Contas BR não aceitam Payout manual, semanal, mensal nem saldo mínimo, e a
   conta BRL validada não aceita Top Up. A
   plataforma e as contas conectadas permanecem em Payout diário. O worker
   valida essa agenda e toda a liquidez BRL do lote antes do claim; insuficiência
   falha fechado e entra no circuito. Cobrança `bypassPending` de teste não é
   solução de produção.

## Consequências

- Um claim de dez itens produz no máximo dez intenções, independentemente da
  quantidade de gerações de conta do terapeuta.
- Retry preserva chave de idempotência, fingerprint, `source_transaction` e
  conta do grupo.
- O cron deixa de gerar uma sequência infinita de aquisições silenciosas.
- A recuperação de um lote interrompido reutiliza o mesmo run e o mesmo lote;
  cancelamento, recriação ou retorno global à elegibilidade não fazem parte do
  procedimento.
