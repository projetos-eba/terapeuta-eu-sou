# Therapist Reviews

Use esta skill ao alterar a página de Avaliações do shell do terapeuta.

## Fontes Obrigatórias

1. `AGENTS.md`.
2. Figma `OSXJi8tknHHCj82MTY2NbG`, node `13366:5844`.
3. `docs/product/routes-map.md`.
4. `docs/product/page-inventory.md`.
5. `docs/product/integration-map.md`.
6. `docs/design-system/design-system.md`.
7. `skills/public-therapist-profile/SKILL.md`.

## Rotas

- Canônica: `/terapeuta/avaliacoes`.
- Legado: `/pro/avaliacoes` e `/plus/avaliacoes` existem apenas por redirect de compatibilidade.
- Perfil público consumidor: `/terapeutas/:slug`.

## Dados E Autoridades

- Read model privado: `get_therapist_reviews_v1`.
- Mutação autenticada: `/api/therapist/reviews`.
- RPC de resposta: `upsert_therapist_review_reply_v1`.
- Idempotência: `therapist_review_reply_mutation_requests`.
- Projeção pública segura: `public_therapist_profile_reviews_v`.

Avaliações exibidas ao terapeuta e ao público devem derivar de:

- `reviews.status = published`;
- `bookings.status = completed`;
- `session_payments.financial_status = paid`;
- sessão online TES;
- perfil público aprovado quando o consumidor é público.

## Regras De Produto

- O terapeuta não cria avaliações.
- O terapeuta responde apenas avaliações próprias e elegíveis.
- Resposta pública deve ser breve, responsável e sem dados privados.
- Comentários ocultos, reportados ou removidos não entram na tela nem no perfil público.
- Métricas são agregadas, nunca editáveis.
- Não inventar deltas percentuais quando não houver base confiável.
- TES é exclusivamente online; não sugerir atendimento fora do fluxo online da
  plataforma.

## Componentes

- `TherapistReviewsPage`.
- `TherapistReviewMetricCard`.
- `TherapistReviewCard`.
- `TherapistReviewsSidebar`.
- `ReviewReplyDialog`.
- Grid compartilhado `AppPage*`.
- Dialog sempre via `TESDialog`.

## Composição visual

- Densidade dominante `Balanced`: hero editorial, faixa de quatro indicadores
  verificáveis, lista filtrável e `ContextRail` de resumo.
- O hero usa `IvyPresto Display` em `text-brand-deep`; a imagem é decorativa e
  não carrega informação essencial. Não transformar o hero em uma grade de
  cards.
- O `MetricStrip` consome `metricCards`; tendências aparecem apenas quando o
  read model as fornece. Nunca sintetizar variação para preencher a composição.
- Tabs `Todas`, `Recentes`, `Por nota` e `Pendentes de resposta` permanecem
  próximas dos resultados. Cada item expõe identidade limitada, terapia ou
  serviço, nota, data, comentário, estado e a próxima ação.
- O rail mostra distribuição por nota e contexto sobre avaliações. No tablet,
  ocupa a faixa de duas colunas; no mobile, segue a lista principal.
- Na comunicação, usar “Sessão” para a operação do terapeuta e “Terapia” para
  a oferta apresentada; evitar “encontro” e “serviço” na interface.
- Ícones são semânticos e usam tokens TES. Texto funcional é `14px` ou maior;
  apenas metadados secundários podem chegar a `11px` no desktop.

## Fallback E Erros

- Produção não usa mock silencioso.
- Falha do Supabase retorna erro controlado na rota privada.
- Zero avaliações é estado vazio legítimo.
- Erros brutos do Supabase não aparecem na UI.

## QA

Executar quando alterar a página:

- `npm run typecheck`;
- `npm run lint`;
- `npm run test -- therapist-reviews`;
- `npx supabase test db`.

Validar responsividade em 320px, 375px, 768px, 1024px e 1440px quando houver alteração visual.

## Assets da plataforma

- O hero de avaliações usa `therapistReviewsHero` com fade à esquerda e sem
  borda decorativa. Consulte `docs/design-system/platform-assets.md`.
