---
name: therapist-settings
description: Use when working on the therapist shell settings page, authenticated account settings API, or configuration UI under /terapeuta/configuracoes.
---

# Therapist Settings

## Required Sources

Read `AGENTS.md`, `docs/product/sitemap.md`,
`docs/design-system/design-system.md`, `docs/product/routes-map.md`,
`docs/product/page-inventory.md`, `src/lib/routes.ts` and
`src/lib/auth/therapist-session.ts` before editing this area.

## Figma

- Main reference: `Projeto Terapeuta Eu Sou Atualizado`.
- Node: `13366:6118`.
- The current implementation follows the shared TES shell density, cards,
  typography and purple/lavender tokens. If direct Figma MCP access is not
  available, record the limitation and keep changes aligned to the existing
  `AppPage*` contract.

## Route

Canonical route: `/terapeuta/configuracoes`.

Legacy namespaces `/basico/configuracoes`, `/pro/configuracoes` and
`/plus/configuracoes` are compatibility redirects only.

## Components and Data

- Route: `src/app/(therapist)/terapeuta/configuracoes/page.tsx`.
- UI: `src/features/therapist-settings/components/therapist-settings-page.tsx`.
- API: `src/app/api/therapist/settings/route.ts`.
- CEP server-side: `src/app/api/therapist/address/cep/route.ts`, com consulta
  ao ViaCEP somente após oito dígitos válidos, timeout e fallback manual sem
  expor detalhes do provedor.
- Shared feature files: `src/features/therapist-settings/`.
- Source of account settings: `profiles`.
- Source of public profile state: `therapist_profiles`.
- Source of private identity data: `therapist_private_identity`.
- Source of private documents: `therapist_private_documents` via the
  authenticated `therapist-private-documents` flow.
- Source of plan catalog: `billing_plans` and active `billing_plan_prices`.
- Source of paid subscription state: `therapist_subscriptions`.

Do not use service role in the Next.js app. The route must use the therapist
access token and Supabase RLS.

## Rules

- Editable fields in this page include account data (`display_name`, `phone`)
  and the identity/address information needed for profile approval.
- E-mail is read-only here.
- Identity data and the required identity/address documents are mandatory for
  approval and publication of the therapist profile. The document center lives
  here, not in `Meu perfil`, and must explain privacy, required items and each
  document's current state.
- Public profile content belongs to `/terapeuta/perfil/editar`.
- Availability belongs to `/terapeuta/agenda`.
- Upgrades belong to `/terapeuta/plano`.
- Scheduled downgrade, cancellation and cancellation reversal belong to the
  `Plano e assinatura` section on this page.
- Cancellation keeps the effective paid plan until `current_period_end`.
- Stripe Connect data belongs to `/terapeuta/financeiro?tab=conta`.
- Password changes use the public reset password flow.
- Never log cookies, Authorization headers, Supabase keys or personal secrets.
- Validation errors must be specific enough for the therapist to correct the
  form, but must not expose internal database details.
- CPF is validated by format, repeated digits and checksum before the account
  save. CPF is unique across therapist accounts; a collision returns only
  `Este documento já está em uso em outra conta.`. RG and passport remain
  outside this uniqueness rule.
- Erros de salvamento e upload usam `TESFeedbackDialog`; mensagens inline ficam
  reservadas para sucesso, carregamento e validações diretamente relacionadas ao
  campo.
- O campo Estado aceita digitação natural e normaliza a UF de duas letras no
  parser/contrato de persistência. A consulta de CEP preenche rua, bairro,
  cidade e UF sem sobrescrever número ou complemento, que continuam editáveis.
- A página de configurações é dinâmica e reidrata os documentos privados após
  retorno à rota; upload/substituição atualiza o estado local e solicita refresh
  server-side para preservar o estado persistido.
- The page must make the three states understandable: `Perfil completo` is the
  editorial content, `Cadastro aprovado` is the administrative review, and
  `Perfil publicado` is the public visibility.
- When a private document is rejected for size, its `TESFeedbackDialog` must
  state `Não foi possível concluir a operação, o tamanho do documento excede o
  limite de 10 MB.` without exposing implementation details.
- On desktop, CEP precedes street in one address row. It reserves 120–152 px
  for `00000-000`, keeps the street flexible and stacks naturally on mobile.
- `Salvar meus dados` is the sole account and identity save command; do not
  duplicate that action in the page header.

## Database

Therapists may update only account-facing columns in `profiles`.

Required grant/policy:

- `update (display_name, phone)` for `authenticated`.
- RLS update policy requiring `auth.uid() = id` and `role = 'therapist'`.

Any broader profile update requires a new security review.

CPF normalization is protected by the partial unique index
`therapist_private_identity_cpf_unique_idx`. The private-identity RPC converts
that conflict to `CPF_ALREADY_IN_USE` (`23505`) and never identifies the other
account.

## QA

- Parser rejects invalid names and phone values.
- Mapper accepts Supabase embeds as object or array.
- API rejects unauthenticated and non-therapist users.
- API PATCH sends only `display_name` and `phone`.
- UI exposes one `Salvar meus dados` command for account and identity fields.
- UI shows success, local validation error and safe remote error states.
- After a successful save, the confirmation is brought into view and receives
  focus so the therapist can immediately verify the result.
- The aside uses intrinsic-height cards aligned to the top of the shared grid;
  it contains only `Estado atual` and `Dados protegidos`, without a separate
  preferences panel. The plan action remains a compact button.
- UI renders private document upload/replacement for `identity_document` and
  `address_proof`, with no bucket/path details exposed to the therapist.
- CEP válido, CEP inexistente, timeout/indisponibilidade e edição manual após o
  preenchimento automático.
- Documentos já enviados aparecem no primeiro carregamento e mantêm o botão
  `Substituir documento` após remount/navegação.
- Links point to the canonical shell routes.
- An oversized private document is not forwarded and its error dialog states
  the exact 10 MB document-size limit.
- Parser and API distinguish an invalid CPF from a CPF already used by another
  account; the latter is verified by pgTAP without applying uniqueness to RG
  or passport.
- Desktop CEP and street share an address row in the intended order; mobile
  preserves readable stacking.
- Free sees `Conhecer planos`; Premium can open Premium Plus and cancel;
  Premium Plus can schedule Premium or cancel; a scheduled cancellation can be
  reversed.
- Run `npm run typecheck`, `npm run lint`, `npm run test` and
  `npm run build` for full delivery when the environment permits.

## Known Limitations

- Notification preferences are linked to the messages/support area until a
  dedicated notification-preferences contract exists.
- Public visibility toggles are intentionally read-only here to avoid
  duplicating publication rules from the profile editor.
