# Perfil do Terapeuta M1

Status documental: `functional` local para `/terapeuta/perfil`;
`data_integrated` para propagação pública, dependente de cache e ambiente.

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
