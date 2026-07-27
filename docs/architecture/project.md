# MVP Transacional TES - Base Tecnica Consolidada

Data: 2026-07-11
Atualizado em: 2026-07-27

Status: documento consolidado para orientar arquitetura, produto e implementacao do MVP.

Atualizacao operacional de 2026-07-25:

- stack atual: Next.js 15.5.21 e React 18.3.1;
- namespace autenticado aprovado: `/terapeuta/*`;
- `/basico/*`, `/pro/*` e `/plus/*` sao redirects de compatibilidade
  implementados na Fase Agenda 1;
- `/terapeutas/*` permanece exclusivamente publico;
- o Gate Financeiro F0 e os marcos de Agenda A2, A3, A4 e A5 foram
  implementados e validados; A6 e o proximo marco transacional do modulo,
  descrito em `docs/architecture/relatorio-25-07-2026.md`;
- a fundacao Zoom Z0 foi implementada antes de A2, com outbox pós-pagamento,
  Video SDK e webhooks; o go-live ainda depende dos gates operacionais
  registrados em `docs/zoom/production-readiness.md`.
- A2 adicionou snapshots imutaveis em `bookings`, `booking_holds` com TTL,
  exclusao de conflitos por terapeuta, transicoes auditadas, reagendamento
  versionado e integracao com o outbox Zoom, sem duplicar `session_payments`.
- A preparacao de leitura de Agenda e Sessoes adicionou RPCs versionadas,
  cursor, filtros, estado composto, pagamento canonico, preview Zoom seguro e
  contadores leves do shell. Ver
  `docs/architecture/agenda-sessions-preparation.md`.
- A5 adicionou slots autoritativos, validacao de holds contra a agenda,
  calendario privado dia/semana/mes e cores semanticas por terapia. Ver
  `docs/architecture/agenda-a5-closure.md`.

## 1. Objetivo

Este documento consolida a base tecnica do MVP do Terapeuta Eu Sou, unificando:

- escopo funcional do MVP transacional;
- sistema de Match de terapias;
- processo financeiro com Stripe;
- rotas, perfis e planos existentes no projeto;
- arquitetura recomendada para backend, frontend, dados, seguranca e operacao.

O documento deve servir como referencia para implementacao, refinamento de backlog, modelagem de dados, desenho de APIs, validacao de produto e tomada de decisao tecnica.

## 2. Fontes analisadas

Fontes principais:

- `AGENTS.md`.
- Figma `Projeto Terapeuta Eu Sou Atualizado`, pagina `Jornadas dos Usuarios`, node `12272:2`, frame principal `12280:2`.
- `docs/product/sitemap.md`.
- `docs/product/routes-map.md`.
- `docs/product/product.md`.
- `docs/product/mvp.md`.
- `docs/product/page-inventory.md`.
- `docs/design-system/design-system.md`.
- `docs/design-system/tokens.md`.
- `docs/design-system/COMPONENT_USAGE_GUIDELINES.md`.
- `docs/architecture/supabase-mvp-domain.md`.
- `README.md`.
- `/Users/antoniofelipe/Downloads/Match_TES_Relatorio_Tecnico_v1.pdf`.
- `/Users/antoniofelipe/Downloads/Processo_Financeiro_TES_Stripe_v2_Consolidado.pdf`.
- Codigo atual em `src/domain/tes`, `src/lib/routes.ts`, `src/lib/permissions.ts`, `supabase/migrations` e `supabase/functions/match-therapies`.

Observacao de Figma: a consulta ao node `12272:2` confirmou a existencia dos fluxos de Publico, Paciente, Terapeuta e Admin, incluindo catalogo/matching e financeiro/assinaturas no Admin.

## 3. Definicao do MVP

O MVP e uma plataforma transacional de descoberta, match, agendamento e contratacao de terapias online, com area logada para pacientes e area operacional para terapeutas.

Para pacientes, o MVP permite:

- descobrir terapias adequadas ao momento atual;
- buscar terapeutas;
- acessar paginas de terapias;
- consultar disponibilidade;
- escolher profissional, servico e horario;
- realizar cadastro ou login;
- preencher um pre-checkout curto;
- pagar uma sessao;
- acompanhar sessoes, favoritos, mensagens e configuracoes na area logada.

Para terapeutas, o MVP funciona como:

- canal de aquisicao de pacientes;
- perfil publico profissional;
- agenda;
- gestao de servicos;
- acompanhamento de pacientes e sessoes;
- mensagens estruturadas;
- financeiro;
- metricas, insights e recomendacoes deterministicas conforme plano.

Para Admin, o MVP precisa sustentar:

- curadoria de terapias;
- configuracao do Match;
- verificacao e moderacao de profissionais;
- acompanhamento de sessoes;
- pagamentos, repasses e assinaturas;
- suporte, seguranca e relatorios operacionais.

## 4. Principios obrigatorios do MVP

### 4.1 Produto transacional

O MVP deve permitir uma jornada real de contratacao:

```txt
Descoberta -> Match ou busca -> Terapia -> Terapeuta -> Horario -> Cadastro/Login -> Pre-checkout -> Pagamento -> Sessao -> Area logada
```

O pagamento real deve ser integrado ao Stripe. A sessao online deve usar Zoom via API/SDK, com criacao de reuniao apos confirmacao de pagamento.

### 4.2 Sem IA real no MVP

Match, insights, metricas prescritivas e Aura IA/Assessor IA devem ser determinísticos:

- regras;
- pesos;
- condicoes;
- relacoes cadastradas;
- agregacoes internas;
- logica previsivel e auditavel.

Nao usar IA generativa, modelo probabilistico externo ou OpenAI no MVP.

### 4.3 Catalogo controlado de terapias

O catalogo de terapias e fonte de verdade da oferta terapeutica. Terapeutas so podem publicar servicos associados a terapias previamente cadastradas e aprovadas pela plataforma.

Exemplo:

- plataforma possui Reiki e Aromaterapia;
- terapeuta trabalha com Reiki e outra terapia ainda nao cadastrada;
- ele pode publicar apenas Reiki;
- pode existir fluxo de solicitacao de nova terapia, sujeito a aprovacao.

### 4.4 Linguagem responsavel

A experiencia deve acolher sem prometer cura, diagnostico ou resultado garantido.

Evitar:

- "Essa terapia trata ansiedade."
- "Essa terapia cura bloqueios."
- "Essa terapia resolve sua vida financeira."
- "Conversao", "CTR", "lead", "funil" como linguagem de interface.

Preferir:

- "Pode apoiar processos de relaxamento e equilibrio emocional."
- "Pode auxiliar em momentos de clareza, reconexao e autoconhecimento."
- "Pessoas que viram seu perfil."
- "Pessoas que seguiram para agendar."

## 5. Stack e arquitetura alvo

### 5.1 Stack real identificada

- Next.js 15 com App Router.
- React 18.
- TypeScript strict.
- Tailwind CSS.
- CSS Variables TES em `src/app/globals.css`.
- shadcn/ui planejado via `components.json`.
- `lucide-react`, `class-variance-authority`, `clsx` e `tailwind-merge`.
- Supabase planejado e parcialmente estruturado em `supabase/`.
- Stripe Billing e Connect implementados com Gate F0 concluido; homologacao E2E
  externa permanece pendente.
