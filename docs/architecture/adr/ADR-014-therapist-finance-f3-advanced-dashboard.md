# ADR-014 — Financeiro do terapeuta F3: dashboard avançado Premium Plus

Data: 2026-07-29

## Status

Aceita para implementação local.

## Contexto

F0/F1 consolidou a operação financeira essencial do terapeuta em quatro abas.
F2 adicionou métricas intermediárias para Premium e Premium Plus. A F3 ativa o
dashboard avançado do Premium Plus no frame Figma `14242:1347`, preservando a
fonte financeira canônica `session_payments`, Stripe Connect hospedado, ledger,
RLS e políticas de repasse.

## Decisão

Criar read models privados F3:

- `get_private_therapist_advanced_financial_dashboard_v1`;
- `get_private_therapist_financial_forecast_v1`;
- `get_private_therapist_agenda_revenue_potential_v1`;
- `get_private_therapist_financial_opportunities_v1`;
- `get_private_therapist_retention_analytics_v1`.

Todos derivam o terapeuta de `auth.uid()`, exigem plano `premium_plus` e
retornam estados discriminados. Free mantém a operação F0/F1. Premium mantém
F2. Premium Plus acessa F2 e F3 via capability `advanced_financials`.

## Metodologias

| Versão                           | Uso                         | Regra central                                                                                           |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `tes-financial-forecast-v1`      | Previsão do mês             | Separa realizado líquido, receita contratada futura e potencial estimado.                               |
| `tes-agenda-potential-v1`        | Potencial da agenda         | Deduplica janelas de disponibilidade, subtrai bloqueios/reservas pagas e usa preço histórico quando há. |
| `tes-financial-opportunities-v1` | Oportunidades e Insight TES | Gera ações por regras determinísticas a partir de evidências retornadas no contrato.                    |
| `tes-retention-v1`               | Retenção avançada           | Usa primeira sessão concluída, retorno pago em até 90 dias e censura janelas incompletas.               |

Projeções nunca criam lançamentos em `financial_ledger_entries`, nunca alteram
saldo, repasse, comissão, reembolso, disputa ou transferência.

## Benchmark

Benchmark não é exibido na interface financeira do terapeuta nesta versão.
Contratos SQL legados de benchmark não devem alimentar novas superfícies sem
nova decisão de produto, privacidade e QA.

## Interface

A aba Resumo mantém os blocos F0/F1 e F2. A F3 adiciona, apenas para Premium
Plus:

- cards superiores de realizado, contratado e potencial;
- previsão do mês com composição separada;
- ocupação e potencial da agenda;
- oportunidade do mês;
- Insight TES rule-based;
- retenção por coorte;
- evolução com realizado, contratado, estimado e período anterior;
- ranking detalhado por terapia.

Premium vê um card de upgrade Premium Plus. Recebimentos, Repasses,
comprovantes, reembolsos e Conta de recebimento não são bloqueados por
`advanced_financials`.

## Consequências

- O dashboard avançado usa dados reais, mas comunica confiança baixa quando há
  pouca base histórica.
- O potencial da agenda é uma estimativa, não receita garantida.
- A metodologia inicial é conservadora e pode evoluir por nova versão sem
  reescrever o passado como saldo real.
- A UI e os testes precisam preservar a separação visual entre realizado,
  contratado e estimado.

## Referências

- `docs/payments/therapist-finance-f0-f1.md`;
- `docs/payments/architecture.md`;
- `supabase/migrations/20260729110000_therapist_finance_f3_advanced_dashboard.sql`;
- `supabase/tests/018_therapist_finance_f3_advanced.sql`;
- Figma `Z42SR0Pi0m307SmcAkDqHb`, frame `14242:1347`.
