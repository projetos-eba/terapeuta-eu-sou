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
- API autenticada: `POST`/`DELETE /api/patient/favorite-therapists`.
- Perfil público: `src/features/therapist-profile/components/favorite-therapist-button.tsx`.

## Dados

- Terapeutas favoritos usam `favorite_therapists`.
- Leitura, adição idempotente e remoção devem acontecer com token autenticado
  do paciente e RLS.
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
- Estado vazio deve encaminhar para `/terapeutas`.
- Não exibir métricas inventadas.

## QA

- Validar `/app/favoritos` redirecionando para `/app/favoritos/terapeutas`.
- Validar remoção de favorito com sessão de paciente.
- Validar adição/remover favorito no perfil público por clique real.
- Validar prevenção de duplicidade.
- Validar estado vazio.
- Rodar `npm run typecheck`, `npm run lint`, testes focados e build quando
  possível.
