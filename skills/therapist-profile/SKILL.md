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
- Private documents adapter: `/api/therapist/profile/documents`
- Private document signed preview: `/api/therapist/profile/documents/[documentId]`
- Edge Function: `therapist-profile-command`
- Edge Function privada de documentos: `therapist-private-documents`

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
- Slug estável Free: `therapist_profiles.free_public_slug`
- Redirects sem cadeia: `therapist_profile_slug_history`
- Documentos privados: `therapist_private_documents`
- Buckets: `therapist-public-media`, `therapist-private-documents`

## Regras

- Salvar rascunho não altera views públicas.
- Publicação é direta pelo terapeuta e pode levar 2 a 3 horas para propagar.
- Na primeira configuração, a ação primária deve ser `Publicar alterações`.
  Antes de enviar ao backend, validar nome do perfil, sua apresentação/headline e
  minha essência/bio. Se houver alterações locais válidas, a UI deve salvar o
  rascunho e publicar com a versão retornada pelo servidor no mesmo fluxo
  confirmado.
- Em perfis já publicados, a ação primária volta a ser `Salvar alterações`;
  publicação posterior continua explícita sobre rascunho salvo.
- O terapeuta anexa documentos privados obrigatórios nesta superfície; a
  administração continua responsável por revisão, aprovação, suspensão, plano
  e bloqueios.
- Toda publicação de uma nova versão, inclusive uma republicação de perfil já
  aprovado, envia atomicamente o conteúdo para a fila administrativa: cria ou
  reenfileira `therapist_verifications` em `submitted`, mantém a versão para a
  leitura segura do Admin e remove visibilidade/recebimento de reservas até a
  aprovação. Falha na fila deve abortar a publicação em vez de produzir
  sucesso parcial.
- Perfis já aprovados ou suspensos não podem ser rebaixados por republicação.
- Em cadastros antigos sem item em `therapist_verifications`, uma aprovação ou
  suspensão autoritativa em `therapist_profiles` preserva o estado terminal na
  experiência da terapeuta. A UI não cria nem altera histórico de verificação
  retroativamente.
- Dados derivados são somente leitura.
- Documentos privados nunca entram em HTML público, DTO público, busca pública
  ou preview público.
- Cada documento obrigatório possui estado próprio: `uploaded`, `accepted` ou
  `rejected`; pedido de reenvio exige orientação do admin e gera evento de
  auditoria. Essa decisão não aprova nem altera automaticamente a verificação
  geral do profissional.
- A visualização autenticada usa proxy server-side de uma assinatura de 60 s.
  O navegador nunca recebe bucket, path interno ou URL assinada; outro
  terapeuta não pode abrir documentos alheios.
- Capabilities são validadas no frontend e no backend.
- Temas `serene`, `natural`, `warm` e `essential` são universais e seguem
  rascunho/publicação. Não criar gate de plano.
- `bioIllustrationId` permanece apenas como dado legado compatível em banco e
  contratos. A galeria e a renderização pública foram descontinuadas; não criar
  novo consumidor. Os assets históricos em `public/therapists/profile-bio/`
  permanecem versionados para rollback/cache até uma retirada de domínio
  planejada.
- Slug é salvo separadamente e entra em vigor imediatamente. Free mantém o
  identificador numérico de sete dígitos; `custom_profile_slug` libera Premium
  e Premium Plus. O banco é autoridade de normalização, disponibilidade,
  histórico, idempotência e advisory lock.
- Antes do rollout, executar
  `supabase/audits/therapist_public_slug_preflight.sql`; colisão entre
  profissionais interrompe a aplicação.
- Sem mocks silenciosos em produção.
- Links de vídeo externos são limitados a YouTube/Vimeo no contrato de edição;
  o perfil público converte esses links para os hosts de embed allowlisted. Não
  transformar URL arbitrária em `iframe`.

## Dados privados de identidade

- `therapist_private_identity` guarda, separadamente dos documentos privados,
  CPF/RG/passaporte normalizado e endereço informado pelo próprio terapeuta.
