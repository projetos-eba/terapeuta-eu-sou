# Storybook Audit Report - Terapeuta Eu Sou

Data: 2026-06-14

## Resumo

Storybook ainda não está instalado no projeto.

## Evidências

Arquivos analisados:

- `package.json`
- `src/app/globals.css`
- `tailwind.config.ts`
- `docs/design-system/storybook-plan.md`
- estrutura `src`

Resultado:

- Não existe `.storybook`.
- Não existem arquivos `*.stories.*`.
- Não existem dependências `storybook`, `@storybook/*` ou addons.
- O `package.json` não possui scripts de Storybook.
- A documentação já possui um plano em `docs/design-system/storybook-plan.md`.

## Estado do Código

O projeto está em Next.js 14 com Tailwind.

Dependências relevantes já existentes:

- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `lucide-react`
- `@radix-ui/react-slot`

Essas dependências são compatíveis com uma arquitetura shadcn/ui-like.

## Tokens no Código

Existem tokens em:

- `src/app/globals.css`
- `tailwind.config.ts`

Cobertura atual:

- marca;
- superfícies;
- texto;
- status;
- tipografia;
- radius;
- sombras;
- sidebar/topbar.

Gaps:

- profile colors;
- border tokens explícitos;
- component tokens;
- opacity;
- elevation;
- spacing completo;
- size tokens.

## Riscos

| Risco | Impacto |
|---|---|
| Storybook ausente | Não há validação isolada de componentes |
| Props não implementadas | Variants do Figma podem divergir do código |
| Tokens parciais no Tailwind | Risco de hardcode na implementação |
| Sem a11y addon | Contraste e foco não são testados de forma contínua |
| Sem visual regression | Mudanças futuras podem quebrar aparência |

## Conclusão

O Storybook deve ser criado após a base de tokens do código ser expandida. O Figma agora é a fonte visual expandida da Fase 2, mas a sincronização técnica ainda está pendente.
