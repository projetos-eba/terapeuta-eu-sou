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

## Dados

- Terapeutas favoritos usam `favorite_therapists`.
- Leitura e remoção devem acontecer com token autenticado do paciente e RLS.
- A remoção valida ownership por `patient_profiles.user_id`.
- Não usar service role no app Next.
- Terapias favoritas ainda não possuem tabela/fonte canônica implementada; a
  rota deve mostrar estado honesto de indisponibilidade, sem mockar favoritos.

## UI

- Usar “Favoritos” e “Terapeutas favoritos” na linguagem do paciente.
- Cards devem permitir ver perfil público e remover favorito.
- Estado vazio deve encaminhar para `/terapeutas`.
- Não exibir métricas inventadas.

## QA

- Validar `/app/favoritos` redirecionando para `/app/favoritos/terapeutas`.
- Validar remoção de favorito com sessão de paciente.
- Validar estado vazio.
- Rodar `npm run typecheck`, `npm run lint`, testes focados e build quando
  possível.