- Zoom implementado como fundacao via Video SDK API credentials, Video SDK,
  inbox/outbox e webhook; homologacao de producao permanece pendente.

### 5.2 Backend recomendado

Backend principal:

- Supabase Postgres como banco transacional.
- Supabase Auth como origem de identidade.
- Row Level Security para isolamento de dados.
- Supabase Edge Functions para regras sensiveis e operacoes server-side.
- Webhooks Stripe para confirmacao de pagamentos, assinaturas, contas conectadas, reembolsos e disputas.
- Jobs assíncronos para conciliacao, taxas Stripe, repasses e reprocessamentos.

Camadas recomendadas:

```txt
Frontend Next.js
-> Server Actions / Route Handlers / Edge Functions
-> Services de dominio
-> Supabase Postgres + RLS
-> Stripe / ferramenta de video / observabilidade
```

### 5.3 Separacao de responsabilidades

Frontend:

- fluxo de descoberta;
- formularios;
- navegacao;
- estados visuais;
- telas publicas, paciente, terapeuta e admin;
- chamada a endpoints seguros.

Backend:

- validacao de disponibilidade;
- criacao de reserva;
- criacao de Checkout Stripe;
- confirmacao por webhook;
- calculo de match;
- calculo financeiro;
- elegibilidade de repasse;
- controle de permissao por plano;
- RLS e auditoria.

Admin:

- curadoria;
- publicacao de regras;
- acompanhamento operacional;
- resolucao de excecoes;
- conciliacao e repasses.

## 6. Perfis, planos e nomenclatura

Existe uma diferenca deliberada entre nomenclatura comercial/UX e identificadores tecnicos.

| Camada               | Plano 1            | Plano 2                 | Plano 3                          |
| -------------------- | ------------------ | ----------------------- | -------------------------------- |
| Nome comercial atual | Basico / Free      | Premium                 | Premium Plus                     |
| Alias legado         | `/basico/**`       | `/pro/**`               | `/plus/**`                       |
| Enum tecnico atual   | `free`             | `premium`               | `premium_plus`                   |
| Rotas canonicas      | `/terapeuta/**`    | `/terapeuta/**`         | `/terapeuta/**`                  |
| Papel                | Operacao essencial | Operacao + inteligencia | Operacao + inteligencia + gestao |

Regra: o codigo deve usar `free`, `premium`, `premium_plus`. A interface deve
tratar Premium e Premium Plus como nomes comerciais. Plano e capability
controlam acesso dentro de `/terapeuta/*`; a URL nao concede autorizacao.
`/basico/*`, `/pro/*` e `/plus/*` sao somente aliases temporarios.

As listas por plano nas secoes seguintes registram o inventario legado e as
capabilities esperadas. Novas rotas devem usar o namespace compartilhado.

## 7. Mapa funcional por perfil

### 7.1 Publico

Rotas canonicas:

- `/`
- `/como-funciona`
- `/sua-jornada`
- `/sua-jornada/resultado`
- `/terapias`
- `/terapias/:slug`
- `/terapeutas`
- `/terapeutas/:slug`
- `/reserva`
- `/reserva/sucesso`
- `/para-terapeutas`
- `/para-terapeutas/planos`
- `/entrar`
- `/cadastro`
- `/reset-senha`
- `/ajuda`
- `/termos`
- `/privacidade`

Fluxos principais:

- Jornada guiada: `/` -> `/como-funciona` -> `/sua-jornada` -> `/sua-jornada/resultado` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso` -> `/app`.
- Busca direta: `/` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso`.
- Terapias: `/` -> `/terapias` -> `/terapias/:slug` -> `/terapeutas`.
- Terapeutas visitantes: `/` -> `/para-terapeutas` -> `/para-terapeutas/planos`
  -> `/terapeuta/cadastro` -> `/terapeuta/login` -> `/terapeuta`.

### 7.2 Paciente

Area logada em `/app`.

Inclui:

- dashboard;
- sessoes proximas;
- historico;
- detalhe da sessao;
- mensagens com terapeuta;
- mensagens/suporte com plataforma;
- favoritos de terapeutas;
- favoritos de terapias;
- perfil e configuracoes;
- pagamentos, faturas e metodos conforme rota canonica atual.

Observacao: o escopo novo sugere que pagamentos do paciente podem ficar integrados a configuracoes/perfil. O sitemap atual possui `/app/pagamentos`, `/app/pagamentos/faturas` e `/app/pagamentos/metodos`. Decisao recomendada: manter as rotas tecnicas existentes por ora e permitir que a navegacao visual apresente pagamento dentro de Configuracoes, se o produto decidir simplificar a UI.

### 7.3 Terapeuta Free / Basico

Foco: operacao essencial.

Rotas:

- `/basico`
- `/basico/agenda`
- `/basico/pacientes`
- `/basico/sessoes`
- `/basico/mensagens`
- `/basico/servicos`
- `/basico/servicos/meus`
- `/basico/financeiro`
- `/basico/perfil`
- `/basico/upgrade`
- `/basico/configuracoes`
- `/basico/suporte`

Inclui:

- dashboard basico;
- agenda simples;
- pacientes simplificados;
- sessoes;
- mensagens;
- cadastro de servicos;
- financeiro basico;
- perfil publico;
- suporte;
- convites contextuais para upgrade.

Nao inclui:

- metricas avancadas;
- Aura completa;
- CRM completo;
- financeiro avancado;
- avaliacoes como modulo estrategico;
- gestao avancada.

### 7.4 Terapeuta Premium / Pro

Foco: operacao + inteligencia.

Rotas:

- `/pro`
- `/pro/agenda`
- `/pro/pacientes`
- `/pro/sessoes`
- `/pro/mensagens`
- `/pro/servicos`
- `/pro/financeiro`
- `/pro/metricas`
- `/pro/avaliacoes`
- `/pro/plano`
- `/pro/perfil`
- `/pro/configuracoes`
- `/pro/suporte`

Inclui recursos do Basico e adiciona:

- agenda avancada;
- financeiro completo para o nivel Pro;
- avaliacoes;
- metricas intermediarias;
- insights de agenda;
- Aura limitada conforme regra comercial;
- solicitacao de nova terapia.

Nao inclui:

- CRM completo;
- historico operacional Plus do paciente;
- Aura completa;
- ferramentas de gestao financeira mais profundas do Plus;
- suporte prioritario.

Regra financeira do Premium: o plano Premium deve exibir os mesmos dados financeiros essenciais do Premium Plus, como valor bruto, comissao, liquido, historico e status de repasses. O que escala no Premium Plus e a profundidade das ferramentas de gestao, como exportacoes avancadas, ajustes mais granulares, analises cruzadas com CRM e recursos futuros de gestao financeira.

### 7.5 Terapeuta Premium Plus / Plus

Foco: operacao + inteligencia + gestao.

Rotas:

- `/plus`
- `/plus/agenda`
- `/plus/pacientes`
- `/plus/pacientes/:slug-do-paciente`
- `/plus/sessoes`
- `/plus/mensagens`
- `/plus/servicos`
- `/plus/servicos/meus`
- `/plus/financeiro`
- `/plus/avaliacoes`
- `/plus/insights`
- `/plus/assessor-ia`
- `/plus/perfil`
- `/plus/configuracoes`
- `/plus/suporte`

