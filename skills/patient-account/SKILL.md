---
name: patient-account
description: Implementar e manter a página Minha conta do paciente TES, incluindo dados pessoais, endereço, foto, segurança e resumo financeiro.
---

# Minha conta do paciente

## Escopo

- Rota canônica: `/app/configuracoes/perfil`.
- Entrada compatível: `/app/configuracoes` redireciona para a página de perfil.
- Shell: `src/app/(authenticated)/layout.tsx` e `src/components/authenticated-shell/`.
- Feature: `src/features/patient-account/`.
- Figma: a conexão com o arquivo `Projeto Terapeuta Eu Sou Atualizado` pediu reautenticação durante esta implementação; o frame específico desta página não foi identificado nos arquivos analisados.

## Fontes obrigatórias

1. `AGENTS.md`.
2. `docs/product/sitemap.md`, `docs/product/routes-map.md` e `docs/product/page-inventory.md`.
3. `docs/design-system/experience-principles.md`, `docs/design-system/density.md` e `docs/design-system/anti-patterns.md`.
4. `docs/design-system/design-system.md`, `docs/design-system/composition-patterns.md`, `docs/design-system/interaction-patterns.md` e `docs/design-system/tokens.md`.
5. `src/lib/routes.ts`, `src/lib/auth/patient-session.ts`, `src/components/app-page/` e `src/components/tes/`.

## Dados e segurança

- A leitura server-side consulta `profiles`, `patient_profiles`, `session_payments`, `bookings` e `therapist_profiles` com o token do paciente.
- Pagamentos são resumidos a partir de `session_payments`; o navegador não decide confirmação, reembolso ou qualquer efeito financeiro.
- O endereço é armazenado em `patient_profiles.metadata.account.address` até existir um contrato de endereço dedicado; a chave deve ser preservada ao atualizar outros metadados.
- Alterações de nome, telefone, endereço, senha e avatar passam pelo Edge Function `patient-account-command` e validam o paciente pelo token autenticado.
- O avatar usa o bucket local `patient-public-media`; a conta e o shell devem reaproveitar essa mesma URL, sem enviar tokens ou conteúdo de `.env` para o cliente.

## UI e copy

- Reusar `AppPageHeader`, `AppPageGrid`, `AppPageMain`, `AppPageAside`, `AppPageSection`, `TESButton` e `PasswordVisibilityToggle`.
- Usar “encontro” para a linguagem do paciente e “pagamento” para o resumo financeiro.
- Informações pessoais são editáveis; e-mail é exibido como dado de acesso e não pode ser alterado nesta página.
- O endereço é opcional e a página não deve exigir dados além do necessário.
- Não prometer cura, resultado, segurança absoluta ou qualquer efeito clínico.

Erros de salvar perfil, enviar avatar e alterar senha devem usar
`TESFeedbackDialog`; sucesso continua inline e falhas de carregamento ficam na
superfície de carregamento correspondente.

## Estados e QA

- Validar carregamento, erro honesto, sem pagamentos, pagamentos recentes, dados alterados, salvando, sucesso, erro de validação e erro de upload.
- Conferir desktop em aproximadamente 1440px e mobile entre 375px e 430px, sem overflow horizontal.
- Confirmar que erros de mutação aparecem centralizados, inclusive em mobile,
  sem exigir rolagem até o topo para serem percebidos.
- Confirmar foco visível, rótulos associados, botões de ícone nomeados e alvos de toque de no mínimo 44px.
- Rodar `npm run typecheck`, `npm run lint` e `npm run build` sequencialmente quando houver memória disponível.

## Pendências

- Homologação de upload no Storage e provisionamento remoto do bucket permanecem pendentes; esta alteração declara o bucket no `supabase/config.toml` para o ambiente local.
### Contrato de telefone

`PhoneInput` mantém o número nacional em `phone` e o DDI em
`phone_country_code`; linhas antigas sem DDI usam `55` apenas como fallback de
leitura.
