# Implementação — Sessões, Metrics e terapias públicas

Data: 2026-08-25  
Escopo: `/terapeuta/sessoes`, Metrics e `/terapeutas/[slug]`

## Contrato final

### Sessões

- O período padrão é `Últimos 30 dias`.
- As opções são 7, 30, 60, 90 dias e `Histórico completo`.
- Sessões realizadas, canceladas e pendentes respeitam o período selecionado.
- Próximas sessões são uma leitura operacional independente e continuam visíveis mesmo quando o período histórico muda.
- Os cards superiores exibem sessões da semana, realizadas, pendentes, canceladas e taxa de presença.
- A taxa de presença vem do resumo server-side; quando não existe base elegível, a UI exibe `—`.
- Status de sessão, pagamento, modalidade e busca continuam combináveis.
- Os insights analíticos não são duplicados nesta tela. Horários mais agendados e terapias mais realizadas continuam no Metrics.

### Metrics

Metrics permanece como fonte dos gráficos e insights: evolução, comparativo, intensidade por horário e ranking de terapias. A evolução de sessões exibe o período atual e o período anterior em linha tracejada, com tooltip e comparação coerente com o filtro.

### Perfil público

- Todos os serviços ativos, publicados, não arquivados e elegíveis são retornados e exibidos na ordem configurada.
- Cada serviço mantém título, descrição, duração, preço, imagem, temas públicos e ação de agendamento próprios.
- Serviços privados, pausados, arquivados ou inelegíveis permanecem ocultos.
- Os temas são agregados por uma função pública segura, sem expor pesos, IDs ou dados privados.

## Migrations

- `20260825050000_therapist_sessions_period_summary.sql`: adiciona o resumo agregado da RPC de sessões.
- `20260825070000_public_therapy_details_theme_names.sql`: adiciona os nomes públicos de temas ao contrato de detalhes.
- `20260825071000_public_therapy_theme_names_security.sql`: substitui a leitura direta por função `security definer` restrita a serviços publicados.
- `20260825072000_therapist_sessions_online_only_regression.sql`: reforça o contrato atual de modalidade online em upgrade, sem editar migration histórica.

As funções usam `auth.uid()`/perfil autenticado, `search_path` explícito e não concedem acesso direto a dados privados. Não foram feitas alterações destrutivas nem em produção.

## Massa visual local

Para habilitar a visualização autenticada com serviços e agenda de demonstração no banco local, aplicar manualmente:

```powershell
Get-Content '.\supabase\seeds\local-sessions-browser-fixture.sql' -Raw |
  docker exec -i supabase_db_terapeuta-eu-sou psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

Esse arquivo não está no seed global, para não contaminar a suíte pgTAP. É uma fixture local idempotente e não deve ser aplicada em HML ou produção.

## Evidência local

- pgTAP completo: 1819/1819.
- Vitest completo: 696/696 em 178 arquivos.
- E2E Sessions/perfil público: 6/6 em Chromium e Edge.
- TypeScript: passou.
- ESLint: passou; política visual e política online sem violações.
- Build: passou; 119 páginas estáticas geradas.
- Seed guard: 5/5.
- `supabase db lint --local`: passou, com apenas avisos preexistentes de parâmetros/variáveis não utilizados.
- `supabase db push --local --dry-run`: banco atualizado, sem migration pendente.

A validação visual autenticada local cobriu período padrão de 30 dias, 7/60/90 dias, histórico completo, cards operacionais, próximas sessões, ausência de insights duplicados, layout desktop/tablet/mobile, dois serviços públicos, temas múltiplos e ocultação de serviço inelegível.

## Escopo de homologação

HML ficou fora do escopo desta entrega por decisão do solicitante. A certificação desta etapa é local: migrations, banco, contratos, frontend, build, E2E autenticado e validação visual foram executados no ambiente local.