Inclui:

- dashboard premium;
- agenda com sinais de demanda;
- pacientes com CRM completo;
- historico operacional do paciente;
- sessoes;
- mensagens estruturadas com apoio deterministico;
- servicos e terapias;
- avaliacoes avancadas;
- metricas e relatorios;
- Aura/Assessor IA completo, sem IA real;
- financeiro completo;
- suporte prioritario.

Regra: Plus nao exibe upgrade.

### 7.6 Admin

Rotas:

- `/admin`
- `/admin/profissionais`
- `/admin/profissionais/verificacoes`
- `/admin/pacientes`
- `/admin/sessoes`
- `/admin/pagamentos`
- `/admin/avaliacoes`
- `/admin/assinaturas`
- `/admin/terapias`
- `/admin/matching`
- `/admin/integracoes`
- `/admin/seguranca`
- `/admin/relatorios`
- `/admin/configuracoes`
- `/admin/suporte`

Responsabilidades:

- governanca;
- moderacao;
- catalogo de terapias;
- configuracao do matching;
- pagamentos e repasses;
- assinaturas;
- suporte;
- seguranca;
- relatorios.

## 8. Sistema de Match

### 8.1 Escopo do Match no MVP

O Match v1 recomenda terapias, nao terapeutas.

Status operacional atualizado: a jornada pública já usa temas e interesses, multiplicador de especificidade `1.4`, pesos versionados e somente a versão publicada de `matching_versions`. Este documento mantém decisões de arquitetura do MVP, mas o estado canônico atual está em `docs/product/integration-map.md`.

Ele deve:

- ser publico;
- ser anonimo;
- coletar selecao de 1 a 3 temas e até 3 interesses por tema;
- calcular compatibilidade entre necessidades e terapias;
- retornar terapias/caminhos recomendados;
- levar o usuario para pagina da terapia;
- permitir que a pagina da terapia apresente profissionais relacionados.

Ele nao deve:

- identificar quem respondeu;
- criar lead;
- salvar jornada individual;
- mostrar historico por pessoa;
- ranquear terapeutas;
- calcular score por terapeuta;
- usar reputacao, avaliacao ou disponibilidade do profissional no calculo;
- usar IA;
- aprender automaticamente com comportamento individual.

### 8.2 Fluxo publico do Match

```txt
Usuario acessa /sua-jornada
-> seleciona ate 3 temas
-> seleciona interesses opcionais dos temas escolhidos
-> clica em Ver caminhos
-> backend calcula compatibilidade via /api/public/matching/calculate
-> /sua-jornada/resultado exibe top terapias
-> usuario acessa /terapias/:slug
-> pagina mostra terapeutas associados
-> usuario escolhe terapeuta
-> segue para /reserva
```

### 8.3 Regras de selecao

| Criterio                     | Regra atual                    | Observação                                    |
| ---------------------------- | ------------------------------ | --------------------------------------------- |
| Minimo de temas              | 1                              | Validado no frontend e backend.               |
| Maximo de temas              | 3                              | Validado no frontend e backend.               |
| Minimo de interesses         | 0                              | Interesses são opcionais.                     |
| Maximo de interesses         | 3 por tema                     | Validado no backend.                          |
| Botao de resultado           | liberado com pelo menos 1 tema | Sem tema não calcula.                         |
| Multiplicador de interesses  | `1.4`                          | Interesse é mais específico que tema.         |
| Tabelas especificas de match | `matching_*`                   | Substituem o uso público de `therapy_themes`. |

Regra de linguagem: usar “Tema” e “Interesse” na UI; não usar “subtema”.

### 8.4 Matriz de compatibilidade

A configuracao principal e uma matriz administravel:

```txt
Terapia x Tema = Peso
Terapia x Interesse = Peso (Fase 2)
```

Escala recomendada:

| Peso | Significado         |
| ---: | ------------------- |
|    0 | Sem relacao         |
|    1 | Relacao muito baixa |
|    2 | Relacao baixa       |
|    3 | Relacao moderada    |
|    4 | Relacao alta        |
|    5 | Relacao maxima      |

O admin deve configurar pesos por terapia. Essa abordagem escala melhor que configurar tudo a partir de temas, porque o catalogo pode crescer.

### 8.5 Formula recomendada

```txt
score_bruto =
  soma dos pesos dos temas selecionados
  + soma dos pesos dos interesses selecionados * 1.4
```

O multiplicador `1.4` existe porque interesse é mais especifico que tema.

Normalizacao:

```txt
score_percentual =
  (score_bruto / maior_score_possivel_para_aquela_busca) * 100
```

Na UI publica, exibir faixas, nao porcentagem exata:

|        Score | Label publico              |
| -----------: | -------------------------- |
|       85-100 | Alta aderencia             |
|        65-84 | Boa aderencia              |
|        45-64 | Pode fazer sentido         |
| Abaixo de 45 | Nao exibir, salvo fallback |

### 8.6 Elegibilidade de terapias

Uma terapia so pode aparecer no resultado se:

- estiver ativa/publicada;
- estar com `therapies.status = 'published'`;
- possuir pagina publica;
- estar marcada como visivel em `matching_therapy_settings`;
- possuir pesos ativos na versao publicada.

`active` não é o estado editorial público do catálogo. Para o Match, a ativação é controlada por `matching_therapy_settings.is_visible_in_matching`, sempre condicionada à terapia publicada.

### 8.7 Quantidade de resultados e fallback

Regra recomendada:

- desktop: ate 5 terapias;
- mobile: ate 3 principais + acao "Ver mais caminhos";
- score minimo: 45%;
- nunca retornar tela vazia.

Fallback:

- se nenhuma terapia atingir 45%, reduzir o limiar apenas para aquela resposta;
- mostrar as 3 terapias com maior score relativo;
- exibir mensagem honesta:

```txt
Nao encontramos uma correspondencia forte para essa combinacao, mas estes caminhos podem servir como ponto de partida.
```

### 8.8 Administracao do Matching

Area Admin recomendada: `/admin/matching`.

Visao geral:

- temas ativos;
- interesses ativos, quando a Fase 2 estiver habilitada;
- terapias sincronizadas;
- matchings no mes;
- metricas anonimas;
- configuracao publicada;
- atalhos de gerenciamento.

Compatibilidade por terapia:

```txt
Admin acessa Matching
-> escolhe modo Por terapia
-> seleciona uma terapia
-> edita pesos de temas
-> salva rascunho
-> publica nova versao
```

Admin atual/futuro deve permitir editar pesos de temas e interesses em uma versão de rascunho antes de publicar.

### 8.9 Dados recomendados para o Match

O schema legado inicial possuia, apenas para compatibilidade histórica:

- `therapies`;
- `therapy_themes`;
- `therapy_theme_weights`;
- Edge Function `match-therapies`.

O estado atual evoluiu para:

- `matching_themes`;
- `matching_interests`;
- `matching_versions`;
- `matching_weights`;
- `matching_therapy_settings`;
- `matching_weights`;
- `matching_versions`;
- `matching_weight_versions`;
- `matching_aggregate_metrics`.

