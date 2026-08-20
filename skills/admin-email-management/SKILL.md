# Admin email management

Use esta skill ao alterar `/admin/configuracoes/emails`.

Fontes: `AGENTS.md`, `skills/email-delivery/SKILL.md`,
`supabase/functions/_shared/email/registry.ts`,
`email_action_settings` e `email_delivery_logs`.

Regras: defaults vivem no código; o banco armazena apenas overrides. O preview
usa fixtures fictícias e iframe sandboxed. Nunca permitir destinatário livre,
tokens fora da allowlist, HTML executável, credenciais ou edição de provider.
Admin usa `admin.settings.read/manage`; paciente e terapeuta não acessam rota,
API ou Edge Function.