- A edição fica em `/terapeuta/configuracoes`, em `Dados da conta`, com
  máscaras de CPF, RG e CEP. Passaporte aceita letras e números sem máscara
  brasileira universal.
- A tabela só é lida/escrita pela identidade autenticada do terapeuta via
  `get_therapist_private_identity_v1` e
  `save_therapist_private_identity_v1`; nenhum desses campos entra em DTO ou
  view pública.
- A projeção administrativa `admin_get_therapist_profile_review_v1` mostra
  conteúdo editorial, serviços e os dados de identidade necessários para a
  moderação Admin-only. Documentos privados continuam fora dessa projeção e
  usam o fluxo privado de documentos.

## UI

- Usar `AuthenticatedShell`.
- Usar `src/components/app-page`.
- `/terapeuta/perfil` continua sendo uma leitura orientada e não um formulário,
  mas quando o cadastro ainda depende de documentos privados ou está em análise
  administrativa a rota deve trocar a prévia pública por uma superfície de
  progresso/envio honesta, com etapas, pendências e orientação do próximo
  passo.
- `/terapeuta/perfil/editar` deve conter header, progresso, formulário
  numerado, temas, link público, upload/mídia, módulos
  gerenciados, aviso importante e save bar.
- Evitar CTAs conflitantes na primeira configuração: não mostrar `Salvar
rascunho` como ação concorrente quando o perfil ainda não tem versão
  publicada.
- Rascunhos só aparecem como aviso na rota principal; a versão pública
  publicada continua sendo a prévia renderizada.
- Upload público deve usar `therapist-public-media`; documentos permanecem fora
  do preview.
- Ao escolher uma foto de perfil, o editor deve mostrar imediatamente uma
  prévia local antes da confirmação do upload. Essa prévia não equivale a
  publicação: somente uma foto enviada com sucesso e publicada chega às
  superfícies públicas.
- Upload privado deve usar `therapist-private-documents`, com os tipos
  obrigatórios `identity_document` e `address_proof`, validação de assinatura
  de arquivo, tamanho máximo de 10 MB, tipos PDF/JPG/PNG e linguagem de
  produto sem expor buckets ou detalhes técnicos.
- A UI deve deixar claro que os documentos são privados, usados apenas para
  validação administrativa e podem ser substituídos pelo terapeuta via nova
  anexação do mesmo tipo.
- Usar `TESDialog` para confirmações.
- Manter `h1` único.
- Labels visíveis e touch targets de pelo menos 44px.
- Não prometer cura, diagnóstico ou resultado.

## Cache

- Draft/discard: não invalidar público.
- Publish/unpublish/update_slug: revalidar `therapist-profile`, `therapist-search`, `/`,
  `/terapeutas` e `/terapeutas/:slug`.

## QA

- Typecheck, lint, build.
- Vitest para parsers, mappers e componente.
- Vitest para upload client-side e falha sem fallback.
- Vitest para rota `/api/therapist/profile/media`: sessão, validação,
  capability, path público protegido e falha sanitizada de Storage.
- Vitest para rota `/api/therapist/profile/documents`: sessão, encaminhamento
  autenticado, falha sanitizada e ausência de vazamento de metadados
  sensíveis.
- Deno para Edge command.
- pgTAP para RLS, publicação, rascunho, fila administrativa, privacidade,
  slug, histórico, entitlement, downgrade e concorrência.
- Validar que view pública não expõe campos administrativos.
- E2E `tests/e2e/therapist-profile.spec.ts`: login do terapeuta, preview-first,
  navegação para edição, rascunho, publicação, perfil público, ausência de
  documentos públicos e responsividade.
- E2E local `tests/e2e/therapist-private-documents.spec.ts`: ciclo completo de
  documentos privados. Para HML, usar exclusivamente
  `tests/e2e/therapist-private-documents.hml.spec.ts` com
  `HML_PRIVATE_DOCUMENTS_E2E=true`, URL HTTPS compartilhada em
  `HML_PRIVATE_DOCUMENTS_E2E_BASE_URL` e fixtures dedicadas. Não usar contas
  desconhecidas, não registrar o token de compartilhamento e não fornecer
  defaults locais nesse cenário.