Decisao recomendada para evolucao:

1. Manter `therapies` como fonte unica de terapias.
2. Evitar duplicar terapia no modulo Matching.
3. Adicionar versionamento antes de permitir edicao admin em producao.
4. Adicionar metricas anonimas agregadas.
5. Fechar pesos por RLS e calcular em Edge Function/server.

Decisao Fase 1: nao criar UI publica de interesses enquanto `matching_interests` e seus pesos nao existirem. Se produto exigir temas + interesses ja no lancamento, `matching_interests`, vinculos e pesos por interesse devem ser promovidos para Fase 1 junto com a tela adicional do fluxo publico.

### 8.10 APIs recomendadas do Match

Publicas:

```txt
GET /api/public/matching/config
POST /api/public/matching/calculate
```

Payload:

```json
{
  "themeIds": ["uuid"]
}
```

Na Fase 2, o payload passa a aceitar tambem `interestIds`.

Resposta:

```json
{
  "version": "1.3",
  "results": [
    {
      "therapyId": "uuid",
      "name": "Reiki",
      "slug": "reiki",
      "score": 92,
      "label": "Alta aderencia",
      "explanation": "Pode apoiar equilibrio energetico, relaxamento e clareza emocional.",
      "imageUrl": "/images/reiki.jpg"
    }
  ]
}
```

Admin:

```txt
GET /api/admin/matching/overview
GET /api/admin/matching/therapies
GET /api/admin/matching/therapies/:therapyId/weights
PATCH /api/admin/matching/therapies/:therapyId/weights
POST /api/admin/matching/publish
GET /api/admin/matching/versions
GET /api/admin/matching/metrics
```

### 8.11 Privacidade do Match

Podem ser salvos apenas dados agregados:

- total de matchings no mes;
- temas mais selecionados;
- interesses mais selecionados, quando existirem na Fase 2;
- terapias mais recomendadas.

Nao salvar:

- nome;
- e-mail;
- telefone;
- IP visivel no painel;
- identificador de usuario;
- combinacao individual persistida;
- historico de respostas por pessoa.

Aviso publico recomendado:

```txt
O Match oferece sugestoes de caminhos terapeuticos com base nas opcoes selecionadas. Nao e diagnostico, tratamento medico nem promessa de resultado.
```

## 9. Jornada transacional do paciente

### 9.1 Fluxo principal

```txt
1. Descoberta
2. Match, terapia ou busca direta
3. Escolha de terapeuta
4. Escolha de servico
5. Escolha de horario
6. Login ou cadastro
7. Pre-checkout
8. Pagamento Stripe
9. Confirmacao da sessao
10. Acompanhamento em /app
```

### 9.2 Reserva

O fluxo `/reserva` deve consolidar:

- servico escolhido;
- terapeuta;
- terapia;
- duracao;
- preco;
- horario;
- autenticacao;
- intake curto;
- politica de cancelamento;
- pagamento;
- resumo final.

Regras:

- horario precisa ser revalidado no backend antes do pagamento;
- reserva deve ter estado `pending_payment` antes do pagamento;
- `gross_amount` e `duration_minutes` devem ser gravados como snapshot no momento da criacao da reserva;
- se o terapeuta editar preco ou duracao do servico depois da reserva, o valor e a duracao da reserva existente nao podem mudar;
- pagamento confirmado por webhook muda sessao para confirmada/paga;
- redirecionamento do Stripe nao pode ser fonte unica de verdade.

### 9.3 Pre-checkout

Campos recomendados:

- objetivo da sessao;
- expectativa;
- contexto inicial relevante;
- aceite/confirmacao sobre dados sensiveis.

Regras de seguranca:

- pedir apenas o minimo necessario;
- orientar o paciente a nao compartilhar informacoes clinicas excessivas;
- tratar `initial_context` como potencial dado sensivel;
- nao registrar conteudo sensivel em logs.

### 9.4 Sessao online

O modelo de dados atual suporta:

- `video_sessions`;
- `video_sessions`;
- `zoom_video_webhook_events`;
- `video_session_participations`;
- views seguras por papel;
- `meeting_provider` e `meeting_url` apenas como compatibilidade legada.

Ferramenta definida para o MVP: Zoom via API/SDK.

Estado implementado:

- usar Video SDK API credentials da Zoom;
- enfileirar a reuniao apenas depois de pagamento confirmado pelo webhook
  Stripe;
- manter `meeting_provider = 'zoom'`;
- gerar payload Video SDK no backend conforme booking, papel e janela;
- solicitar Video SDK token somente para o terapeuta responsavel e nao persisti-lo;
- nao persistir `video_session_secret_url_removed` no fluxo atual;
- manter `bookings.meeting_url` fora da fonte canonica;
- registrar somente eventos operacionais, sem conteudo clinico.

Pendencias de producao:

- bloquear terapeuta suspenso/rejeitado;
- validar o pagamento canonico tambem no gate de acesso;
- definir topologia de hosts licenciados e concorrencia;
- homologar Video SDK token, cron, webhook remoto e scopes do Marketplace;
- criar pgTAP especifico para RLS Zoom.

## 10. Area logada do paciente

### 10.1 Dashboard

Deve mostrar:

- proxima sessao;
- atalhos para sessoes;
- favoritos;
- suporte;
- recomendacoes de continuidade sem pressao.

### 10.2 Sessoes

Deve permitir:

- visualizar proximas sessoes;
- consultar historico;
- abrir detalhe;
- acessar link da sessao;
- consultar status de pagamento;
- pedir suporte;
- avaliar sessao quando concluida, se habilitado.

### 10.3 Mensagens

Dois contextos:

- paciente com terapeuta;
- paciente com plataforma/suporte.

Recomendacao para MVP:

- usar mensagens predefinidas;
- respostas rapidas;
- fluxos controlados;
- chat livre limitado ou adiado;
- historico vinculado a reserva quando aplicavel.

### 10.4 Favoritos

Favoritos separados:

- terapeutas favoritos;
- terapias favoritas.

O schema atual possui `favorite_therapists`. Favoritos de terapias aparecem no sitemap e inventario, mas tabela especifica de `favorite_therapies` nao foi identificada no schema atual.

Decisao recomendada: criar `favorite_therapies` espelhando `favorite_therapists`, com `patient_profile_id`, `therapy_id`, `created_at` e constraint unica por par.

### 10.5 Configuracoes e pagamentos

Configuracoes:

- dados pessoais;
- notificacoes;
- privacidade;
- seguranca;
- preferencias.

Pagamentos:

- comprovantes;
- metodos;
- historico;
- reembolsos.

A decisao de agrupar pagamentos dentro de Configuracoes ou manter rota propria deve ser tomada na camada de UX. Tecnicamente, as rotas atuais existem em `/app/pagamentos`.

## 11. Area do terapeuta

### 11.1 Agenda

Funcionalidades:

- blocos de disponibilidade semanal;
- excecoes por data;
- bloqueios;
- validacao de conflito;
- indisponibilidade temporaria;
- conexao com servicos.

Dados atuais:

- `availability_rules`;
- `availability_exceptions`;
- `bookings`.

Regras:

