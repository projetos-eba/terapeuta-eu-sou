# Admin email management

Use esta skill ao alterar `/admin/configuracoes/emails` ou
`/admin/configuracoes/emails/eventos/[actionKey]`.

Fontes: `AGENTS.md`, `skills/email-delivery/SKILL.md`,
`supabase/functions/_shared/email/registry.ts`,
`email_action_settings`, `email_delivery_logs`, `docs/email/` e
`docs/product/routes-map.md`. Referência Figma de Configurações Admin:
node `13425:778`; padrões administrativos: node `12857:666`.

Regras: defaults vivem no código; o banco armazena apenas overrides. O preview
usa fixtures fictícias e iframe sandboxed. Nunca permitir destinatário livre,
tokens fora da allowlist, HTML executável, credenciais ou edição de provider.
Admin usa `admin.settings.read/manage`; paciente e terapeuta não acessam rota,
API ou Edge Function. O provider global é Hostinger Mail API; a UI pode apenas
escolher remetentes ativos sincronizados. O registry determina categorias,
action keys, tokens e se automação existe. Sem gatilho automático, persistir e
mostrar somente envio manual. Logs mascaram destinatário e erro; retry segue a
outbox, não a interface administrativa.

Checklist de QA: entrada visível em `/admin/configuracoes`; central com estados
loading/erro/vazio/provider indisponível; evento allowlisted; destinatário
resolvido; preview sem execução de script; salvar/restaurar/reload; desktop,
tablet e mobile. Copy não promete resultado terapêutico e não exibe termos de
desenvolvimento ao usuário final.
