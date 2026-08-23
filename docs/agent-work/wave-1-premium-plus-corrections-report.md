# Wave 1 — Correções Premium Plus / TES

Data: 2026-08-22

## Resultado

Wave 1 foi executada para correções pequenas, contratos já decididos e
hardening localizado. Nenhuma migration foi aplicada remotamente e nenhum
deploy em HML ou produção foi executado nesta rodada.

## Decisões aplicadas

- O nome público canônico é **Assessora Aura**. `aura_*` e a rota técnica
  `/terapeuta/assessor-ia` permanecem compatíveis no código.
- Todos os planos podem cadastrar serviços sem limite de quantidade. O limite
  legado permanece como contrato nullable apenas para compatibilidade dos
  read models.
- A descrição do serviço tem limite de 200 caracteres, com contador na edição.
- Arquivos de foto, vídeo e capa respeitam limite de 5 MB por arquivo. Vídeos
  maiores devem usar link HTTPS do YouTube ou Vimeo.
- A jornada pública do Match seleciona somente temas. Interesses continuam
  associados aos temas e entram no cálculo determinístico, mas não são
  escolhidos separadamente pelo visitante.
- Agenda, disponibilidade e reserva passaram a explicitar que os horários
  exibidos seguem o fuso de São Paulo (Brasília). O contrato de timezone
  armazenado para terapeutas não foi alterado nesta rodada.
- Termos, privacidade e ajuda passaram a privilegiar leitura humana em
  acordeões, sem exibir metadados técnicos na superfície pública.
- O timeout de uma hora não foi reimplementado: a decisão já existia no
  produto e não havia alteração necessária identificada nesta rodada.

## Implementação

### Autenticação

- O controle compartilhado de visibilidade de senha foi aplicado aos campos de
  senha e confirmação do cadastro de terapeuta e paciente e ao reset de senha.
  Os logins já usavam o componente e não foram duplicados.

### Serviços

- `supabase/migrations/20260822014500_unlimited_therapist_services.sql`
  redefine o limite por plano como `NULL`, preservando o contrato de leitura e
  fazendo a função de enforcement sair sem bloquear criação.
- `supabase/migrations/20260822020000_limit_therapist_service_description.sql`
  adiciona uma proteção de banco para limitar descrições novas/editadas a 200
  caracteres, preservando registros legados maiores sem reescrita destrutiva.
- `supabase/tests/072_unlimited_therapist_services.sql` cobre Free, Premium e
  Premium Plus.
- Formulário, parser e estados de serviço refletem a ausência de limite e o
  máximo de 200 caracteres da descrição. Cards longos mostram reticências e
  oferecem “Ver mais/Mostrar menos” sem estourar o layout.

### Perfil e mídia

- Validação client-side, API Next e Edge Function rejeitam vídeo acima de 5 MB.
- Links externos aceitos são HTTPS e ficam restritos a YouTube/Vimeo; hosts
  arbitrários são rejeitados.
- A copy orienta que arquivos maiores sejam hospedados externamente e que o
  conteúdo passe pelo fluxo de revisão existente.

O embed público de vídeo e a moderação transacional do perfil inteiro não foram
criados como efeito colateral desta correção. São um workstream funcional maior
que exige contrato de publicação, estado de moderação e QA visual próprios.

### Match

- `JourneyMatchClient` não exibe mais seletor de interesses e envia a seleção
  pública com `interestIds: []`, mantendo o backend compatível com o contrato
  histórico.
- Copy, inventário de páginas, mapa de rotas, glossário, integração e skill
  pública foram alinhados para a seleção por temas.

### Agenda e linguagem

- Reserva, cabeçalho da agenda e seletor de fuso comunicam de forma explícita
  “São Paulo (Brasília)”.
- Mensagens, suporte e textos legais foram ajustados sem expor detalhes de
  implementação ao usuário.

## Arquivos e documentação

Foram alterados componentes de autenticação, serviços, perfil/mídia, agenda,
reserva, Match, Mensagens, Aura e páginas legais/ajuda, além dos documentos de
produto e arquitetura correspondentes. A migration e o teste SQL novos estão
listados acima; não houve alteração destrutiva nem atualização de tipos gerados.

