# Perfil do Terapeuta M1/M2

Status documental: `functional` local para `/terapeuta/perfil` e
`/terapeuta/perfil/editar`; `data_integrated` para propagação pública,
dependente de cache e ambiente.

## Fontes de verdade

| Superfície          | Fonte                                                                          | Observação                                              |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Editor privado      | `get_private_therapist_profile_editor_v1`                                      | Read model privado via Edge Function.                   |
| Identidade canônica | `therapist_profiles`                                                           | Nome público, slug, foto, status, plano e visibilidade. |
| Rascunho            | `therapist_profile_content_versions.status = draft`                            | Não aparece em views públicas.                          |
| Publicado           | `therapist_profile_content_versions.status = published` + `therapist_profiles` | Alimenta `/terapeutas` e `/terapeutas/:slug`.           |
| Documentos privados | `therapist_private_documents` + bucket `therapist-private-documents`           | Nunca expor em HTML ou DTO público.                     |
| Mídia pública       | bucket `therapist-public-media`                                                | Separado de documentos administrativos.                 |

## Read Models

- `TherapistProfileEditorData`: contrato privado do shell.
- `TherapistProfileCompleteness`: completude calculada.
- `TherapistProfileCapabilities`: permissões derivadas do plano.
- `TherapistProfilePublicDetail`: continua vindo das views públicas.
- `TherapistSearchCard`: continua vindo de `public_therapist_search`.
- `TherapistProfileAdminDetail`: permanece escopo admin futuro, sem usar o DTO
  público.

## Operações

`/api/therapist/profile` valida o payload e encaminha para
`therapist-profile-command`.

`/api/therapist/profile/media` valida sessão, tipo, tamanho e capabilities,
envia mídia pública para `therapist-public-media` com o token autenticado do
terapeuta e retorna somente URL pública. Não usa `service_role` no navegador.

Edge Function:

- `read`;
- `save_draft`;
- `discard_draft`;
- `publish`;
- `unpublish`.

RPCs:

- `get_private_therapist_profile_editor_v1`;
- `save_therapist_profile_draft_v1`;
- `discard_therapist_profile_draft_v1`;
- `publish_therapist_profile_draft_v1`;
- `unpublish_therapist_profile_v1`.

Todas as mutações usam `requestId`, `profile_version` e ledger
`therapist_profile_mutation_requests`.

## Cache

| Evento             | Tags/rotas                                                                        |
| ------------------ | --------------------------------------------------------------------------------- |
| Salvar rascunho    | Não invalida público.                                                             |
| Descartar rascunho | Não invalida público.                                                             |
| Publicar           | `therapist-profile`, `therapist-search`, `/`, `/terapeutas`, `/terapeutas/:slug`. |
| Despublicar        | Mesmas tags/rotas de publicação, com urgência operacional maior.                  |

Prazo comunicado na UI: alterações publicadas podem levar até 2 a 3 horas para
aparecer em todas as superfícies públicas.

## Experiência M2

- `/terapeuta/perfil` segue o frame Figma `13366:2408` como tela preview-first:
  mostra a versão pública publicada, status e checklist, com CTA para edição.
- `/terapeuta/perfil/editar` segue o frame Figma `13366:7289` com header de
  edição, card de progresso, formulário principal, mídia, módulos gerenciados e
  save bar.
- O preview principal usa `PublicTherapistProfile` como DTO, derivado da versão
  publicada do editor privado por mapper, e nunca inclui documentos, campos
  administrativos ou paths privados. Rascunhos aparecem somente como aviso na
  rota principal até serem publicados.
- Uploads públicos aceitam foto, capa de vídeo e vídeo, com validação client e
  server-side. Documentos continuam em fluxo privado.
- Dados derivados continuam somente leitura e aparecem como status, checklist
  ou contexto gerenciado, conforme a superfície.
- Estados de rascunho, alterações não salvas, publicação, despublicação,
  conflito, capability bloqueada e falha de upload são visíveis na UI.

## Privacidade

Views públicas não incluem `legal_name`, `documents_metadata`,
`storage_object_path`, `uploaded_by` nem `profile_payload`. RLS permite que o
terapeuta leia apenas seus documentos privados; paciente e visitante não leem.

Antivírus/varredura de documentos: não identificado nos arquivos analisados. O
campo `validation_state` registra a limitação e permite integração futura.

## Consumidores

| Consumidor               | DTO                                        | Null/não publicado                                 |
| ------------------------ | ------------------------------------------ | -------------------------------------------------- |
| `/terapeutas`            | `TherapistSearchCard`                      | Perfil não publicado não aparece.                  |
| `/terapeutas/:slug`      | `PublicTherapistProfile`                   | Slug ausente retorna 404.                          |
| Home                     | cards públicos                             | Sem perfil público reduz lista.                    |
| Terapias                 | relacionados por `public_therapist_search` | Sem profissional mostra estado vazio.              |
| Reserva                  | serviço ativo + perfil público             | Serviço/terapeuta indisponível bloqueia reserva.   |
| Favoritos                | profile id público                         | Perfil oculto não deve renderizar detalhe público. |
| Agenda                   | `therapist_profile_id` privado             | Não depende de draft.                              |
| Mensagens                | perfil autenticado                         | Não expõe documentos.                              |
| Avaliações               | reviews publicadas                         | Sem avaliação retorna “Ainda sem dados”.           |
| Financeiro               | pagamentos/sessões                         | Não usa campos editoriais.                         |
| Administração            | perfil + verificação/documentos            | Usa superfície própria, não views públicas.        |
| E-mails/notificações/SEO | nome/slug publicados                       | Despublicação exige invalidação.                   |
