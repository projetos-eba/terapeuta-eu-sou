# Handoff — Calibration TES após Benchmarks A, B e C

Status: consumido pela Calibration; substituído pelo
[Calibration Contract](./calibration-contract.md)  
Atualização: 2026-08-14

Fontes principais:

- `benchmark-a-agenda.md` — `/terapeuta/agenda`, `86,7/100`;
- `benchmark-b-admin-professionals.md` — `/admin/profissionais`, `86,5/100`;
- `benchmark-c-patient-encounters.md` — `/app/encontros`, score acima do gate;
- `benchmark-plan.md` e `multi-agent-workflow.md`.

Este documento reúne evidências. Não promove component, pattern, wrapper ou
token e não autoriza rollout.

## 1. Patterns com evidência em três benchmarks

### PageHeader por densidade

Os três benchmarks funcionam melhor com composição aberta, mas não com uma API
visual única:

- Agenda: editorial operational, maior contexto temporal;
- Admin: compacto operational, ação e atualização próximas;
- Paciente: editorial balanced, voz humana e próxima entidade.

Decisão para Calibration: projetar anatomia compartilhada e avaliar variantes
`balanced`/`operational`; não converter automaticamente o `AppPageHeader`
existente.

### Light PageSection

Spacing, alinhamento e divider substituíram surfaces sem função nos três casos.
Surface permanece legítima para calendário, tabela comparável ou entidade
dominante. Candidate forte para princípio/API com opt-in explícito.

### Status treatment

Todos exigem estado + orientação + ação, mas a semântica é de domínio:

- Agenda: sessão, hold, bloqueio e terapia;
- Admin: exceção cadastral/operacional;
- Paciente: tempo, pagamento, reagendamento e entrada.

Design System deve oferecer anatomia/tones; domínio continua responsável pela
tradução e autorização.

### Hairline como técnica

Hairlines organizaram timeline, tabela e EntityList. O token `border` existente
foi suficiente; a evidência rejeita um token global dedicado neste momento.

## 2. Patterns com evidência em dois benchmarks

- `FilterBar`: Agenda e Admin confirmam anatomia, prioridades e disclosure
  mobile diferentes. Paciente confirma que não é universal.
- `EntityList`: Admin e Paciente confirmam identidade → estado/contexto → ação,
  com variantes operational e balanced.
- `Responsive disclosure`: filtros no Operational; histórico/ações secundárias
  no Balanced. A regra transfere, a UI não é idêntica.
- `AccentSemanticSurface`: aparece como exceção/contexto no Operational e
  entidade dominante no Balanced; contrato ainda instável.

## 3. Patterns domain-specific

### Agenda

- Timeline/calendário;
- CommandBar temporal;
- ContextRail;
- cores semânticas de terapia;
- legenda e range temporal.

### Admin

- OperationalTable;
- MetricStrip autoritativo;
- operação por exceção;
- paginação e filtro administrativo;
- OperationalStatus.

### Paciente

- NextEncounter/NextActionSpotlight;
- PatientStatusGuidance;
- TemporalGroup;
- continuidade terapeuta–tempo;
- empty state Match/busca.

## 4. Patterns rejeitados

- MetricStrip universal;
- ContextRail como convenção de dashboard;
- CommandBar fora de tarefa com modos/comandos reais;
- badge para todo estado;
- card por entidade;
- token dedicado de hairline;
- tabela para encontros do paciente;
- JourneySection inferida como pattern genérico;
- componente global UpcomingMeeting antes de repetição.

## 5. Component duplications comprovadas

- headers locais evitam o wrapper card-heavy por razões válidas, mas duplicam
  anatomia;
- avatares/monogramas têm implementações locais em Admin e Paciente;
- identidade de entidade se repete em OperationalTable/EntityList/EncounterRow;
- tratamentos de status repetem estrutura com tradução distinta;
- CTAs locais ainda duplicam classes onde `TESButton` não cobre toda a
  combinação;
- FilterBars de Agenda/Admin compartilham intenção, não implementação;
- empty/error states continuam com APIs locais.

Não consolidar por busca textual. Primeiro definir slots, densidade e contratos.

## 6. Token gaps comprovados

Nenhum gap global obrigatório foi comprovado pelos três benchmarks.