## Validação executada

- `npm run typecheck` — PASS.
- `npm run lint` — PASS; políticas visual e online-only sem violações.
- `npm run build` — PASS; build Next concluído com todas as rotas.
- `npm run test` — PASS: 150 arquivos, 584 testes.
- Vitest focal — PASS: 10 arquivos, 53 testes.
- `npm run test:deno` — PASS: 161 testes.
- `npx supabase db reset` — PASS local, aplicando a migration nova.
- `npx supabase test db` — PASS: 73 arquivos, 1.572 testes.
- `npx supabase db lint` — PASS com warnings preexistentes de imutabilidade e
  parâmetros não utilizados; nenhum erro novo foi reportado.
- Prettier focal nos arquivos tocados — PASS.
- `git diff --check` — PASS.
- `npm run legal:check` — executado; continua reportando 8 campos jurídicos
  obrigatórios ausentes em modo de desenvolvimento, sem falhar o comando.
- `npm run format:check` — FAIL preexistente: 199 arquivos fora do formato
  global. Os arquivos tocados nesta rodada passaram no check focal; a dívida
  global não foi reformada para evitar diff fora de escopo.

## Pendências reais

1. **Métricas 60/120 dias**: o runtime e as RPCs atuais aceitam 30/90 dias.
   Expor 60/120 exige evolução coordenada de tipos, mappers, queries e várias
   funções SQL, com testes e revisão própria. Não foi criada uma UI que
   ofereça opções que o backend ainda rejeita.
2. **Moderação integral do perfil e vídeo embedado**: dependem de estados e
   contratos de publicação/moderação ainda não formalizados. A validação de
   tamanho e host já está protegida.
3. **Dashboard financeiro e revisão jurídica da anotação da página 63**:
   permanecem fora desta Wave 1 por falta de decisão/escopo técnico fechado.
4. **Figma**: ajustes pequenos foram aplicados usando os componentes existentes.
   Rebuilds visuais maiores de Métricas, Assessora Aura e outras telas ficam
   para uma wave específica, conforme decisão humana.
5. **Categorias da solicitação de nova prática**: a implementação atual usa a
   taxonomia persistida de `therapy_categories`, enquanto o Match usa a
   taxonomia independente de temas. A indicação de “três categorias exatamente
   os temas” não identifica quais três chaves devem ser canônicas nos arquivos
   analisados; nenhuma remapeação silenciosa foi feita. É necessária uma decisão
   de produto antes de alterar o contrato dessa solicitação.
6. `npm run format:check` global e os campos ausentes do gate jurídico exigem
   tratamento separado antes de um release candidate.
7. **Limite de upload**: o limite de 5 MB desta rodada foi aplicado às mídias
   do perfil (foto, vídeo e capa). Documentos privados de verificação e anexos
   de solicitação de nova prática continuam com seus contratos próprios de
   10 MB; não foram alterados sem uma decisão explícita de unificação desses
   fluxos.

## Segurança e compatibilidade

- Nenhum segredo foi adicionado ao frontend ou persistido no browser.
- A migration é aditiva e reversível por roll-forward; registros existentes e
  contratos nullable são preservados.
- Participant messaging continua template-only e server-authoritative.
- O suporte continua separado do fluxo de mensagens estruturadas.

## Impacto documental

Documentação atualizada: produto, sitemap, routes map, glossary,
integration map, arquitetura de Match/Aura/serviços e skill pública de Match.
As pendências de métricas, moderação e Figma estão registradas acima para não
serem confundidas com itens concluídos.

### Atualização após a Wave 2

As pendências históricas desta fotografia sobre períodos de métricas e a
taxonomia da solicitação de nova prática foram tratadas na Wave 2. O contrato
atual passou a aceitar 30/60/90/120 dias e a usar 1–3 temas ativos do Match,
com compatibilidade legada preservada. Moderação integral de perfil, dados
jurídicos oficiais e rebuilds maiores de Figma continuam fora dessas waves.