- criacao de disponibilidade deve validar intervalo;
- agendamento deve bloquear conflitos;
- geracao de slots deve respeitar `duration_minutes` do servico escolhido, nao um grid fixo universal;
- timezone padrao atual: `America/Sao_Paulo`;
- disponibilidade publica deve considerar servico ativo e terapeuta aprovado.

### 11.2 Pacientes / CRM

Free/Basico:

- lista simplificada;
- acesso operacional a sessoes e mensagens.

Premium/Pro:

- relacionamento intermediario;
- indicadores simples;
- filtros e historico operacional limitado.

Premium Plus/Plus:

- CRM completo;
- historico operacional em `/plus/pacientes/:slug-do-paciente`;
- sinais de retorno;
- alertas;
- memoria operacional, sem virar prontuario clinico formal.

### 11.3 Sessoes

Estados recomendados:

- `draft`;
- `pending_payment`;
- `confirmed`;
- `completed`;
- `cancelled_by_patient`;
- `cancelled_by_therapist`;
- `no_show_patient`;
- `no_show_therapist`;
- `refunded`.

Regras:

- sessao so fica confirmada apos pagamento confirmado;
- sessao concluida pode habilitar avaliacao;
- cancelamentos e reembolsos precisam seguir politica clara;
- mudancas criticas devem ser auditaveis.

### 11.4 Servicos / Terapias

O terapeuta cadastra servicos vinculados a terapias do catalogo.

Campos:

- terapia;
- titulo;
- descricao;
- duracao;
- preco;
- moeda;
- status;
- formato online.

Duracoes permitidas no escopo: 50 minutos, 60 minutos ou outro periodo permitido.

Regras de Fase 1:

- terapeuta pode definir preco e duracao por servico/terapia;
- Stripe Checkout aceita valor dinamico por sessao, portanto preco variavel por servico nao bloqueia a integracao;
- a plataforma deve definir preco minimo de servico para evitar margem negativa depois da taxa Stripe;
- recomendacao inicial: preco minimo de plataforma de R$ 50, sujeito a validacao financeira;
- o preco minimo deve considerar comissao, taxa fixa, taxa percentual e margem de seguranca;
- duracao variavel exige que `AvailabilityService` gere slots conforme a duracao do servico;
- `gross_amount` e `duration_minutes` devem ser copiados para a reserva/pagamento como snapshot no momento da reserva.

Faixas finais de duracao permitida acima do minimo operacional: Nao identificado nos arquivos analisados.

### 11.5 Avaliacoes

Funcoes:

- visualizar avaliacoes;
- acompanhar feedback;
- responder quando permitido;
- entender percepcao dos pacientes.

Regras:

- publicar somente avaliacoes moderadas;
- evitar expor dados sensiveis;
- permitir ocultacao/remocao por Admin;
- status textual sempre visivel.

### 11.6 Metricas e Relatorios

Papel: descritivo e analitico.

Mostra o que aconteceu:

- terapia mais procurada;
- horario com maior procura;
- vacancia;
- ocupacao;
- sessoes realizadas;
- receita bruta gerada;
- repasses;
- origem de interesse no perfil;
- avaliacoes e padroes.

Nao deve ser o principal ambiente de recomendacoes prescritivas.

### 11.7 Aura IA / Assessor IA

Papel: prescritivo.

Sugere o que fazer com base em regras:

- abrir mais horarios em periodos de maior procura;
- revisar disponibilidade;
- melhorar descricao de servico;
- explorar terapia com demanda;
- revisar perfil publico;
- acompanhar paciente com baixa recorrencia.

Regras:

- sem IA real no MVP;
- sugestoes devem ser explicaveis;
- usuario revisa antes de aplicar;
- nao prometer ganho financeiro;
- nao usar urgencia artificial.

## 12. Financeiro com Stripe

### 12.1 Decisao financeira central

A TES absorve as taxas Stripe.

Consequencias:

- terapeuta recebe percentual combinado sobre o valor bruto da sessao;
- taxa Stripe reduz margem da plataforma;
- backend precisa registrar valor bruto, comissao, taxa Stripe, valor liquido da plataforma e valor a repassar.

Exemplo:

| Item                  |                  Valor |
| --------------------- | ---------------------: |
| Sessao                |              R$ 200,00 |
| Comissao TES 15%      |               R$ 30,00 |
| Repasse terapeuta 85% |              R$ 170,00 |
| Taxa Stripe           |              custo TES |
| Resultado liquido TES | R$ 30,00 - taxa Stripe |

Regra: `stripe_fee_amount` nunca reduz `therapist_net_amount`.

### 12.2 Produtos Stripe

Stripe Billing:

- assinaturas dos terapeutas;
- planos pagos;
- invoices;
- status de assinatura;
- falhas de pagamento.

Stripe Connect Express:

- conta de recebimento do terapeuta;
- onboarding seguro;
- status `details_submitted`, `charges_enabled`, `payouts_enabled`;
- pendencias em `requirements_due`.

Separate Charges and Transfers:

- cliente paga a plataforma;
- valor entra na conta Stripe da TES;
- TES calcula comissao e repasse;
- transferencia posterior para conta conectada do terapeuta.

### 12.3 Fluxo de pagamento de sessao

```txt
Paciente escolhe terapia, terapeuta, servico e horario
-> backend cria booking pending_payment
-> backend cria Stripe Checkout
-> paciente paga
-> Stripe envia webhook
-> backend marca pagamento como paid
-> booking fica confirmed
-> sessao acontece
-> booking completed
-> pagamento entra em elegibilidade de repasse
-> lote quinzenal cria transfer
-> Stripe envia para conta conectada
-> Stripe faz payout para banco do terapeuta
```

Fonte de verdade de pagamento: webhook Stripe, nao redirect.

### 12.4 Metadados recomendados no Stripe

Usar metadata minima:

- `session_id`;
- `client_id`;
- `therapist_id`;
- `therapy_id`;
- `gross_amount`;
- `commission_rate`;
- `payment_type=session`.

Nao colocar dados sensiveis em metadata.

### 12.5 Regras de comissao

Recomendacao para MVP:

- comissao fixa da plataforma: 15%;
- base de calculo: valor bruto da sessao;
- taxa Stripe: absorvida pela TES;
- repasse terapeuta: 85% do valor bruto.

Valores futuros por plano, terapia ou campanha: fora de escopo do MVP.

### 12.6 Elegibilidade de repasse

Uma sessao so vira elegivel quando:

- `payment_status = paid`;
- `session_status = completed`;
- Balance Transaction associada esta `available`;
- `transfer_status = pending`;
- sem refund pendente;
- sem disputa aberta;
- conta do terapeuta com `payouts_enabled = true`.

Regra importante: nao basta o pagamento estar `paid`. O saldo precisa estar disponivel no Stripe para evitar falha por `insufficient_funds`.

### 12.7 Ciclo de repasse

Recomendacao inicial: repasse quinzenal.

Fluxo:

```txt
Admin acessa pagamentos/repasses
-> sistema lista sessoes elegiveis
-> gera payout_batch
-> agrupa por terapeuta
-> cria payout_batch_items
-> processa transfers no Stripe
-> registra ledger
-> trata falhas e retries
```

Termos de uso devem deixar claro que o repasse quinzenal abrange sessoes ja liquidadas pelo sistema bancario e disponiveis no Stripe.