- surfaces suaves existentes atenderam Balanced e Operational;
- `border` atendeu hairlines;
- tokens semânticos atenderam atenção/sucesso/erro;
- tipografia display/body foi suficiente;
- spacing existente sustentou os três níveis.

Lacuna de processo: a allowlist da política visual ainda cobre áreas legadas
inteiras. Calibration deve avaliar redução segura por arquivos já saneados.

## 7. Global wrappers que precisam de revisão

- `AppPageHeader`: card, border e shadow são defaults inadequados para as três
  composições benchmark.
- `AppPageSection`: surface elevada por default incentiva cardification.
- `TESCard`: deve continuar primitive opt-in, não unidade automática de página.
- `AppPageGrid/Aside`: rail não pode ser consequência automática do grid.

Revisão deve ser compatível e gradual; nenhuma mudança global foi feita nos
benchmarks.

## 8. Skills que precisam de ajuste

- `tes-ui-experience`: incluir evidência concreta de transformação por
  densidade e hierarquia temporal/por exceção.
- `tes-design-system`: registrar critérios de admissão de PageHeader,
  LightSection, EntityList e status anatomy após decisão da Calibration.
- `therapist-agenda-sessions`: preservar CommandBar/ContextRail como domínio.
- `admin-people-operations`: preservar OperationalTable/MetricStrip como
  hipóteses Admin.
- `patient-encounters`: já registra o Benchmark C e deve preservar spotlight,
  estados e detalhe transacional como domínio.

## 9. Anti-patterns descobertos na implementação real

- KPI cards ocupando primeira dobra sem mudar decisão;
- surface dentro de surface em entidade dominante;
- rail criado apenas para ocupar espaço;
- status transformado automaticamente em pill;
- menu overflow com ações não condicionadas ao estado;
- copy técnica (`validação autoritativa`, provider, payment status) no front;
- promessa emocional derivada de dado frágil;
- uso de tamanho pequeno para fazer informação caber;
- tabela comprimida em vez de transformação mobile;
- screenshot dev contaminado por tooling externo;
- fixture E2E que deixa de oferecer booking simultaneamente futuro e pago na
  autoridade canônica após envelhecimento do reset.

## 10. Diferenças entre Comfortable, Balanced e Operational

| Dimensão | Comfortable           | Balanced                                    | Operational                                  |
| -------- | --------------------- | ------------------------------------------- | -------------------------------------------- |
| objetivo | orientação/narrativa  | orientação + ação pessoal                   | throughput, comparação e exceção             |
| header   | editorial amplo       | editorial contido                           | compacto e contextual                        |
| surface  | rara, narrativa/ação  | entidade dominante ou estado                | região comparável/comando                    |
| lista    | sequência narrativa   | entidade humana + tempo + próximo passo     | identidade + estado + qualificadores + ação  |
| CTA      | uma direção principal | varia pelo estado da entidade               | encaminha operação sem esconder ação crítica |
| metadata | mínima                | contextual                                  | mais densa, ainda legível                    |
| mobile   | narrativa linear      | prioridade temporal e disclosure secundário | transforma tabela/controle, preserva decisão |

As diferenças não dependem de repetir ou trocar o roxo. A família TES permanece
visível em hierarchy, display typography, ritmo, linguagem, surfaces semânticas
e feedback responsável.

## Decisões obrigatórias da Calibration

1. Definir ou rejeitar API de PageHeader por densidade.
2. Definir contrato de Light PageSection sem regressão cross-shell.
3. Prototipar EntityList com slots e variantes, sem semântica de domínio.
4. Separar Status anatomy de presentation mapping.
5. Decidir se AccentSemanticSurface é pattern ou apenas técnica.
6. Consolidar duplicações documentais do Benchmark B.
7. Planejar saneamento gradual das allowlists visuais.
8. Resolver harness de screenshots sem Next Devtools.
9. Tornar fixtures E2E temporais renováveis pelo fluxo documentado.
10. Atualizar skills globais somente depois dessas decisões.

## Gate

Calibration não foi executada. Storybook, reorganização de
`src/components/tes`, promoção de candidates, migração de wrappers e rollout
permanecem bloqueados até tarefa separada e aprovação explícita.

`Documentação atualizada`
