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

Na rota `/terapeuta/perfil`, a prévia publicada lê o mesmo contrato de
`/terapeutas/:slug` (`getPublicTherapistProfileResult`). Ela não usa o mapper
editorial local como aproximação visual.

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

O upload de foto pública persiste o rascunho de mídia por meio do comando
`save_media_draft` e do RPC `save_therapist_profile_media_draft_v1`. Esse comando
altera somente `photoUrl`, exige versão/request idempotente, aceita perfil ainda
incompleto e remove o objeto recém-enviado quando a persistência falha, sempre
que possível. A publicação continua sendo uma ação separada.

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
- O terapeuta envia os documentos privados obrigatórios em
  `/terapeuta/configuracoes`; `/terapeuta/perfil` e
  `/terapeuta/perfil/editar` apenas mostram o que falta e orientam para essa
  área. A administração continua responsável por revisão, aprovação,
  suspensão, plano e bloqueios.
- A publicação só pode avançar quando os dados de identidade/endereço e os
  documentos obrigatórios estiverem completos. A interface deve distinguir:
  `Perfil completo` (conteúdo editorial preenchido), `Cadastro aprovado`
  (análise administrativa concluída) e `Perfil publicado` (versão visível para
  o público).
- A primeira publicação de perfil ainda não aprovado envia atomicamente o
  conteúdo para a fila administrativa e remove visibilidade/recebimento de
  reservas até a decisão. Depois de aprovado, o terapeuta pode publicar uma
  nova versão editorial sem reenfileirar `therapist_verifications`, sem remover
  a visibilidade ou interromper reservas; `profile_published` registra a
  alteração de modo imutável. Perfis suspensos não publicam.
- Depois de publicar, a interface deve confirmar o resultado em `TESDialog`:
  `Publicação enviada com sucesso` quando a resposta já estiver aprovada e
  `Perfil enviado para análise` enquanto a verificação administrativa estiver
  em `submitted` ou `in_review`.
- Quando a administração solicitar ajustes, `changes_requested` ou `rejected`
  deve aparecer como atenção, com a justificativa privada retornada no resumo
  de verificação (`changesRequested` ou `rejectionReason`) visível ao
  terapeuta antes de uma nova publicação.
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
- O catálogo de temas possui quatro opções Free (`serene`, `natural`, `warm` e
  `essential`) e quinze opções Premium/Premium Plus. Free visualiza todas as
  composições, mas só aplica as quatro básicas; Premium e Premium Plus aplicam
  as dezenove. Cada tema define seu `photoShape` (`circle`, `arch`, `oval` ou
  `square`) no catálogo, sem configuração separada para a terapeuta.
- A biblioteca secundária usa `TESDialog`, mantém seleção local até a confirmação
  e encaminha o upsell para `/terapeuta/plano`. Após downgrade, o próximo
  salvamento normaliza um tema Premium para `serene` e a interface avisa a
  terapeuta.
- A nova fonte visual é o Figma `Z42SR0Pi0m307SmcAkDqHb`, nó `14869:2`. O
  frame visual novo não está presente no Figma atual da edição; a divergência
  é intencional e registrada para manutenção.
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
- Horários do fallback demonstrativo são gerados e apresentados no fuso
  `America/Sao_Paulo` (Brasília, UTC−3), sem depender do fuso do servidor.
- A prévia autenticada da versão publicada é uma composição estática do próprio
  perfil público, em canvas desktop de 1440 px reduzido proporcionalmente. Ela
  não é screenshot persistido, não executa reserva, favoritos, compartilhamento,
  vídeo, carrossel ou telemetria e não permite foco, clique, seleção ou cópia.
  Quando a leitura pública falhar, estiver ausente ou não houver publicação,
  mostrar indisponibilidade/estado de publicação honesto; nunca reconstruir o
  perfil com dados do editor nem aceitar `demo` nessa superfície.
- Em um perfil já publicado, `Salvar rascunho` não altera a prévia nem o
  perfil público. A interface deve informar esse efeito, oferecer a publicação
  como próximo passo e comunicar que a propagação pode levar até 2 a 3 horas.
  Depois de publicar, limpar o cache de rotas do navegador antes de voltar a
  `/terapeuta/perfil`; a leitura autenticada da prévia usa o contrato público
  canônico em modo fresco para não reutilizar conteúdo editorial antigo.
- Links de vídeo externos são limitados a YouTube/Vimeo no contrato de edição;
  o perfil público converte esses links para os hosts de embed allowlisted. Não
  transformar URL arbitrária em `iframe`.

## Dados privados de identidade

- `therapist_private_identity` guarda, separadamente dos documentos privados,
  CPF/RG/passaporte normalizado e endereço informado pelo próprio terapeuta.
- A edição fica em `/terapeuta/configuracoes`, em `Dados da conta`, com
  máscaras de CPF, RG e CEP. Passaporte aceita letras e números sem máscara
  brasileira universal.