### 12.8 Transfer vs payout

Separacao conceitual obrigatoria:

- Transfer: plataforma TES -> conta conectada Stripe do terapeuta.
- Payout: conta Stripe do terapeuta -> banco do terapeuta.

Na UI, pode aparecer como "Repasse enviado para conta de recebimento", mas a arquitetura deve distinguir os dois eventos.

### 12.9 Assinaturas de terapeutas

Planos pagos usam Stripe Billing.

Eventos principais:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `customer.subscription.created`;
- `customer.subscription.updated`;
- `customer.subscription.deleted`;
- `invoice.paid`;
- `invoice.payment_failed`.

Regra de inadimplencia:

- falha de assinatura pode bloquear novos agendamentos;
- nao deve bloquear nem reter repasse de sessoes ja realizadas e pagas por pacientes.

### 12.10 Tabelas financeiras recomendadas

O schema atual possui `payments`, mas a decisao consolidada e migrar para `session_payments` como unica fonte de verdade de pagamento de sessoes ja na Fase 1.

Regra de transicao:

- criar `session_payments` com schema completo;
- se existirem dados em `payments`, migrar registros equivalentes para `session_payments`;
- nao manter `payments` e `session_payments` como fontes paralelas;
- se necessario, manter `payments` temporariamente como view somente leitura durante a transicao;
- qualquer codigo novo de Fase 1 em diante deve ler e escrever apenas em `session_payments`.

Tabelas financeiras obrigatorias no alvo:

- `therapist_connect_accounts`;
- `therapist_subscriptions`;
- `session_payments`;
- `financial_ledger_entries`;
- `payout_batches`;
- `payout_batch_items`;
- `stripe_webhook_events`.

`payout_batch_items.session_payment_id` liga diretamente cada item de repasse
ao pagamento de sessão; não existe tabela intermediária
`transfer_batch_item_sessions`.

Campos importantes em `session_payments`:

- `payment_method_type`;
- `gross_amount`;
- `commission_rate`;
- `commission_amount`;
- `therapist_net_amount`;
- `stripe_fee_amount`;
- `platform_net_amount`;
- `payment_status`;
- `transfer_status`;
- `chargeback_amount`;
- `disputed_at`;
- `eligible_for_transfer_at`.

Campos adicionais recomendados para snapshot da reserva:

- `duration_minutes`;
- `gross_amount`;
- `service_price_snapshot_cents`, se o time preferir separar do valor cobrado final;
- `service_title_snapshot`, se a exibicao historica depender do nome do servico no momento da compra.

### 12.11 Ledger financeiro

Ledger interno e obrigatorio para rastreabilidade.

Exemplo para sessao de R$ 200:

```txt
+20000 payment_received
-3000 platform_commission_recognized
-17000 therapist_payable_created
-XXX stripe_fee_expense
```

O ledger deve separar:

- entrada bruta;
- comissao da plataforma;
- obrigacao de repasse;
- taxa Stripe como despesa;
- repasse realizado;
- estorno;
- disputa;
- ajuste negativo.

### 12.12 Webhooks Stripe

Eventos recomendados:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `payment_intent.processing`;
- `payment_intent.succeeded`;
- `payment_intent.payment_failed`;
- `charge.refunded`;
- `refund.created`;
- `refund.updated`;
- `refund.failed`;
- `charge.dispute.created`;
- `account.updated` e eventos thin `v2.core.account*`;
- `transfer.updated`;
- `transfer.reversed`;
- `balance_transaction.updated`;
- `invoice.paid`;
- `invoice.payment_failed`;
- `customer.subscription.updated`;
- `customer.subscription.deleted`.

Regras:

- armazenar cada evento em `stripe_webhook_events`;
- deduplicar por `stripe_event_id`;
- usar idempotencia em operacoes POST;
- nao confiar em ordem perfeita dos webhooks;
- processar taxa Stripe de forma assíncrona quando necessario.

### 12.13 APIs financeiras recomendadas

Sessao:

```txt
POST /api/sessions/:sessionId/pay
GET /api/sessions/:sessionId/payment-status
```

Conta de recebimento:

```txt
POST /api/therapist/receiving-account/onboarding
GET /api/therapist/receiving-account/status
```

Admin:

```txt
GET /api/admin/payments/overview
GET /api/admin/payments/transactions
GET /api/admin/transfers/eligible
POST /api/admin/transfers/batches
POST /api/admin/transfers/batches/:batchId/process
POST /api/admin/transfers/batches/:batchId/retry-failed
```

Webhook:

```txt
POST /api/webhooks/stripe
```

### 12.14 Riscos financeiros criticos

| Risco                                   | Impacto                                  | Mitigacao                                                                                    |
| --------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Liquidez T+14/T+30 vs repasse quinzenal | transfer falha por saldo insuficiente    | elegibilidade apenas com Balance Transaction `available`; termos claros; avaliar antecipacao |
| Compressao de margem                    | taxa Stripe consome margem da TES        | restringir Checkout a cartao 1x e Pix; cobrar parcelamento do cliente se habilitado          |
| Margem negativa em preco muito baixo    | `platform_net_amount` fica negativo      | definir preco minimo de plataforma e validar no cadastro do servico                          |
| Chargeback apos repasse                 | perda financeira da TES                  | clearance period para contas novas; fundo de reserva; ajustes negativos                      |
| Taxa Stripe assíncrona                  | webhook nao traz fee final imediatamente | confirmar sessao sem travar; enriquecer taxa via job ou `balance_transaction.updated`        |
| Lote parcialmente falho                 | terapeuta fica sem repasse ou rastreio   | DLQ/retry por item; status `partially_failed`; alertas                                       |
| Double-spending                         | mesma sessao transferida duas vezes      | transacao ACID e `SELECT ... FOR UPDATE` em pagamentos elegiveis                             |
| Conta Connect restrita                  | repasse elegivel mas Stripe bloqueia     | `account.updated` bloqueia transferencias e alerta terapeuta/admin                           |
| Inadimplencia de assinatura             | bloqueio indevido de dinheiro ja ganho   | bloquear novos agendamentos, nao reter repasses de sessoes realizadas                        |

### 12.15 Como mostrar financeiro na UI

Admin:

- receita de assinaturas;
- volume bruto de sessoes;
- comissao da plataforma;
- taxas Stripe absorvidas;
- valor a repassar;
- valor ja repassado;
- repasses pendentes;
- lotes e falhas.

Terapeuta:

- sessoes realizadas;
- valor bruto gerado;
- comissao da plataforma;
- valor liquido a receber;
- proximo repasse;
- historico de repasses;
- conta de recebimento.

Nao mostrar taxa Stripe como desconto do terapeuta, pois ela e absorvida pela plataforma.

## 13. Modelo de dados consolidado

### 13.1 Dominio base atual

Ja existe proposta/migracao inicial para:

- `profiles`;
- `patient_profiles`;
- `therapist_profiles`;
- `therapist_verifications`;
- `therapy_categories`;
- `therapies`;
- `therapy_themes` (legado histórico);
- `therapy_theme_weights` (legado histórico);
- `therapist_services`;
- `availability_rules`;
- `availability_exceptions`;
- `bookings`;
- `pre_checkout_intakes`;
- `favorite_therapists`;
- `message_templates`;
- `structured_messages`;
- `reviews`;
- `aura_recommendations`;
- `support_tickets`.

