---
name: patient-favorites
description: Implementar e manter favoritos autenticados do paciente.
---

# Favoritos do paciente

## Escopo

- Rotas: `/app/favoritos`, `/app/favoritos/terapeutas` e
  `/app/favoritos/terapias`.
- Fonte canônica de rotas: `src/lib/routes.ts`.
- Shell: `src/app/(authenticated)/layout.tsx`.
- Feature: `src/features/patient-favorites/`.
- API autenticada: `GET`/`POST`/`DELETE /api/patient/favorite-therapists`.
- Perfil público: `src/features/therapist-profile/components/favorite-therapist-button.tsx`.

## Dados

- Terapeutas favoritos usam `favorite_therapists`.
- A leitura do estado, adição idempotente e remoção devem acontecer com token
  autenticado do paciente e RLS.
- A remoção valida ownership por `patient_profiles.user_id`.
- A adição valida a sessão do paciente no servidor, resolve
  `patient_profiles.user_id` e usa conflito composto para prevenir duplicidade.
- Não usar service role no app Next.
- Terapias favoritas ainda não possuem tabela/fonte canônica implementada; a
  rota deve mostrar estado honesto de indisponibilidade, sem mockar favoritos.

## UI

- Usar “Favoritos” e “Terapeutas favoritos” na linguagem do paciente.
- Cards devem permitir ver perfil público e remover favorito.
- Perfil público deve permitir favoritar/desfavoritar com feedback acessível,
  estado otimista e rollback quando a API falhar.
- Sem sessão de paciente, o clique em favoritar deve encaminhar para
  `/cliente/login?next=<perfil público atual>`; após o login, a pessoa retorna
  ao perfil e confirma a ação com um novo clique.
- Estado vazio deve encaminhar para `/terapeutas`.
- Não exibir métricas inventadas.
- A página autenticada de terapeutas favoritos reutiliza `AppPageContainer`,
  mantendo o grid desktop compartilhado com largura máxima de `1210px` e
  transformação responsiva da lista.

## QA

- Validar `/app/favoritos` redirecionando para `/app/favoritos/terapeutas`.
- Validar remoção de favorito com sessão de paciente.
- Validar adição/remover favorito no perfil público por clique real.
- Validar que uma visita sem sessão chega ao login com retorno seguro ao perfil.
- Validar prevenção de duplicidade.
- Validar estado vazio.
- A homologação HML é opt-in por `HML_PATIENT_FAVORITES_E2E=true` e exige
  `HML_PATIENT_FAVORITES_E2E_BASE_URL`,
  `HML_PATIENT_FAVORITES_E2E_EMAIL`,
  `HML_PATIENT_FAVORITES_E2E_PASSWORD` e
  `HML_PATIENT_FAVORITES_E2E_THERAPIST_SLUG`. Usar apenas fixture dedicada e
  não registrar credenciais, cookies ou o valor de `_vercel_share`.
- Rodar `npm run typecheck`, `npm run lint`, testes focados e build quando
  possível.

## Assets da plataforma

- O cabeçalho de terapeutas favoritos usa `patientFavoritesHero` com fade à
  esquerda e sem borda decorativa. Consulte
  `docs/design-system/platform-assets.md`.
