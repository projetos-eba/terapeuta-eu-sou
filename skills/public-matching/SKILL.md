---
name: public-matching
description: Use when implementing, refactoring, auditing, or documenting the public Match journey at `/sua-jornada` and `/sua-jornada/resultado`, including Figma node 13273:2627, matching themes/interests, deterministic scoring, public APIs, Supabase migrations/seeds, QA, and known pending work.
---

# Public Matching

## Fontes obrigatorias

Consultar antes de alterar:

1. `AGENTS.md`
2. Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13273:2627`
3. `docs/product/sitemap.md`
4. `docs/design-system/design-system.md`
5. `docs/product/routes-map.md`
6. `docs/product/integration-map.md`
7. `src/lib/routes.ts`
8. `src/features/public-matching/`
9. `src/app/sua-jornada/`
10. `src/app/api/public/matching/`
11. `supabase/migrations/*public_matching*`
12. `supabase/seed.sql`
13. `public/journey/`

## Contrato

- Rotas: `/sua-jornada` e `/sua-jornada/resultado`.
- APIs: `GET /api/public/matching/config` e `POST /api/public/matching/calculate`.
- Figma: node `13273:2627`.
- O Match e publico, anonimo, deterministico e sem IA.
- Recomendar terapias, nunca terapeutas.
- Nao armazenar respostas individuais no banco.
- Nao usar refinamentos, avaliacoes, disponibilidade ou plano do terapeuta no
  ranking de terapias.
- Regra definitiva: temas recomendam terapias; refinamentos recomendam
  terapeutas dentro da terapia escolhida.
- Usar “Tema” e “Interesse” na UI; nao usar “subtema”.

## Banco e dados

- `matching_themes`: fonte unica dos 10 temas ativos.
- `matching_interests`: interesses globais unicos, cada um pertencendo a exatamente um tema.
- `matching_versions`: versoes `draft`, `published` e `archived`.
- `therapy_matching_themes`: relacao canonica admin-managed entre terapia e
  tema, com no minimo 1 e no maximo 3 temas por terapia publicavel.
- `matching_weights`: legado compativel de pesos versionados; nao e fonte
  autoritativa para refinamentos por terapia.
- `matching_therapy_settings`: ativação da terapia no Match; só vale quando a terapia também está `published`.
- `public_matching_config`: view publica segura para temas/interesses publicados.
- `public_matching_therapies_v`: fonte única dos candidatos recomendáveis pelo Match; cruza detalhe público publicado com `matching_therapy_settings.is_visible_in_matching = true`.
- `public_matching_therapist_counts`: contagem informativa de profissionais aprovados, publicos e com servico ativo; nao influencia ranking.
- `public_therapies_v` e `public_therapy_details_v`: fonte editorial pública das terapias; o Match só recomenda terapias publicadas e com detalhe público elegível.

Seeds/mocks devem ser idempotentes em `supabase/seed.sql`.
Nesta fase, candidatos e fallback do Match devem conter somente `reiki`, `taro` e `constelacao-familiar`; `terapia-integrativa`, `terapia-floral`, `meditacao-guiada` e outras técnicas legadas devem permanecer `draft` ou fora de `matching_therapy_settings`.

## Algoritmo

- `matchingThemeCount = intersection(selectedThemeIds, therapyThemeIds).length`.
- Ordenar por `matchingThemeCount DESC`, depois `sort_order` administrativo e
  nome/slug estavel.
- Refinamentos selecionados sao preservados para a pagina da terapia, mas nao
  alteram score ou ordenacao de terapias.
- No desktop, retornar ate 5 terapias; no mobile, exibir as 3 primeiras.

## Frontend

- `src/app/sua-jornada/page.tsx`: Server Component com config live, demo
  explicito ou estado indisponivel honesto.
- `JourneyMatchClient`: selecao de temas/interesses, limites e envio.
- `src/app/sua-jornada/resultado/page.tsx`: `noindex`.
- `MatchingResultClient`: recarrega escolhas do `sessionStorage`, recalcula pela API e redireciona para `/sua-jornada` quando nao houver estado.
- A selecao salva em `sessionStorage` deve incluir `matchingVersionId`. A API
  rejeita versao ausente, invalida ou desatualizada antes de recalcular.
- As consultas server-side de configuracao/candidatos usam `cache: "no-store"`
  para evitar selecao com IDs de uma versao antiga e calculo contra outra.
- Labels de correspondencia usam a contagem real de temas coincidentes:
  “1 tema em comum”, “2 temas em comum” ou “3 temas em comum”. Percentual nao
  pode ser usado para afirmar quantidade de temas.
- Assets oficiais extraidos do Figma ficam versionados em `public/journey/`.
- A pagina deve manter hero com imagem fade, stepper, grid 5x2 de cards ilustrados no desktop e cards empilhados no mobile.
- Ao remover um tema, remover tambem seus interesses.
- CTA ativo com pelo menos um tema.
- Ao atingir tres temas, cards restantes ficam desabilitados, mas visiveis.

## Copy responsavel

- Nao prometer cura, diagnostico ou resultado garantido.
- Nao afirmar que o Match usa IA.
- Nao tratar recomendacao como avaliacao clinica.
- Preferir “caminhos possiveis”, “pode conversar com seu momento” e “explorar com calma”.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint`
- `npx supabase db reset` quando Docker estiver disponivel.
- Validar:
  - `/sua-jornada`
  - `/sua-jornada/resultado` sem sessionStorage redireciona.
  - limite de 1 a 3 temas.
  - ate 3 interesses por tema.
  - interesse precisa pertencer a tema selecionado.
  - refinamentos nao alteram ranking de terapias.
  - resultado aponta para `/terapias/:slug`.
  - resultado retorna apenas terapias existentes em `public_matching_therapies_v`.
  - sem Supabase, erro de consulta ou ausencia de versao publicada retorna
    indisponibilidade honesta; demo so ativa com `TES_ENABLE_DEMO_DATA=true`
    fora de producao e deve ser observavel na UI/API.
  - nenhum peso interno aparece no navegador.

## Pendencias conhecidas

- E2E completo selecao -> resultado -> terapia -> perfil -> reserva ainda deve
  ser ampliado para cobrir contexto expirado e correspondencia zero.
- Metricas futuras somente agregadas por dia, sem armazenar combinacao individual.
