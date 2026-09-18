# ADR-024 — Frequência privada de sessões desde o primeiro registro

Data: 2026-09-18  
Status: aceita; implantação depende da migration `20260918103000_therapist_metrics_session_timing_v2.sql`.

## Contexto

O contrato MTR-4 aplicava a trava de dez observações também ao mapa agregado de
dia e horário. Isso ocultava a frequência pessoal do terapeuta mesmo quando já
existiam sessões concluídas, sem reduzir um risco de identificação adicional:
o mapa contém somente contagens agregadas do próprio histórico.

Além disso, a origem SQL usava a convenção ISO para domingo (`7`), enquanto os
componentes TES usam a convenção nativa do PostgreSQL/JavaScript (`0`). A
leitura de horários ociosos também precisa partir da capacidade ofertada pela
agenda, e não apenas das faixas em que já houve atendimento.

## Decisão

- `get_therapist_session_metrics_v1` passa a emitir `metricDefinitionVersion`
  `2` para o `heatmap` de frequência privada.
- A coleção tem somente `status`, `observedSample` e contagens agregadas;
  aparece como `ready` da primeira sessão concluída em diante e permanece
  `empty` quando não há sessões no período.
- Dias da semana usam `0` para domingo até `6` para sábado em todo o contrato
  de sessões.
- Percentuais de presença, distribuição de resultados, terapias, continuidade,
  rankings e comparações permanecem com a trava de dez observações.
- O front-end aceita as definições 1 e 2 durante a implantação. A definição
  1 antiga continua legível sem expor valores antes permitidos.
- “Horários ociosos” seleciona a faixa ofertada com menor ocupação, depois a
  maior capacidade livre e, por fim, a ordem cronológica. Sem capacidade válida
  ou com histórico em formação, a interface declara esse estado em vez de
  inventar um horário.

## Consequências

Não há nova tabela, alteração de RLS, mudança de reserva, dado clínico,
pagamento ou regra financeira. CSV continua privado e agregado, agora
distinguindo frequência própria de coleções protegidas por amostra.

Esta decisão substitui somente a aplicação da trava de dez observações à
frequência privada de dia e horário descrita na ADR-011. A trava permanece
íntegra para as leituras comparativas, percentuais e segmentadas.
