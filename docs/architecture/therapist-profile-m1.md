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

O mesmo comando também executa `check_slug_availability` e `update_slug`.
Essas ações não criam API paralela: o PostgreSQL normaliza, valida capability,
consulta o namespace atual/histórico e serializa a troca. Tema e ilustração
continuam dentro de `save_draft`/`publish`; slug é imediato e independente.

### Identidade visual pública

O registro central em `src/features/therapist-profile/personalization.ts`
mantém temas e ilustrações em uma única fonte para editor e perfil público. Os
IDs persistidos não identificam o arquivo visual; eles permanecem estáveis para
que perfis já publicados renderizem a arte oficial atual.

| ID persistido     | Arte oficial      | Arquivo versionado                 |
| ----------------- | ----------------- | ---------------------------------- |
| `organic_flow`    | Planta serena     | `profile-bio/serene-plant.png`     |
| `gentle_horizon`  | Planta natural    | `profile-bio/natural-plant.png`    |
| `warm_layers`     | Canto acolhedor   | `profile-bio/warm-chair.png`       |
| `essential_lines` | Folhas essenciais | `profile-bio/essential-leaves.png` |

`null` continua representando `Sem ilustração`. Os SVGs históricos permanecem
versionados apenas para compatibilidade de assets; nenhuma superfície ativa os
referencia. As prévias dos temas usam a mesma camada de fundo e composição do
hero. `essential` preserva a composição editorial, sem arte dominante.

`/api/therapist/profile/media` valida sessão, tipo, tamanho e capabilities,
envia mídia pública para `therapist-public-media` com o token autenticado do
terapeuta e retorna somente URL pública. Não usa `service_role` no navegador.

Edge Function:

- `read`;
- `save_draft`;
- `discard_draft`;
- `publish`;
- `unpublish`.

### Documentos privados para análise

O cadastro inicial pode exigir `Documento de identidade` e `Comprovante de
endereço`. A superfície de progresso em `/terapeuta/perfil` mostra essas
pendências e permite ao terapeuta anexar ou substituir cada documento sem
transformar o fluxo em uma confirmação automática.

- `POST /api/therapist/profile/documents` encaminha o upload autenticado para
  a Edge Function `therapist-private-documents`;
- o backend valida assinatura, MIME e limite de 10 MB antes de gravar no bucket
  privado; a interface e todos os adaptadores aceitam PDF, JPG e PNG;
- uma substituição cria o novo registro antes de arquivar a versão anterior do
  mesmo tipo, preservando o documento anterior caso o novo upload falhe;
- visualização ocorre por URL assinada temporária, emitida somente depois de
  autenticação e autorização; path de Storage e URL assinada não fazem parte do
  DTO de UI;
- a rota autenticada faz proxy server-side da assinatura temporária (60 s), de
  modo que navegador nenhum recebe bucket, path interno ou URL assinada;
- cada documento obrigatório tem decisão própria (`uploaded`, `accepted` ou
  `rejected`); solicitar reenvio exige uma orientação e registra evento
  imutável de auditoria, sem alterar automaticamente a verificação geral;
- a aba `Documentos` em `/admin/profissionais/:id` usa adapter administrativo
  próprio e também solicita uma URL temporária. Ela não usa projection pública
  do perfil.

O envio deixa o documento em estado pendente de conferência. Ele não aprova o
perfil, não publica o profissional e não confirma elegibilidade por si só.

### Homologação privada de documentos

`tests/e2e/therapist-private-documents.spec.ts` cobre o ciclo completo local.
O cenário integrado usa
`tests/e2e/therapist-private-documents.hml.spec.ts` e só executa quando
`HML_PRIVATE_DOCUMENTS_E2E=true`. Ele exige URL HTTPS compartilhada em
`HML_PRIVATE_DOCUMENTS_E2E_BASE_URL` e credenciais externas das fixtures
dedicadas de terapeuta, segundo terapeuta e Admin. Cada navegação direta compõe
a URL preservando o parâmetro de compartilhamento; traces, vídeos e screenshots
automáticos ficam desativados para não registrar credenciais, cookies ou o
token. O fluxo substitui os documentos de teste pelo caminho real, confirma a
leitura no Admin, aceita uma versão e confirma isolamento do segundo terapeuta.

RPCs:

- `get_private_therapist_profile_editor_v1`;
- `save_therapist_profile_draft_v1`;
- `discard_therapist_profile_draft_v1`;
- `publish_therapist_profile_draft_v1`;
- `unpublish_therapist_profile_v1`.

Todas as mutações usam `requestId`, `profile_version` e ledger
`therapist_profile_mutation_requests`.

### Publicação e revisão administrativa

A publicação de um perfil elegível e sua entrada na revisão administrativa são
uma única unidade transacional. O trigger
`sync_therapist_verification_queue_on_publish`, apoiado por
`sync_therapist_verification_queue_on_publish_v1`, garante que:

- perfil publicado sem verificação receba uma entrada `submitted`;
- reenvio após ajustes ou não aprovação retorne a entrada existente para
  `submitted`, sem duplicá-la;
- `therapist_profiles.status` acompanhe `submitted` ou `in_review`;
- perfis `approved` e `suspended` nunca sejam rebaixados por republicação;
- falha ao sincronizar a fila reverta também a publicação.

O trigger `enforce_therapist_verification_transition` impede que comandos
ignorem a sequência `submitted -> in_review -> decisão`. Ajustes solicitados e
não aprovação podem voltar para análise; aprovação é terminal no fluxo atual.

O backfill da migration `20260811113000` corrige somente perfis com
`public_status = published`, `is_public = true` e estado administrativo ainda
revisável. Ele não aprova registros nem inclui rascunhos não publicados.

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
- Quando a verificação ainda depende de documentação ou está em análise,
  `/terapeuta/perfil` mostra uma progressão do cadastro e a próxima ação real;
  após aprovação, volta à prévia pública da versão publicada.
- Dados derivados continuam somente leitura e aparecem como status, checklist
  ou contexto gerenciado, conforme a superfície.
- Estados de rascunho, alterações não salvas, publicação, despublicação,
  conflito, capability bloqueada e falha de upload são visíveis na UI.

## Privacidade

Views públicas não incluem `legal_name`, `documents_metadata`,
`storage_object_path`, `uploaded_by` nem `profile_payload`. RLS permite que o
terapeuta leia apenas seus documentos privados; paciente e visitante não leem.

URLs para visualização de documentos são temporárias e emitidas por adapter
autorizado. O navegador não recebe credencial de serviço, path interno do
objeto ou acesso direto ao bucket.

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
