# P02 — Detalhe do encontro do paciente

Status: design ready para implementação incremental  
Rota: `/app/encontros/[bookingId]`  
Densidade: `Balanced`, com orientação `Comfortable` apenas no contexto principal.

Esta decisão aplica o [Calibration Contract](./calibration-contract.md) à página
de detalhe. A referência enviada é direção de composição, não especificação: a
interface do paciente usa **Encontro** e nunca expõe URL, token, host ou papel
técnico do Zoom.

## Agent A — Product / UX

### Tarefa dominante

Nos primeiros segundos, a pessoa deve entender **quando e com quem é seu
encontro e qual é o próximo passo autorizado agora**. A página não é um ledger
de bookings nem uma tela de videochamada.

### Hierarquia e estados

1. Identidade do encontro: terapeuta, terapia, data, horário e duração.
2. Estado e orientação atual, fornecidos por `encounterState` e pela action
   policy canônica.
3. Uma única ação contextual, se o estado a autorizar: entrar na sala segura,
   pedir ajuda de pagamento ou resolver uma pendência de reagendamento.
4. Preparação, política e ações de operação próximas ao contexto que as torna
   necessárias.
5. Continuidade: o que foi compartilhado e relação com a terapeuta, sem
   inventar conteúdo clínico.

O detalhe preserva `getPatientSessionDetailPage`, presentation mapping de
`getPatientEncounterPresentationState`, `SessionOperationActions`, recibo
canônico e rota dedicada de vídeo. Não deduz pagamento, não antecipa entrada no
Zoom e não usa dados demonstrativos como estado de produção.

### Transformação responsiva

- **Desktop:** contexto principal e orientação complementar podem coexistir em
  duas colunas; o conteúdo de continuidade usa seções abertas abaixo.
- **Tablet:** prioridade e CTA permanecem junto da identidade; apoio sai da
  lateral e entra após o contexto principal.
- **Mobile:** terapeuta → data/hora → estado → CTA formam uma sequência linear.
  Ações secundárias e conteúdo de continuidade vêm depois; nenhuma ação
  autorizada depende de uma rail ou de scroll horizontal.

## Agent B — Visual Direction

### Preservar da referência

- título editorial, navegação de retorno e relação humana terapeuta–tempo;
- visibilidade imediata de data, horário, status e próxima ação;
- preparação e suporte como orientação calma, não como conteúdo técnico.

### Adaptar para TES

- Um único `AccentSemanticSurface` local comunica a entidade/ação dominante;
  ele não vira mega-card, nem contém cards internos.
- Informações de apoio usam seções abertas, ritmo vertical e hairlines; não uma
  coleção de caixas brancas com sombra.
- Status usa texto completo e reforço visual discreto. Pagamento só aparece
  como orientação quando efetivamente muda o próximo passo.
- O suporte é contextual e deslocável no fluxo, não uma rail permanente para
  preencher coluna.

### Rejeitar da referência

- copy de paciente com “sessão”;
- URL copiável, link ou qualquer dado técnico de Zoom;
- cards iguais para todas as ações, métricas/jornada inventadas e imagens
  decorativas sem dado de produto;
- CTA de entrada disponível fora da autorização backend.

## Agent C — Design System

| Elemento                   | Decisão                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Header                     | variante local `balanced` do contrato PageHeader; não alterar `AppPageHeader` global |
| Contexto principal         | `AccentSemanticSurface` local de detalhe; domínio paciente                           |
| Informações e continuidade | `Light PageSection` aberto + `border-border` como hairline                           |
| Status                     | `guidance` da anatomia de status; mapping continua no domínio                        |
| CTA                        | regra `ContextualCTA`; a API React permanece local                                   |
| Operações                  | reutilizar `SessionOperationActions` e `TESDialog`                                   |
| Zoom                       | reutilizar rota dedicada; sem componente/paralelo de link                            |

Nenhum token, primitive, wrapper global ou componente compartilhado novo é
necessário. Uma eventual composição `EncounterPrimaryContext` continua local
até haver outra ocorrência compatível.

`DESIGN READY — P02`

## Agent D — Implementação

O detalhe foi refatorado de forma incremental em
`src/features/patient-session-detail/`: o contexto principal reúne identidade,
tempo, status e ação permitida; a sala Zoom permanece em rota dedicada e o
conteúdo restante passou a usar seções abertas e divisores. Foram removidos o
controle de cópia de link e o bloco ornamental de jornada. Reagendamento,
cancelamento, recibo, suporte e checagem de dispositivos preservam os contratos
existentes.

## Agent E — QA e estado do gate

- Testes direcionados da feature: 5 arquivos e 17 testes aprovados.
- Suíte completa: 158 arquivos e 635 testes aprovados.
- `npm run lint`, `npm run typecheck` e `npm run build`: aprovados na execução
  final.
- Playwright alcançou a rota local, mas a proteção de autenticação redirecionou
  corretamente para `/cliente/login`; não havia uma sessão de paciente
  disponível para comprovar a página real em desktop, tablet e mobile.

Não há evidência visual autenticada suficiente para atribuir Visual Quality
Score ou aprovar P02 como página calibrada. O próximo gate é uma sessão real de
paciente no navegador, com screenshots nos três viewports e revisão de
hierarquia, overflow, touch targets e CTAs state-aware.

## Aplicação visual complementar — 2026-08-23

As referências anexadas pelo produto foram incorporadas como direção visual
complementar ao node Figma `13366:6713`. A implementação atual concentra a
primeira dobra em um hero editorial com identidade, data, horário, sala, status
e ação autorizada; adiciona uma faixa responsiva de pagamento, sala e estado do
encontro; e reorganiza as seções em uma rail contextual somente em desktop
amplo. No mobile, suporte e lembrete aparecem antes do contexto, e o restante
segue em fluxo vertical sem scroll horizontal.

Estados de erro, loading e not-found passaram a ter superfícies próprias. A
composição não adiciona rotas de calendário ou edição de intake porque esses
fluxos não foram identificados nos contratos atuais.

## Ajustes operacionais — 2026-08-24

- A ilustração de lótus permanece somente no campo de contexto compartilhado do
  agendamento; foi removida do hero, de “Sobre este encontro” e do lembrete.
- O card “Mais opções” foi removido. Informações úteis agora abrem respostas
  locais em `TESDialog`, sem encaminhar perguntas para a Central de mensagens.
- “Antes do encontro” recebeu o espaçamento padrão entre título e recomendações.
- A política exibida segue o documento operacional recebido: 24 horas ou mais
  permitem reagendamento ou reembolso quando aplicável; menos de 24 horas e
  não comparecimento não geram obrigação de reembolso; exceções são analisadas
  individualmente.
- O popover de notificações passou a ser renderizado em camada global ancorada
  ao sino, evitando que o conteúdo da página atravesse o painel.

O QA visual autenticado continua pendente por falta de uma sessão de paciente
disponível no navegador local.

`P02 IMPLEMENTED — VISUAL QA AUTHENTICATED PENDING`