Observacao: `payments` existe no desenho inicial do dominio, mas nao deve ser levado adiante como fonte de verdade de sessoes pagas. O alvo de Fase 1 deve usar `session_payments`.

### 13.2 Lacunas de dados para o alvo consolidado

Para alinhar completamente com os PDFs, ainda faltam ou precisam evoluir:

- versionamento do Match;
- configuracao especifica de visibilidade no Matching;
- metricas agregadas anonimas do Match;
- interesses globais reutilizaveis por tema;
- `favorite_therapies`;
- `session_payments` como substituto de `payments`;
- tabelas financeiras completas de Fase 1;
- ledger de pagamentos;
- lotes de repasse;
- eventos Stripe;
- contas Connect;
- assinaturas Billing;
- estados de disputa/chargeback mais completos;
- politicas finas de RLS para operacoes logadas.

## 14. Servicos de backend recomendados

### 14.1 Produto e catalogo

`TherapyCatalogService`:

- listar terapias publicas;
- obter detalhe;
- validar status;
- associar terapeutas;
- apoiar SEO e conteudo publico.

`TherapistProfileService`:

- perfil publico;
- status de verificacao;
- publicacao;
- disponibilidade para agendamento;
- dados seguros por view.

### 14.2 Match

`MatchingConfigService`:

- entregar configuracao publica;
- listar temas ativos e, na Fase 2, interesses ativos;
- expor versao publicada.

`MatchingCalculationService`:

- validar selecao;
- buscar pesos da versao publicada;
- calcular score;
- aplicar fallback;
- retornar resultado.

`MatchingAdminService`:

- editar pesos;
- salvar rascunho;
- publicar versao;
- historico.

`MatchingMetricsService`:

- registrar metricas agregadas anonimas;
- evitar identificacao individual.

### 14.3 Reserva e sessoes

`AvailabilityService`:

- calcular slots;
- validar conflito;
- aplicar excecoes;
- considerar timezone.

`BookingService`:

- criar reserva;
- segurar horario por janela curta;
- confirmar apos pagamento;
- cancelar/remarcar conforme politica.

`SessionService`:

- detalhe da sessao;
- link online;
- conclusao;
- no-show;
- avaliacao.

### 14.4 Financeiro

`StripeBillingService`:

- checkout de assinatura;
- sincronizacao de plano;
- faturas;
- falhas;
- cancelamento.

`StripeConnectService`:

- criar conta Express;
- criar account link;
- consultar status;
- tratar `account.updated` e eventos thin `v2.core.account*`.

`SessionPaymentService`:

- checkout da sessao;
- registro de pagamento;
- comissao;
- taxa Stripe;
- elegibilidade.

`TransferBatchService`:

- listar elegiveis;
- gerar lote;
- criar transfers;
- retry;
- status parcial.

`LedgerService`:

- lancamentos contabeis internos;
- estornos;
- disputas;
- repasses;
- conciliacao.

`StripeWebhookService`:

- idempotencia;
- roteamento por tipo;
- persistencia do evento;
- retries seguros.

### 14.5 Aura e insights

`RulesInsightService`:

- sinais de agenda;
- vacancia;
- horarios procurados;
- terapia com demanda;
- recomendacoes por plano.

`AuraRecommendationService`:

- gerar recomendacoes deterministicas;
- gravar contexto;
- controlar prioridade e expiracao;
- aplicar permissao por plano.

## 15. Permissoes por plano

Capabilities tecnicas atuais:

- `operation_essentials`;
- `advanced_metrics`;
- `aura_limited`;
- `aura_full`;
- `full_crm`;
- `strategic_reviews`;
- `advanced_financials`;
- `agenda_insights`;
- `request_new_therapy`.

Mapa recomendado:

| Capability              | Free/Basico     | Premium/Pro                | Premium Plus/Plus |
| ----------------------- | --------------- | -------------------------- | ----------------- |
| Operacao essencial      | Sim             | Sim                        | Sim               |
| Agenda                  | Sim             | Sim                        | Sim               |
| Sessoes                 | Sim             | Sim                        | Sim               |
| Mensagens               | Sim             | Sim                        | Sim               |
| Servicos                | Sim             | Sim                        | Sim               |
| Pacientes               | Basico          | Intermediario              | CRM completo      |
| Insights de agenda      | Nao ou minimo   | Sim                        | Sim               |
| Metricas                | Nao             | Intermediarias             | Completas         |
| Avaliacoes estrategicas | Nao             | Limitado ou Pro            | Sim               |
| Aura                    | Nao             | Limitada                   | Completa          |
| Financeiro              | Basico          | Intermediario/completo Pro | Completo Plus     |
| Gestao avancada         | Nao             | Nao                        | Sim               |
| Solicitar nova terapia  | Nao ou limitado | Sim                        | Sim               |

Observacao: o codigo atual permite `request_new_therapy` a partir de Premium.

## 16. Regras de seguranca, LGPD e privacidade

### 16.1 Dados sensiveis

Tratar como potencialmente sensiveis:

- respostas de Match, se individualizadas;
- pre-checkout;
- mensagens;
- avaliacoes;
- suporte;
- historico de sessoes;
- observacoes operacionais;
- documentos de verificacao;
- dados financeiros.

### 16.2 Minimizacao

Regras:

- coletar apenas o necessario;
- evitar historico individual do Match no MVP;
- nao registrar payloads sensiveis em logs;
- nao expor pesos internos do matching no cliente;
- separar dados publicos de dados operacionais;
- usar views ou Edge Functions para perfil publico.

### 16.3 Consentimento e retencao

Pontos pendentes:

- prazo de retencao das respostas do Match;
- uso de dados agregados para pesquisa de mercado;
- politica de dados sensiveis;
- prazo de retencao de intakes, mensagens, suporte e avaliacoes.

Status: Nao identificado nos arquivos analisados.

### 16.4 RLS

Diretrizes:

- paciente le apenas seus dados;
- terapeuta le apenas dados relacionados a sua operacao;
- admin acessa por policies especificas;
- pesos de match ficam fechados para anon/authenticated;
- pagamentos e ledger devem ser fechados por padrao;
- `video_session_secret_url_removed` e Video SDK token nao devem ser persistidos no fluxo Zoom atual;
- dados seguros da sala usam views por papel e o payload Video SDK usa
  autorizacao backend por booking;
- qualquer persistencia futura de credencial de host exige criptografia
  versionada e nenhuma leitura autenticada direta;
- webhooks usam service role somente no servidor.

## 17. Estados e maquinas de estado

### 17.1 Booking

```txt
draft
-> pending_payment
-> confirmed
-> completed
```

Cancelamentos:

```txt
confirmed -> cancelled_by_patient
confirmed -> cancelled_by_therapist
confirmed -> no_show_patient
confirmed -> no_show_therapist
confirmed/completed -> refunded
```

### 17.2 Pagamento de sessao

```txt
not_started
-> pending
-> paid
-> refunded
```

Alternativas:

```txt
pending -> failed
paid -> partially_refunded
paid -> disputed
paid -> cancelled/reversed conforme modelo financeiro futuro
```

