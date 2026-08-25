# Plano de correção da Assessora Aura

## Objetivo

Transformar o diagnóstico da Assessora Aura em uma implementação coerente,
auditável e utilizável, preservando o visual atual que já está aprovado,
preservando os dados locais e eliminando as divergências entre a página da Aura
e o painel do terapeuta.

Este plano foi executado em três fases. A validação concluída neste ciclo é
local; HML e produção continuam sendo gates separados porque exigem conta,
configuração e dados reais desses ambientes.

## Resultado executivo

| Resultado                               | Situação                                                   |
| --------------------------------------- | ---------------------------------------------------------- |
| Nome público exibido                    | Corrigido para **Assessora Aura**                          |
| Fonte do dashboard e da página Aura     | Unificada no mesmo serviço server-only + RPC               |
| Recomendações demonstrativas            | Marcadas explicitamente como `demo_seed` e excluídas       |
| Recomendações persistidas sem evidência | Bloqueadas no mapper da superfície terapeuta               |
| Período e atualização                   | Exibidos com data, fuso e escopo de histórico              |
| Barras sem série histórica              | Identificadas como visual ilustrativo                      |
| Estado de indisponibilidade             | Diferenciado de “sem recomendações”                        |
| Dados locais                            | Preservados; nenhuma rotina de reset ou exclusão executada |
| HML/produção                            | Gate pendente de homologação autenticada real              |

## Princípios preservados

- A Assessora Aura continua sendo uma leitura determinística por regras
  versionadas; não foi introduzido LLM, chat, embeddings, sentimento ou texto
  generativo.
- O acesso continua privado, derivado de `auth.uid()`, limitado a Premium Plus
  com capability `aura_full`.
- A Aura continua usando somente agregados operacionais do próprio terapeuta.
- Paciente, booking individual, comentário privado, conversa e intake não são
  enviados para a interface da Aura.
- Amostra abaixo de 10 continua protegida; a taxa não vira um número parcial.
- O slot engine canônico continua sendo a fonte de disponibilidade futura.
- Dismissal continua idempotente por terapeuta, regra, versão e janela.
- Rotas, componentes visuais e assets existentes foram preservados.

# Fase 1 — contrato e integridade dos dados

**Status: concluída localmente.**

## Correções realizadas

### 1. Uma fonte de verdade para a Aura

Antes, a página `/terapeuta/assessor-ia` consumia o RPC
`get_therapist_aura_signals_v1` e aplicava regras server-only, enquanto o
dashboard lia diretamente `aura_recommendations` pelo REST. Isso permitia
divergência de período, filtro, dismissals, evidência e origem dos dados.

Agora, o dashboard Premium Plus chama o mesmo `getTherapistAuraPage` da página
dedicada, usando período de 30 dias. A transformação para observações,
sugestões e ações acontece em `mapTherapistAuraPage`, a partir do mesmo
contrato de recomendações.

Arquivos principais:

- `src/features/therapist-aura/therapist-aura.service.ts`
- `src/features/therapist-dashboard/therapist-dashboard.service.ts`
- `src/features/therapist-dashboard/therapist-dashboard.mappers.ts`
- `src/features/therapist-dashboard/therapist-dashboard.types.ts`

### 2. Proteção da origem demonstrativa

Foi encontrado um problema concreto no ciclo migration → seed: a migration
marcava as linhas antigas com `context.source = demo_seed`, mas o seed local
fazia upsert com um contexto que não carregava essa marca. Em um banco recém
recriado, a página dedicada poderia receber essas linhas porque o filtro não
distinguia `NULL` de origem operacional.

Correção aplicada:

- o seed local passou a gravar `source: demo_seed` em todas as cinco linhas;
- a migration forward-only
  `20260824153000_aura_seed_origin_guard.sql` corrige linhas existentes que
  ainda estejam sem a marca;
- a evidência de seed é registrada como `source: seed`;
- nenhum registro operacional é apagado.

Arquivos principais:

- `supabase/seeds/local-test-data.sql`
- `supabase/migrations/20260824153000_aura_seed_origin_guard.sql`

