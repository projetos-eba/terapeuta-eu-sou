# Mapa de Integração do Produto

Documento operacional para manter páginas, funções, banco e skills usando as mesmas fontes de verdade.

Atualizado em 2026-07-16.

## Regras Gerais

- Rotas canônicas: `src/lib/routes.ts`.
- Inventário de páginas: `docs/product/page-inventory.md`.
- Mapa navegacional: `docs/product/sitemap.md`.
- Contrato de rotas: `docs/product/routes-map.md`.
- Tokens e padrões visuais: `docs/design-system/design-system.md`.
- Toda página implementada ou refatorada deve ter skill local em `skills/`.
- Toda alteração de banco deve ter migration versionada em `supabase/migrations/`.
- Seeds/mocks devem ser idempotentes em `supabase/seed.sql` ou arquivo documentado.

## Domínios

| Domínio | Fonte de verdade | Views/APIs públicas | Skills relacionadas | Regra crítica |
|---|---|---|---|---|
| Rotas públicas | `src/lib/routes.ts` | — | Todas as skills de página | Não criar rota fora do helper canônico. |
| Home pública | `public_home_*` e projeções públicas | `public_home_therapies`, `public_home_therapists`, `public_home_testimonials` | `skills/public-home` | Home pode ter fallback local, mas deve preferir views seguras. |
| Terapias | `therapies`, `therapy_categories` | `public_therapies_v`, `/api/public/therapies` | `skills/public-therapies` | Catálogo público exige `therapies.status = published`. |
| Match | `matching_themes`, `matching_interests`, `matching_versions`, `matching_weights`, `matching_therapy_settings` | `public_matching_config`, `public_matching_therapist_counts`, `/api/public/matching/*` | `skills/public-matching` | Match recomenda terapias, nunca terapeutas; terapia precisa estar `published` e ativa em `matching_therapy_settings`. |
| Busca de terapeutas | `therapist_profiles`, `therapist_services`, `therapies`, avaliações publicadas | `public_therapist_search` | `skills/public-therapist-search` | Expor somente terapeutas aprovados, públicos, aceitando reservas e com serviço ativo. |
| Perfil público do terapeuta | Perfil, serviços, conteúdo editorial, disponibilidade e reviews pagos/concluídos | `public_therapist_profiles_v`, `public_therapist_profile_services_v`, `public_therapist_profile_reviews_v`, `public_therapist_profile_content_v` | `skills/public-therapist-profile` | Horários são derivados em runtime e avaliações só contam sessão paga/concluída. |
| Auth cliente | Supabase Auth REST, `profiles`, `patient_profiles` | `/api/auth/client/*` | `skills/client-auth` | Login/cadastro de cliente separados de terapeuta. |
| Auth terapeuta | Supabase Auth REST, `profiles`, `therapist_profiles` | `/api/auth/therapist/*` | `skills/therapist-auth` | Cadastro inicial não bloqueia por documentos, repasse ou perfil público. |
| Para terapeutas/planos | `src/domain/tes/plan-definitions.ts` | — | `skills/public-for-therapists` | Frontend envia só `plan`; preço e Stripe Price ID são resolvidos no backend futuramente. |

## Estado Das Páginas Públicas Implementadas

| Rota | Status | Fonte dinâmica | Skill |
|---|---|---|---|
| `/` | Implementada | Views públicas da Home com fallback local | `skills/public-home` |
| `/sua-jornada` | Implementada | `public_matching_config` com fallback | `skills/public-matching` |
| `/sua-jornada/resultado` | Implementada | `/api/public/matching/calculate` | `skills/public-matching` |
| `/terapeutas` | Implementada | `public_therapist_search` com fallback | `skills/public-therapist-search` |
| `/terapeutas/:slug` | Implementada | Views públicas de perfil | `skills/public-therapist-profile` |
| `/terapias` | Implementada | `public_therapies_v` e `/api/public/therapies` | `skills/public-therapies` |
| `/para-terapeutas` | Implementada | Catálogo local de planos TES | `skills/public-for-therapists` |
| `/cliente/login` e `/cliente/cadastro` | Implementadas | Supabase Auth REST | `skills/client-auth` |
| `/terapeuta/login` e `/terapeuta/cadastro` | Implementadas | Supabase Auth REST | `skills/therapist-auth` |

## Pendências De Integração

- `/terapias/:slug` ainda precisa consumir catálogo real, SEO dinâmico e JSON-LD `Service`.
- `/como-funciona`, `/reserva`, `/reserva/sucesso`, `/para-terapeutas/planos`, `/ajuda`, `/termos`, `/privacidade`, áreas logadas e admin ainda precisam ser implementadas ou auditadas quando entrarem no escopo.
- `/admin/terapias` deve controlar separadamente publicação editorial (`published`) e ativação no Match (`matching_therapy_settings.is_visible_in_matching`).
- `/admin/matching` deve publicar versões completas de pesos, nunca edição parcial ao vivo.