O enum atual nao possui `disputed`, `reversed` ou `blocked`. Recomendacao: adicionar estados financeiros separados em `session_payments.transfer_status` em vez de sobrecarregar `payments.status`.

### 17.3 Repasse

```txt
not_eligible
-> pending
-> eligible
-> batched
-> transferred
```

Falhas:

```txt
eligible/batched -> failed
failed -> pending retry
failed -> blocked
transferred -> reversed
```

## 18. Observabilidade e auditoria

Recomendado para producao:

- logs estruturados sem dados sensiveis;
- tabela de eventos Stripe;
- ledger imutavel ou append-only;
- auditoria de alteracoes admin;
- historico de versoes do Match;
- monitoramento de webhooks falhos;
- alerta de conta Connect restrita;
- alerta de lote parcialmente falho;
- rotina diaria de conciliacao;
- trilha de publicacao de pesos do matching.

Ferramenta de observabilidade definitiva: Nao identificado nos arquivos analisados.

## 19. Backlog tecnico por fase

### 19.1 Fase 1 - MVP transacional minimo

- Confirmar rotas canonicas em `src/lib/routes.ts`.
- Implementar fluxo publico de descoberta.
- Implementar Match deterministico por terapia apenas com temas.
- Implementar paginas de terapia e terapeuta.
- Implementar reserva com validacao de disponibilidade.
- Gerar slots de agenda conforme `duration_minutes` do servico escolhido.
- Validar preco minimo de servico para proteger margem da plataforma.
- Gravar snapshot de `gross_amount` e `duration_minutes` no momento da reserva.
- Implementar cadastro/login com Supabase Auth.
- Implementar pre-checkout.
- Implementar Stripe Checkout de sessao.
- Implementar webhook Stripe minimo.
- Confirmar sessao apos pagamento.
- Preservar a fundacao Zoom ja implementada apos confirmacao do pagamento.
- Fechar os gates de producao Zoom descritos em
  `docs/zoom/production-readiness.md`.
- Exibir sessao em `/app`.
- Implementar servicos de terapeuta vinculados ao catalogo.
- Criar `favorite_therapies` espelhando `favorite_therapists`.
- Criar `session_payments` como unica fonte de verdade para pagamentos de sessoes.
- Migrar ou substituir `payments`, evitando duas fontes paralelas.
- Usar `financial_ledger_entries` como ledger append-only.
- Usar `therapist_connect_accounts` para a conta Connect do terapeuta.
- Usar `payout_batches` e `payout_batch_items`.
- Implementar repasse manual via Admin no inicio, usando as tabelas definitivas.
- Exibir financeiro basico do terapeuta com valor bruto, comissao, liquido, status e historico de repasses.

### 19.2 Fase 2 - Robustez operacional

- Consolidar Admin de pesos e publicacao do Match.
- Metricas anonimas agregadas.
- Billing de assinaturas.
- Automatizacao do processamento de lotes de repasse.
- Reconciliacao.
- Politicas de cancelamento e reembolso.
- Mensagens estruturadas.
- Avaliacoes moderadas.

### 19.3 Fase 3 - Inteligencia deterministica e gestao

- Aura completa por regras.
- Insights de agenda.
- CRM Plus completo.
- Metricas e relatorios completos.
- Simulador interno do Match.
- Comparacao entre versoes do Match.
- Ranking futuro de terapeutas dentro de terapia, se aprovado.
- Entidade Oferta, se necessario.

## 20. Fora de escopo do MVP

- IA generativa real.
- Ranking de terapeutas pelo Match v1.
- Score por oferta.
- Reputacao no calculo de Match v1.
- Feedback pos-sessao influenciando Match v1.
- Personalizacao por usuario.
- Historico individual de respostas do Match.
- Split automatico imediato.
- Antecipacao de recebiveis.
- Multiplas comissoes por terapia.
- Comissoes por plano.
- Carteira interna do terapeuta.
- Repasse manual via Pix fora do Stripe.
- Nota fiscal automatica.
- Conciliacao bancaria externa.
- Reembolso parcial complexo por regra dinamica.
- Chat livre complexo.
- Prontuario clinico formal.

## 21. Criterios de pronto

Uma entrega do MVP so deve ser considerada pronta quando:

- respeitar `src/lib/routes.ts`;
- respeitar `src/lib/permissions.ts`;
- usar tokens TES;
- seguir linguagem acolhedora e responsavel;
- nao prometer cura, diagnostico ou resultado;
- nao expor segredos;
- nao salvar dados individualizados do Match sem decisao LGPD;
- validar pagamento por webhook;
- usar idempotencia em Stripe;
- usar `session_payments` como fonte unica de pagamento de sessoes;
- registrar ledger para movimentacoes financeiras;
- criar repasses a partir de `payout_batches` e `payout_batch_items`;
- gravar snapshot de preco e duracao no momento da reserva;
- gerar link Zoom apenas apos pagamento confirmado;
- proteger `video_session_secret_url_removed` da Zoom por regra de acesso;
- proteger dados por RLS;
- passar em `npm run typecheck`;
- passar em `npm run lint`;
- passar em `npm run build`;
- documentar limitacoes e riscos.

## 22. Decisoes em aberto

- Politica de cancelamento.
- Politica de reembolso e prazo maximo.
- Clearance period exato para contas novas.
- Regras finais de parcelamento.
- Valores dos planos de assinatura.
- Limites de servicos por plano.
- Limites de mensagens por plano.
- Valor final do preco minimo de plataforma, a partir da recomendacao inicial de R$ 50.
- Faixas finais de duracao permitidas acima do minimo operacional.
- Retencao de dados sensiveis.
- Politica de uso de dados agregados do Match.
- Forma final da UI de pagamentos do paciente.
- O mapeamento `/basico/pagamento` -> `/terapeuta/financeiro` foi implementado
  como redirect temporario, sem preservar uma segunda experiencia financeira.
- Se o nome publico sera Aura IA, Assessor IA ou outro.

Quando alguma decisao acima impactar implementacao, ela deve ser registrada antes de criar migracao, API ou comportamento de produto definitivo.

## 23. Resumo executivo final

O MVP do Terapeuta Eu Sou deve ser implementado como uma plataforma transacional, com descoberta publica, Match deterministico de terapias, reserva, pre-checkout, pagamento Stripe, sessao online e areas logadas.

O Match v1 recomenda terapias, nao terapeutas. Ele deve ser anonimo, baseado em pesos administraveis, com fallback sem beco sem saida e sem qualquer IA real.

O financeiro deve usar Stripe Billing para assinaturas, Stripe Connect Express para contas de recebimento, Separate Charges and Transfers para sessoes, ledger interno para rastreabilidade e repasses condicionados a saldo Stripe `available`.

As areas de terapeuta devem evoluir por plano: Free/Basico entrega operacao essencial, Premium/Pro adiciona inteligencia deterministica e Premium Plus/Plus entrega gestao completa com CRM, financeiro avancado, metricas, insights e Aura deterministica.

O principio tecnico central e: regras explicaveis, dados protegidos, pagamentos auditaveis, rotas canonicas, linguagem humana e nenhuma promessa terapeutica ou financeira.