### 3. Evidência mínima para recomendações persistidas

O mapper da Aura agora falha fechado para recomendações persistidas sem
evidência estruturada. Linhas com evidência vazia, `seed` ou `demo_seed` não
entram na superfície do terapeuta. Quando há evidência, a interface mostra uma
descrição agregada e não expõe dados individuais.

Arquivo principal:

- `src/features/therapist-aura/therapist-aura.mappers.ts`

## Critérios de aceite da Fase 1

- Dashboard e página dedicada retornam o mesmo conjunto de regras para o mesmo
  terapeuta e janela.
- Dismissal na página dedicada remove o sinal também do dashboard ao atualizar.
- Seed demonstrativo nunca aparece como recomendação operacional.
- Nenhuma consulta do componente ou REST paralelo consulta
  `aura_recommendations` para montar o dashboard.
- Nenhum dado de paciente ou booking individual aparece no contrato mapeado.

# Fase 2 — interface, transparência e comportamento

**Status: concluída localmente.**

O visual editorial atual foi mantido: hero, personagem, seletor 30/90, quatro
KPIs, três leituras contextuais, recomendações e bloco final de resultados.
Foram corrigidas as mensagens que induziam uma interpretação maior do que o
contrato realmente entrega.

## Ajustes realizados

### 1. Nomenclatura pública

- O título principal permanece **Assessora Aura**.
- “Sua assistente inteligente” foi substituído por “leitura por regras”.
- “Insights gerados automaticamente” foi substituído por “Sinais calculados
  automaticamente”.
- O texto explica que a leitura usa dados operacionais agregados.

### 2. Transparência de período e atualização

A página passa a mostrar:

- data e hora do cálculo;
- fuso usado pela conta;
- data de encerramento do histórico;
- distinção entre histórico completo e disponibilidade futura.

As regras continuam com os escopos corretos:

- agenda: próximos 14 dias pelo slot engine;
- avaliações: total de avaliações publicadas sem resposta publicada;
- cancelamentos, ausências e retorno: últimos 30 ou 90 dias completos,
  comparados ao período anterior equivalente;
- métricas de taxa: somente com amostra mínima de 10.

### 3. KPIs que não parecem dados inventados

Os cards foram preservados, mas os rótulos agora representam campos reais:

- Sinais do período;
- Avaliações pendentes;
- Amostras em formação;
- Taxa de retorno.

As barras de referência não são série histórica. O texto acessível agora
identifica explicitamente o visual como ilustrativo e informa quando ainda não
há dado suficiente.

### 4. Estados honestos no dashboard

O card do dashboard diferencia:

- leitura pronta;
- leitura vazia, quando não há sinal elegível;
- leitura indisponível, quando o RPC não conseguiu atualizar.

Assim, uma falha temporária não é apresentada como se fosse ausência de
recomendação.

Arquivos principais:

- `src/features/therapist-aura/components/therapist-aura-page.tsx`
- `src/features/therapist-aura/components/therapist-aura-page.test.tsx`
- `src/features/therapist-dashboard/components/therapist-aura-card.tsx`
- `src/features/therapist-dashboard/therapist-dashboard-page.tsx`

## Critérios de aceite da Fase 2

- O nome público renderizado é “Assessora Aura”.
- A tela não promete IA generativa nem aprendizagem automática.
- Período, atualização, fuso e escopo ficam visíveis.
- Visual sem série histórica é identificado como ilustrativo.
- Erro de leitura e ausência legítima de sinais são mensagens diferentes.
- Mobile não recebe uma segunda fonte de dados nem overflow criado pelos
  ajustes.

# Fase 3 — validação, documentação e homologação

**Status: validação local concluída; homologação externa é gate aberto.**

## Validações executadas

- `npm.cmd run typecheck` — passou.
- `npx.cmd vitest run src/features/therapist-aura src/features/therapist-dashboard`
  — 7 arquivos, 20 testes, passou.
