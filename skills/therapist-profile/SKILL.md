---
name: therapist-profile
description: Use when implementing, refactoring, auditing, or documenting the therapist shell page `/terapeuta/perfil`, including Figma nodes 13366:2408 and 13366:7289, draft/publication flow, private editor read model, public profile integration, Storage separation, RLS, cache and shared app grid.
---

# Meu Perfil do Terapeuta

## Fontes

- `AGENTS.md`
- Figma file `OSXJi8tknHHCj82MTY2NbG`
- Figma nodes `13366:2408` and `13366:7289`
- `docs/architecture/therapist-profile-m1.md`
- `docs/architecture/adr/ADR-010-therapist-profile-editor-publication.md`
- `docs/product/routes-map.md`
- `docs/product/integration-map.md`
- `docs/product/page-inventory.md`
- `docs/design-system/design-system.md`

## Rotas

- Shell preview-first: `/terapeuta/perfil` conforme Figma `13366:2408`
- Shell editor: `/terapeuta/perfil/editar` conforme Figma `13366:7289`
- Perfil público: `/terapeutas/:slug`
- API adapter: `/api/therapist/profile`
- Media adapter: `/api/therapist/profile/media`
- Edge Function: `therapist-profile-command`

## Contratos

- `TherapistProfileEditorData`
- `TherapistProfileCompleteness`
- `TherapistProfileCapabilities`
- `TherapistProfilePublicDetail` via views públicas existentes
- `TherapistSearchCard` via `public_therapist_search`

Não passar linhas cruas do Supabase para React.

## Banco

- Identidade canônica: `therapist_profiles`
- Rascunho/publicado: `therapist_profile_content_versions`
- Idempotência: `therapist_profile_mutation_requests`
- Auditoria: `therapist_profile_events`
- Documentos privados: `therapist_private_documents`
- Buckets: `therapist-public-media`, `therapist-private-documents`

## Regras

- Salvar rascunho não altera views públicas.
- Publicação é direta pelo terapeuta e pode levar 2 a 3 horas para propagar.
- Na primeira configuração, a ação primária deve ser `Publicar alterações`.
  Antes de enviar ao backend, validar nome do perfil, texto curto/headline e
  minha essência/bio. Se houver alterações locais válidas, a UI deve salvar o
  rascunho e publicar com a versão retornada pelo servidor no mesmo fluxo
  confirmado.
- Em perfis já publicados, a ação primária volta a ser `Salvar alterações`;
  publicação posterior continua explícita sobre rascunho salvo.
- Administração continua responsável por verificação, suspensão, documentos,
  plano e bloqueios.
- Publicar um perfil elegível também o envia atomicamente para a fila
  administrativa: cria ou reenfileira `therapist_verifications` e usa o estado
  `submitted`, sem aprovação automática. Falha na fila deve abortar a
  publicação em vez de produzir sucesso parcial.
- Perfis já aprovados ou suspensos não podem ser rebaixados por republicação.
- Dados derivados são somente leitura.
- Documentos privados nunca entram em HTML público, DTO público, busca pública
  ou preview público.
- Capabilities são validadas no frontend e no backend.
- Sem mocks silenciosos em produção.

## UI

- Usar `AuthenticatedShell`.
- Usar `src/components/app-page`.
- `/terapeuta/perfil` deve focar somente no preview da versão publicada, status e
  checklist. Não renderizar formulário nessa rota.
- `/terapeuta/perfil/editar` deve conter header, progresso, formulário
  numerado, upload/mídia, módulos gerenciados, aviso importante e save bar.
- Evitar CTAs conflitantes na primeira configuração: não mostrar `Salvar
rascunho` como ação concorrente quando o perfil ainda não tem versão
  publicada.
- Rascunhos só aparecem como aviso na rota principal; a versão pública
  publicada continua sendo a prévia renderizada.
- Upload público deve usar `therapist-public-media`; documentos permanecem fora
  do preview.
- Usar `TESDialog` para confirmações.
- Manter `h1` único.
- Labels visíveis e touch targets de pelo menos 44px.
- Não prometer cura, diagnóstico ou resultado.

## Cache

- Draft/discard: não invalidar público.
- Publish/unpublish: revalidar `therapist-profile`, `therapist-search`, `/`,
  `/terapeutas` e `/terapeutas/:slug`.

## QA

- Typecheck, lint, build.
- Vitest para parsers, mappers e componente.
- Vitest para upload client-side e falha sem fallback.
- Vitest para rota `/api/therapist/profile/media`: sessão, validação,
  capability, path público protegido e falha sanitizada de Storage.
- Deno para Edge command.
- pgTAP para RLS, publicação, rascunho, fila administrativa e privacidade.
- Validar que view pública não expõe campos administrativos.
- E2E `tests/e2e/therapist-profile.spec.ts`: login do terapeuta, preview-first,
  navegação para edição, rascunho, publicação, perfil público, ausência de
  documentos públicos e responsividade.
