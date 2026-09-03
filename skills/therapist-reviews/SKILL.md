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
- Criação/edição do paciente: `/api/patient/reviews`, Edge Function
  `patient-reviews-command` e `save_patient_therapist_review_for_actor_v1`.
- Histórico: `review_revisions`; mutações do paciente usam
  `patient_therapist_review_mutation_requests`.
- Projeção pública segura: `public_therapist_profile_reviews_v`.
- Agregados públicos: `public_home_therapists`, `public_therapist_search` e
  `public_therapist_profiles_v` devem usar a projeção interna canônica
  `public_therapist_profile_reviews_v_internal`, sem recalcular nota por
  reserva ou pagamento.

Avaliações exibidas ao terapeuta e ao público devem derivar de:

- `reviews.status = published`;
- uma única avaliação canônica por relação paciente–terapeuta;
- ao menos uma confirmação `completed` do paciente naquela relação para a
  criação inicial;
- perfil público aprovado quando o consumidor é público.

Depois de criada, a visibilidade da avaliação não depende de mudanças futuras
em booking ou pagamento. Inserir, editar, ocultar ou republicar `reviews` não
altera `session_payments`, confirmação bilateral, elegibilidade ou lotes.

## Regras De Produto

- O terapeuta não cria avaliações.
- O terapeuta responde apenas avaliações próprias e elegíveis.
- O paciente pode criar, editar, ocultar e republicar sua avaliação canônica;
  nota é obrigatória para publicar e comentário é opcional.
- Versões anteriores são append-only em `review_revisions`.
- Resposta pública deve ser breve, responsável e sem dados privados.
- Comentários ocultos, reportados ou removidos não entram na tela nem no perfil público.
- Métricas são agregadas, nunca editáveis.
- Confirmação operacional pós-sessão fica disponível para todos os planos. O
  centro de feedbacks/analytics desta rota é Premium e Premium Plus.
- Cada pendência mostra a referência operacional imutável `Sessão #AAMNNNNNN`,
  paciente, terapia e horário. O código identifica a sessão; UUID continua
  sendo usado somente por navegação e comandos autorizados.
- Feedback privado das próprias sessões e pendências podem aparecer na gestão,
  mas a resposta do paciente é imutável e somente leitura para o terapeuta.
- Não inventar deltas percentuais quando não houver base confiável.
- TES é exclusivamente online; não sugerir atendimento fora do fluxo online da
  plataforma.

## Componentes

- `TherapistReviewsPage`.
- `TherapistReviewMetricCard`.
- `PrivateSessionFeedbackCard`.
- `PendingConfirmationCard`.
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
- A rota é dividida em duas abas acessíveis: `Avaliações públicas`, com
  indicadores, filtros, respostas, resumo e orientação; e `Avaliações da
  sessão`, com feedbacks privados somente leitura e confirmações operacionais.
  A segunda aba mostra um contador amarelo igual ao número de confirmações
  pendentes; esses conteúdos não se misturam à lista pública.
- O nó Figma `13366:5844` é a referência visual; o card de confirmação mantém
  a hierarquia operacional desta skill porque esse detalhe não está no frame.
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
