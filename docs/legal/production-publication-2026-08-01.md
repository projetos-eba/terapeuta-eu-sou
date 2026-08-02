# Publicacao operacional de producao - Stripe e documentos legais

Data: 2026-08-01
Ambiente Supabase: `Terapeuta-Eu-Sou-Production`
Project ref: `aimtdvdpqtmrjfibsmvx`

## Escopo

Esta nota registra a operacao manual controlada realizada em producao para:

- criar e sincronizar o catalogo Stripe Billing em live mode;
- publicar versoes juridicas em `legal_document_versions`;
- desbloquear o cadastro server-side que depende de termos e privacidade publicados.

Nenhum secret foi registrado neste arquivo.

## Stripe Billing live

Planos sincronizados com o banco:

| Plano | Lookup key | Valor | Intervalo | Stripe Price ID | Stripe Product ID |
| --- | --- | ---: | --- | --- | --- |
| Premium | `tes_premium_brl_monthly_v1` | 6000 centavos | `month` | `price_1TzkPJPb5K1FEm06PBoaSxe3` | `prod_Uzjtsxgg0kX0WP` |
| Premium Plus | `tes_premium_plus_brl_monthly_v1` | 12000 centavos | `month` | `price_1TzkPLPb5K1FEm06dziwCJ0U` | `prod_UzjtuwRNjZK0RW` |

Estado validado:

- Stripe prices ativos, `currency = brl`, `livemode = true`;
- `billing_plan_prices.environment = live`;
- `billing_plan_prices.stripe_livemode = true`;
- nenhum plano pago ativo ficou sem `stripe_price_id`;
- webhook live de Billing habilitado e com `customer.subscription.updated`.

## Documentos legais publicados no banco

Versao publicada: `2026.08.01-pdf`.

| Documento | Chave | Caminho canonico | SHA-256 |
| --- | --- | --- | --- |
| Termos de Uso | `terms-of-use` | `/termos` | `28bb5da89e4ac90f113a8fb60f81c621c39e7e80d722ba8af67cb51e040c52d2` |
| Politica de Privacidade | `privacy-policy` | `/privacidade` | `239ff69e8730b2ed187fb6d90474bef99b5e9511bd600c398a2b36d36ae6f159` |
| Politica de Cancelamento, Reagendamento e Reembolso | `cancellation-reschedule-refund-policy` | `/cancelamento-reagendamento-reembolso` | `ea6d646daa5d3e4398f3d7b243ec252a382036b59be236ee3c4866df9ea141a7` |

Estado validado:

- tres documentos publicados e efetivos em `legal_document_versions`;
- os dois documentos exigidos pelo cadastro (`terms-of-use` e `privacy-policy`) publicados e efetivos.

## Pendencias conhecidas

- A extracao textual dos PDFs foi concluida localmente em 2026-08-01 e
  materializada em `src/domain/legal/legal-document-content.json`.
- `src/domain/legal/legal-registry.json` foi reconciliado localmente com as
  versoes publicadas no banco e com os hashes dos PDFs anexados.
- `LegalDocumentPreview` foi ajustado localmente para permitir documentos
  publicaveis em runtime de producao e manter `notFound()` para documentos sem
  status publicado.
- A matriz de suporte publica foi reconciliada com os canais autenticados ja
  implementados (`/app/mensagens`, `/terapeuta/mensagens` e
  `/api/support/tickets`).
- A entidade legal publica ainda depende de dados societarios e canais oficiais
  nao identificados nos PDFs ou nos arquivos analisados: razao social, CNPJ,
  endereco completo, e-mails oficiais, horario operacional de suporte e
  controlador LGPD formal.