- O terapeuta lê/escreve a tabela por `get_therapist_private_identity_v1` e
  `save_therapist_private_identity_v1`. A Edge Function
  `therapist-private-documents` tem somente leitura server-side com
  `service_role` para calcular prontidão; nenhum desses campos entra em DTO ou
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
  progresso honesta, com etapas, pendências e orientação para
  `/terapeuta/configuracoes`.
- `/terapeuta/perfil/editar` deve conter header, progresso, formulário
  numerado, temas, link público, upload de mídia pública, módulos gerenciados,
  aviso importante e save bar. Não deve conter upload de documento privado.
- A seção de edição `Conteúdos / Reflexões` está temporariamente fora da
  superfície visível do editor. Os campos legados permanecem nos contratos para
  preservar dados já existentes, mas não há CTA para criar ou editar novos
  conteúdos até decisão posterior do produto.
- Evitar CTAs conflitantes na primeira configuração: não mostrar `Salvar
rascunho` como ação concorrente quando o perfil ainda não tem versão
  publicada.
- Rascunhos só aparecem como aviso na rota principal; a versão pública
  publicada continua sendo a prévia renderizada. A página de edição preserva
  sua prévia de rascunho, pois ela não representa o que já está público.
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
- A UI deve deixar claro que os documentos são privados e usados apenas para
  validação administrativa. Documento `accepted` mostra somente seu estado
  aprovado e não oferece envio/substituição; novo envio só volta a ser
  permitido para o tipo cujo Admin solicitou reenvio.
- A comunicação editorial usa `Sua apresentação` para o texto principal. Os
  campos legados `headline`, `shortIntro` e `bio` permanecem apenas no contrato
  interno e não aparecem como nomes técnicos para o terapeuta.
- `Como posso te guiar` usa os dez temas canônicos do Match (`Emoções e
Bem-Estar`, `Autoconhecimento e Transformação`, `Relacionamentos`,
  `Autoestima e Poder Pessoal`, `Propósito e Direção`, `Espiritualidade e
Conexão Interior`, `Energia e Equilíbrio Energético`, `Libertação e Renovação`,
  `Corpo, Relaxamento e Qualidade de Vida` e `Vida Profissional e
Prosperidade`). O terapeuta pode selecionar até quatro; os cards exibem ícones
  do vocabulário visual compartilhado e persistem no contrato existente de
  `guideItems`. Itens personalizados antigos permanecem até uma nova seleção.
- `Sua apresentação` e `Minha essência` exibem ajuda contextual no ícone
  informativo, acessível por foco, hover e clique, com explicações em linguagem
  de produto.
- No bloco `Outras partes do seu perfil`, `Avaliações` fica oculto para Free;
  permanece visível para Premium e Premium Plus. A rota protegida continua
  sendo a autoridade de acesso.
- Usar `TESDialog` para confirmações.
- Manter `h1` único.
- Labels visíveis e touch targets de pelo menos 44px.
- Não prometer cura, diagnóstico ou resultado.
- Falhas ao salvar ou publicar devem informar a causa acionável do contrato (por
  exemplo, campo inválido, limite de caracteres, link de vídeo ou conflito de
  versão), sem expor detalhes internos do banco ou da infraestrutura.
- Falhas de upload ou de persistência da foto são apresentadas em
  `TESFeedbackDialog`; a prévia/rascunho volta a aparecer depois de sair e
  retornar à página.

QA adicional: validar o comando `save_media_draft` com perfil incompleto,
idempotência, conflito de versão, remount após navegação e limpeza best-effort
do objeto quando a persistência falhar. A publicação deve continuar separada.

## Salvamento automático

- Campos editoriais, seleção de tema e mídia de apresentação elegível devem
  salvar automaticamente como rascunho após uma breve pausa de edição. Esse
  salvamento não abre modal, não publica o perfil e preserva alterações feitas
  enquanto uma gravação anterior está em curso. Erros mantêm o conteúdo no
  editor e aparecem de forma acionável na barra de rascunho.
- Um link HTTPS legado fora de YouTube/Vimeo pode ser preservado apenas quando
  já existe na versão ativa do editor; ele não libera novos domínios nem pode
  ser publicado. O terapeuta deve substituí-lo por YouTube, Vimeo ou vídeo
  enviado antes da publicação.
- URLs HTTP legadas de foto/capa podem permanecer no rascunho para não bloquear
  edições de conteúdo existentes. Todo novo upload público continua vindo do
  adaptador autenticado e usa URL HTTPS.

## Cache

- Draft/discard: não invalidar público.
- Publish/unpublish/update_slug: revalidar `therapist-profile`, `therapist-search`, `/`,
  `/terapeutas` e `/terapeutas/:slug`.
- Após publicar no editor, executar `router.refresh()` para invalidar a cache
  de rotas do cliente e impedir que a volta para `/terapeuta/perfil` mostre a
  miniatura anterior.

## QA

- Typecheck, lint, build.
- Vitest para parsers, mappers e componente.
- Vitest para a fonte pública da prévia, seus estados `published`,
  `not_published`, `not_found` e `unavailable`, ausência de interações/telemetria
  no modo estático e escala integral do canvas em desktop, tablet e mobile.
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
