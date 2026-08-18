# ADR-010 — Meu Perfil: rascunho privado e publicação pelo terapeuta

Status: aceito em 2026-07-28; ampliado em 2026-08-18.

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
- Os temas oficiais `serene`, `natural`, `warm` e `essential` e a ilustração
  opcional da bio pertencem ao mesmo fluxo de rascunho/publicação. Todos os
  planos podem usá-los; o tema afeta somente o hero público.
- O slug é uma identidade operacional separada do rascunho: entra em vigor
  imediatamente, usa histórico sem cadeias de redirect e é alterado pelo mesmo
  `therapist-profile-command`.
- Todo terapeuta possui `free_public_slug` numérico estável de sete dígitos.
  Free usa esse identificador; Premium e Premium Plus podem escolher slug
  personalizado. Downgrade restaura o identificador e upgrade o preserva até
  uma escolha explícita.
- Normalização, nomes reservados, entitlement, unicidade, idempotência e locks
  de concorrência permanecem no PostgreSQL. O cliente não recebe escrita direta
  nas tabelas nem identidade interna de outro profissional.

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
- O rollout de slug exige a auditoria read-only
  `supabase/audits/therapist_public_slug_preflight.sql`; colisão entre slug
  vigente e histórico de profissionais diferentes interrompe a migration.