- `npx.cmd supabase db push --local --include-all` — aplicado sem reset;
  incluiu as duas migrations locais pendentes já existentes e a migration da
  proteção Aura.
- `npx.cmd supabase test db --local supabase/tests/082_aura_seed_origin_guard.sql`
  — 5 testes, passou.
- Consulta local de integridade — 5 linhas demonstrativas, 0 linhas sem
  origem.

Também foram atualizados:

- `skills/therapist-aura/SKILL.md`;
- `skills/therapist-dashboard/SKILL.md`;
- `docs/product/integration-map.md`;
- `docs/product/routes-map.md`.

## Gate de HML e produção

Este ciclo não declara HML ou produção como validados. Para fechar esse gate,
é necessário executar em cada ambiente, com conta Premium Plus autorizada:

1. entrar em `/terapeuta/assessor-ia`;
2. confirmar que o contrato RPC está aplicado;
3. validar a leitura de 30 e 90 dias;
4. confirmar os números contra `bookings`, `reviews`, respostas publicadas,
   serviços públicos e disponibilidade canônica;
5. dispensar uma recomendação e confirmar idempotência;
6. verificar que seed/demo não atravessa a resposta;
7. validar dashboard e página dedicada com o mesmo conjunto de sinais;
8. registrar evidência do ambiente, conta, horário, migration head e resultado.

Sem esses dados, qualquer declaração de “dados reais de produção” seria
indevida. O código agora está preparado para esse teste; o teste precisa ser
executado no ambiente autorizado.

## Checklist final de operação

- [x] Nome público corrigido.
- [x] Fonte do dashboard unificada.
- [x] Seed demonstrativo marcado e filtrável.
- [x] Evidência vazia bloqueada na superfície.
- [x] Amostra mínima preservada.
- [x] Período e atualização explícitos.
- [x] Barras ilustrativas identificadas.
- [x] Estado indisponível separado de vazio.
- [x] Dados locais preservados.
- [x] Testes locais executados com resultado.
- [ ] Homologação autenticada em HML.
- [ ] Smoke test autorizado em produção.

## Conclusão

As pendências técnicas identificadas no diagnóstico foram corrigidas no escopo
local: a Assessora Aura agora tem um contrato único entre dashboard e página,
separa demonstração de operação, não apresenta recomendação persistida sem
evidência e comunica seus limites ao terapeuta. O próximo passo não é uma
reimplementação; é a homologação autenticada em HML e, depois, o smoke test de
produção com evidência real.

## Revisão corretiva final — 24/08/2026

O ciclo de certificação complementar fechou os P0/P1 que ainda estavam
abertos no diagnóstico:

- `get_therapist_aura_signals_v2` passou a limitar recomendações persistidas
  por `generated_at` dentro da janela histórica e a limitar avaliações
  pendentes ao mesmo período 30/90;
- `dismiss_therapist_aura_signal_v2` retirou regra/versão do payload do
  navegador e passou a provar a identidade da recomendação no servidor;
- o dismiss recebeu erro humano, retry, estado de processamento e bloqueio de
  clique duplo compatíveis com React 18/TES;
- `cancelled_by_payment` foi documentado e mantido fora da taxa comportamental;
- os grants públicos implícitos das RPCs de suporte foram corrigidos em
  migration independente, fazendo a suíte global passar 1.788/1.788.

Evidência detalhada e o veredito atual estão em
`docs/validacao-certificacao-assessora-aura-2026-08-24.md`. O veredito ainda é
“release candidate local certificado”; a homologação HML continua obrigatória
antes de declarar a produção remota homologada.

## Revisão de deduplicação — 25/08/2026

Foi corrigida a redundância visual observada nas capturas: o sinal de
avaliações pendentes não é mais repetido no card contextual de crescimento
quando já existe recomendação acionável. O mapper também elimina duplicatas
entre recomendações live e persistidas que compartilhem `ruleKey` e
`ruleVersion`, mantendo a leitura live como fonte preferencial. A correção foi
validada em 30/90 dias no navegador autenticado e em 11/11 testes Aura.
