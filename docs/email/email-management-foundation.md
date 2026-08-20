# Fundação de gerenciamento de e-mails

## Escopo da Fase 1

O TES usa Hostinger Mail API exclusivamente em Edge Functions. Os templates
oficiais permanecem versionados em código; `email_action_settings` armazena
somente o estado operacional e overrides opcionais.

Os primeiros eventos configuráveis são `therapy_catalog_request_submitted` e
`therapy_catalog_request_updated`. Destinatário e dados dinâmicos são sempre
resolvidos pelo evento; o Admin não informa e-mail de destino.

## Segurança

- Tokens seguem allowlist por evento e valores desconhecidos falham fechados.
- Preview usa fixture fictícia e HTML sanitizado em iframe sandboxed.
- `anon` não acessa as tabelas de e-mail; `authenticated` só tem leitura
  sujeita a RLS administrativa. Mutação acontece somente na Edge Function.
- Logs mascaram destinatários e truncam erros. Corpos, segredos e credenciais
  não são persistidos no histórico administrativo.

## Limites

## Evolução da Fase 2

`email_outbox` recebe referências mínimas na mesma transação dos eventos de
catálogo. `email-outbox-dispatch` faz claim com `SKIP LOCKED`, resolve o
destinatário server-side, registra o resultado existente e aplica retry
exponencial limitado a cinco tentativas. O fluxo de negócio não espera nem
faz rollback por indisponibilidade do provider.

Envio manual e novos gatilhos de domínio continuam fora do piloto. Nenhum
e-mail real ou alteração HML ocorreu nesta etapa local.
