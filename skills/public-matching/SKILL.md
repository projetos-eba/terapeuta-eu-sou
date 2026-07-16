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
- Nao usar avaliacoes, disponibilidade ou plano do terapeuta no ranking.
- Usar “Tema” e “Interesse” na UI; nao usar “subtema”.

## Banco e dados

- `matching_themes`: fonte unica dos 10 temas ativos.
- `matching_interests`: interesses globais unicos, cada um pertencendo a exatamente um tema.
- `matching_versions`: versoes `draft`, `published` e `archived`.
- `matching_weights`: pesos internos de 0 a 5, com exatamente um alvo entre `theme_id` e `interest_id`.
- `matching_therapy_settings`: ativação da terapia no Match; só vale quando a terapia também está `published`.
- `public_matching_config`: view publica segura para temas/interesses publicados.
- `public_matching_therapist_counts`: contagem informativa de profissionais aprovados, publicos e com servico ativo; nao influencia ranking.
- `public_therapies_v`: fonte editorial pública das terapias; o Match só recomenda terapias publicadas.

Seeds/mocks devem ser idempotentes em `supabase/seed.sql`.

## Algoritmo

- Temas: peso normal.
- Interesses: peso multiplicado por `1.4`.
- Score percentual:
  `score_bruto / (temas * 5 + interesses * 5 * 1.4) * 100`.
- Faixas:
  - `85-100`: Alta aderencia.
  - `65-84`: Boa aderencia.
  - `45-64`: Pode fazer sentido.
  - Abaixo de 45 normalmente nao exibe.
- Se nenhum resultado atingir 45%, retornar os 3 melhores com mensagem de baixa correspondencia.
- No desktop, retornar ate 5 terapias; no mobile, exibir as 3 primeiras.
- Empate: maior quantidade de interesses compativeis e depois ordem alfabetica.

## Frontend

- `src/app/sua-jornada/page.tsx`: Server Component com config e fallback.
- `JourneyMatchClient`: selecao de temas/interesses, limites e envio.
- `src/app/sua-jornada/resultado/page.tsx`: `noindex`.
- `MatchingResultClient`: recarrega escolhas do `sessionStorage`, recalcula pela API e redireciona para `/sua-jornada` quando nao houver estado.
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
  - resultado aponta para `/terapias/:slug`.
  - nenhum peso interno aparece no navegador.

## Pendencias conhecidas

- Testes unitarios formais do algoritmo em runner padrao do projeto.
- Testes de integracao HTTP das APIs.
- E2E selecao -> resultado -> terapia.
- Tela administrativa `/admin/matching` consumindo `matching_versions` e publicando versoes.
- Metricas futuras somente agregadas por dia, sem armazenar combinacao individual.
