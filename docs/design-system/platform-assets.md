# Assets da plataforma

Atualizado em 2026-08-27.

## Fonte e contrato

- Fonte visual: Figma `Projeto Terapeuta Eu Sou Atualizado`, página `Assets plataforma`, node `13878:732`.
- Arquivos de produção: `public/assets/plataforma/`.
- Manifesto executável: `src/lib/platform-assets.ts`.
- A primitive `TESDecorativeMedia` preserva a mídia integral e aplica somente
  uma faixa curta de transição na borda que encontra a copy; ela não inclui
  conteúdo, ações ou informação essencial na imagem.
- Fades são `left`, `right`, `bottom` ou `none`. Banners e cabeçalhos não usam
  borda decorativa; bordas funcionais de controles, tabs e listas permanecem.
- A primitive não impõe posição ou tamanho: cada superfície declara seu próprio
  enquadramento. Em desktop, banners e cabeçalhos alinham o recorte ao lado
  direito do container e mantêm o conteúdo em um sibling semântico acima dele.

## Mapa Figma → produto

| Layer Figma ou origem visual                     | Chave do manifesto            | Superfície                                           |
| ------------------------------------------------ | ----------------------------- | ---------------------------------------------------- |
| `Icone login terapeuta`                          | `therapistLoginIcon`          | Asset legado preservado no manifesto                |
| Asset fornecido para auth (2026-08-27)           | `therapistLoginBackground`    | Login e cadastro de terapeuta                        |
| `[Publico] Terapeutas`                           | `publicTherapistsHero`        | `/terapeutas`                                        |
| `[Publico] Terapeutas - Banner inferior fundo`   | `publicTherapistsLowerBanner` | CTA inferior de `/terapeutas`                        |
| `[Publico] Terapias`                             | `publicTherapiesHero`         | Hero de `/terapias`                                  |
| `[Publico] Terapias - card`                      | `publicTherapiesCard`         | Quadro “Não encontrou o que procura?” de `/terapias` |
| `[Publico] Sua jornada - card`                   | `publicJourneyPathsCard`      | CTA “Ver caminhos para mim”                          |
| `[Publico] Card Jornada`                         | `publicJourneyCta`            | CTA de jornada da home                               |
| `[Paciente] Inicio`                              | `patientOverviewHero`         | `/app`                                               |
| `[Paciente] Sessões`                             | `patientEncountersHero`       | `/app/encontros`                                     |
| `[Paciente] Mensagens`                           | `patientMessagesHero`         | `/app/mensagens`                                     |
| `[Paciente] Favorito`                            | `patientFavoritesHero`        | `/app/favoritos/terapeutas`                          |
| `[Terapeuta] Visão geral - depois do onboarding` | `therapistDashboardHero`      | `/terapeuta`                                         |
| `[Terapeuta] Suas terapias`                      | `therapistServicesHero`       | `/terapeuta/servicos`                                |
| `[Terapeuta] Avaliação`                          | `therapistReviewsHero`        | `/terapeuta/avaliacoes`                              |
| `[Terapeuta] Métricas e Insights`                | `therapistMetricsHero`        | `/terapeuta/insights`                                |
| Bloqueio de recurso Premium                      | `therapistPremiumLock`        | Dialog de upgrade de recursos do terapeuta           |
| `[Terapeuta] Financeiro`                         | `therapistFinanceHero`        | `/terapeuta/financeiro`                              |
| `[Terapeuta] Central de Mensagens`               | `therapistMessagesHero`       | `/terapeuta/mensagens`                               |

`[Publico] Terapeutas - Banner inferior fundo e texto` não é distribuído ao
produto: ele é referência visual. A copy do banner é sempre HTML acessível.

O login e o cadastro de terapeuta usam o asset `therapistLoginBackground`,
fornecido para esta superfície em 2026-08-27. A copy `Para terapeutas` e
`Seu espaço começa aqui` permanece em HTML semântico sobre a imagem. O asset
`therapistLoginIcon` continua disponível para compatibilidade, mas não é mais
selecionado pelo shell de autenticação.

## Responsividade e acessibilidade

- Desktop mantém mídia lateral alinhada à direita e um fade curto no lado do
  texto; o fade não pode apagar o assunto principal do asset.
- Tablet reduz a área da mídia sem esconder título, contexto ou ações.
- Mobile preserva conteúdo antes da mídia; imagens decorativas podem ser
  ocultadas quando não houver espaço suficiente.
- Todas as imagens deste catálogo são decorativas e usam `alt=""`; o conteúdo
  associado permanece em headings, texto e controles semânticos.
