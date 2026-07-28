# ADR-010 — Meu Perfil: rascunho privado e publicação pelo terapeuta

Status: aceito em 2026-07-28.

## Contexto

O shell do terapeuta precisava editar o perfil público sem criar uma segunda
fonte de verdade e sem revisão administrativa para alterações comuns. O perfil
público existente já derivava de `therapist_profiles` e de
`therapist_profile_content_versions`.

## Decisão

- `therapist_profiles` permanece a identidade profissional canônica.
- `therapist_profile_content_versions` recebe o rascunho editorial e campos
  públicos versionados em `profile_payload`.
- Salvar rascunho não altera views públicas.
- Publicar consome o rascunho, atualiza `therapist_profiles`, cria uma versão
  publicada de conteúdo e invalida apenas superfícies públicas afetadas.
- Administração continua responsável por verificação, suspensão, documentos,
  plano e bloqueios.
- Mutações passam por Edge Function autenticada com `service_role`; a identidade
  do terapeuta é derivada de `auth.users`, nunca de `therapist_profile_id`
  enviado pelo navegador.

## Consequências

- A UI comunica que a propagação pública pode levar até 2 a 3 horas.
- Dados derivados como avaliações, preço inicial, disponibilidade e plano são
  somente leitura no editor.
- Documentos privados usam tabela e bucket separados e não entram em DTOs
  públicos.
- Alterações futuras devem preservar o contrato entre:
  `TherapistProfileEditorData`, `TherapistSearchCard`,
  `TherapistProfilePublicDetail`, `TherapistProfileAdminDetail`,
  `TherapistProfileCompleteness` e `TherapistProfileCapabilities`.
