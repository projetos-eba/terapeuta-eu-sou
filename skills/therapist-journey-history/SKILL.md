# Histórico da Jornada do Terapeuta

## Escopo

Use esta skill ao alterar a página autenticada de Histórico da Jornada do shell do terapeuta.

Rotas:

- `/terapeuta/pacientes`
- `/terapeuta/pacientes/[patientId]`

Perfil/plano:

- Terapeuta autenticado com capability `full_crm` (`Premium Plus`).
- A rota usa `therapistRoutePolicies.patients` e `requireTherapistSession`.

## Fontes Obrigatórias

- `AGENTS.md`
- Figma: `Projeto Terapeuta Eu Sou Atualizado`, node `13366:8765`
- `docs/product/sitemap.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/therapist-journey-history/*`
- `src/features/therapist-shell/therapist-route-policy.ts`

## Contrato Visual

O node Figma `13366:8765` define:

- Título visual `Clientes` dentro da navegação `Histórico da Jornada`.
- Métricas no topo: total de clientes, ativos, novos no mês, sem sessão recente.
- Lista de clientes com busca, filtros de situação, ordenação, terapias,
  última/próxima sessão e paginação. A contagem de sessões fica disponível nos
  cartões compactos e no detalhe da jornada, não como coluna da tabela.
- Rail lateral com resumo da carteira, temas da jornada e lembretes. Temas só
  podem aparecer quando forem compartilhados por uma fonte estruturada; a tela
  não infere temas a partir de nomes de terapias, títulos ou resumos.
- Visual claro, premium, bordas lavanda, sombra suave, tipografia display IvyPresto para títulos.

No detalhe `/terapeuta/pacientes/[patientId]`, a composição segue a leitura
operacional da jornada:

- hero de identidade com nome, status, terapias vinculadas e atalhos para
  sessões e templates aprovados;
- faixa de resumo com início da jornada, sessões registradas, próxima e última
  sessão;
- temas compartilhados diretamente na jornada, sem inferir informação a partir
  de texto livre e sem afirmar diagnóstico ou frequência que não exista na
  fonte;
- memória das sessões em tabela no desktop e cartões cronológicos no mobile,
  com link canônico para a sessão;
- cards finais para preferências de acolhimento e próximo encontro. Quando não
  houver preferência compartilhada, usar estado vazio explícito — nunca criar
  texto atribuído ao paciente.

## Dados

A página não cria uma nova autoridade clínica ou financeira. A leitura é derivada de:

- `therapist_patient_relationships`
- `bookings`
- `patient_profiles`
- `therapist_services`
- `booking_session_summaries`

Regras:

- Não buscar e-mail de pacientes via `profiles`; a policy padrão só garante leitura do próprio profile.
- Não exibir chat livre.
- Links de comunicação devem apontar para `/terapeuta/mensagens`, que usa templates.
- Links de sessões devem usar `/terapeuta/sessoes?patient=<patientProfileId>`.
- Detalhes de sessão devem usar `/terapeuta/sessoes/[bookingId]`.
- Os títulos de terapia por sessão podem ser derivados dos mesmos `bookings`,
  `therapist_services` e `booking_session_summaries` já autorizados pela
  feature; não adicionar uma fonte paralela para enriquecer a tela.
- Não inferir temas com palavras-chave do nome da terapia, título, resumo ou
  qualquer outro texto livre. Enquanto não houver uma fonte estruturada,
  consentida e específica, `segments` e `topicLabels` devem permanecer vazios.
- O parâmetro legado `segment` pode continuar sendo aceito pela URL por
  compatibilidade, mas é ignorado e não pode filtrar a lista.

## Responsividade

- Desktop: lista com título editorial, métricas, tabela semântica paginada e
  rail de resumo, temas e lembretes.
- Tablet/mobile: métricas e cartões compactos de pessoas em uma única coluna;
  a tabela vira cards estruturados e paginados. O tamanho padrão é de 12
  pessoas por página.
- Filtros e ordenação são aplicados antes da paginação. Os links de página
  preservam busca, situação e ordenação; a exportação usa todas as pessoas
  filtradas, não somente a página atual.
- O contador deve informar o intervalo exibido e o total, por exemplo,
  “Mostrando 1–12 de 27 pessoas”. A navegação deve ter foco visível, nomes
  acessíveis e estados desabilitados para os limites.
- No desktop, o rail deve empilhar seus cards em fluxo de bloco; em tablet e
  mobile, pode usar duas colunas. O rail e seus cards usam altura de conteúdo
  (`auto-rows-min`, `h-auto`, `self-start` e `content-start`), sem esticar os
  cards para acompanhar a altura da lista principal.
- Evitar texto sobreposto, largura fixa frágil e cards aninhados.

Regra de acompanhamento:

- “Em acompanhamento” indica uma pessoa com sessão registrada nos últimos 30
  dias.
- “Sem sessão recente” indica uma pessoa sem sessão registrada há mais de
  30 dias (ou sem sessão registrada).
- O gráfico de resumo mostra somente esses dois estados; relações pausadas não
  entram no gráfico.
- O ícone de informação ao lado de “Sem sessão recente” explica essa janela
  de forma breve e acessível.
- Os cards de resumo devem explicar o significado no próprio título, descrição
  e badge: total registrado, sessão nos últimos 30 dias, relações iniciadas no
  mês e continuidade que vale revisar. Evitar rótulos abstratos sem contexto.
- Os controles de filtro usam o select nativo; a área da seta decorativa deve
  ser transparente aos eventos (`pointer-events: none`) para que clicar na
  seta abra o filtro da mesma forma que clicar no texto.

## Copy Responsável

- Não prometer cura, diagnóstico, resolução emocional ou resultado garantido.
- Usar linguagem operacional: jornada, sessões, registros, continuidade, cuidado.
- Deixar claro que a timeline é operacional e não substitui prontuário clínico.

## QA

- Rodar `npm run typecheck`.
- Rodar `npm run lint`.
- Rodar `npm run test`.
- Rodar `npm run build` quando o ambiente permitir.
- Testar paginação com 0, 1, 12, 13 e mais resultados; páginas inválidas,
  negativas e além do total devem ser normalizadas.
- Verificar preservação de busca, situação e ordenação nos links de paginação,
  exportação completa do conjunto filtrado e igualdade dos registros entre a
  tabela desktop e os cards mobile.
- Para alteração visual, validar desktop e mobile em `/terapeuta/pacientes`
  com terapeuta Premium Plus local quando houver Supabase/dev server disponível.
  Confirmar uma coluna e ausência de overflow em 320, 375, 390 e 430 px,
  inclusive com fotos reais de `patient_profiles.avatar_url` e fallback por
  iniciais.
- Confirmar que nomes como “Reiki”, títulos e resumos não criam o tema
  “Espiritualidade” e que o estado vazio informa “Ainda não há temas
  compartilhados para mostrar.”.

## Pendências Conhecidas

- O Figma mostra e-mail do cliente, mas a implementação atual usa rótulo seguro (`timezone`/`Cliente TES`) para respeitar as policies existentes.
- Não há fonte estruturada e consentida de temas da jornada nesta etapa; não
  inferir temas de títulos, resumos ou serviços.
