versão: 2026-07-12
fonte: project.md — MVP Transacional TES consolidado
próxima revisão: ao alterar stack, perfis, planos ou integrações

> **NUNCA:**
>
> - Inventar stack, rota, componente, integração, token, regra de negócio ou estrutura do Figma.
> - Alterar código sem consultar as fontes relevantes listadas neste arquivo.
> - Criar componente equivalente a um já existente em `src/components/`.
> - Refatorar fora do escopo da solicitação recebida.
> - Expor secrets, credenciais ou valores de `.env` em qualquer output.
> - Afirmar que validação ocorreu sem tê-la executado de fato.
> - Remover rota, componente ou migration sem plano de transição aprovado.
> - Prometer cura, diagnóstico ou resultado garantido em qualquer copy ou comentário de código.
> - Ignorar divergência entre Figma, código, docs e sitemap — registrar sempre.

# AGENTS.md — Terapeuta Eu Sou

Este arquivo orienta o trabalho do Codex neste repositório. Ele deve ser curto, operacional e complementar às fontes principais do projeto, sem repetir o conteúdo completo da documentação.
Raiz real do projeto: `/Users/antoniofelipe/Projeto_Terapeuta_Eu_Sou`.

## 1. Papel do Codex

O Codex atua como agente de desenvolvimento, manutenção, refatoração, controle de qualidade e auditoria de consistência do Terapeuta Eu Sou.
Toda alteração deve respeitar:

- a solicitação atual do usuário;
- o Figma do projeto;
- a documentação central;
- o Design System;
- o sitemap e as rotas canônicas;
- os tokens TES;
- o código existente;
- as regras de segurança e rastreabilidade deste arquivo.
  O produto deve manter uma experiência clara, acolhedora, premium, humana e responsável, sem promessa de cura, diagnóstico ou resultado garantido.

## 2. Ordem de leitura obrigatória

Antes de alterar arquivos, ler somente o necessário para a tarefa, nesta ordem:

1. `AGENTS.md`.
2. Figma atualizado, quando a tarefa envolver UI, fluxo, navegação, visual ou componentes.
3. `docs/product/sitemap.md`.
4. `docs/design-system/design-system.md`.
5. `docs/product/routes-map.md`.
6. `README.md`.
7. Arquivos diretamente afetados pela tarefa.
   Consultar documentos adicionais somente quando necessário e solicitado:

- `docs/design-system/tokens.md`: tokens, design tokens.
- `docs/product/product.md`: entender sobre o produto.
- `docs/product/page-inventory.md`: conteúdo, estados e ações por página.
- `docs/design-system/component-inventory.md`: componentes planejados e prioridades.
- `docs/design-system/COMPONENT_ARCHITECTURE.md`: criação ou alteração de componentes.
- `docs/design-system/COMPONENT_USAGE_GUIDELINES.md`: uso, copy e acessibilidade de componentes.
- `docs/design-system/FIGMA_STORYBOOK_SYNC_MAP.md`: sincronização Figma, código e Storybook.
- `docs/design-system/DESIGN_SYSTEM_FINAL_HANDOFF.md`: histórico do Design System e pendências.
- `docs/design-system/qa-checklist.md`: QA detalhado.
- `docs/design-system/implementation-notes.md`: arquitetura planejada, setup, permissões e variáveis.
- `skills/recreate-figma-pages/*`: recriação de telas rasterizadas do Figma.
  Não alterar código, tokens, rotas ou documentação sem consultar as fontes relevantes.

## 3. Fontes de verdade

Quando houver conflito, usar esta prioridade:

1. Solicitação atual do usuário.
2. `AGENTS.md`.
3. Figma atualizado do arquivo `Projeto Terapeuta Eu Sou Atualizado`.
4. `docs/product/sitemap.md`.
5. `docs/design-system/design-system.md`.
6. `docs/product/product.md`.
7. `docs/product/routes-map.md`.
8. `docs/design-system/tokens.md`.
9. Código existente.
10. Padrões inferidos por recorrência documentada.
    Regras de conflito:

- Registrar a inconsistência explicitamente.
- Explicar impacto e risco.
- Não assumir decisões silenciosamente.
- Não inventar informações.
- Quando algo não puder ser confirmado, escrever exatamente: `Não identificado nos arquivos analisados.`

## 4. Figma

Arquivo principal:

- Nome: `Projeto Terapeuta Eu Sou Atualizado`.
- File key: `OSXJi8tknHHCj82MTY2NbG`.
- URL prioritária: `https://www.figma.com/design/OSXJi8tknHHCj82MTY2NbG/Projeto-Terapeuta-Eu-Sou-Atualizado?node-id=12272-2`.
  Páginas essenciais:
- `↳ Jornadas dos Usuários`, node `12272:2`, frame principal `12280:2`: navegação, fluxos e permissões.
- `↳ Design Telas`, node `5999:10563`: telas por perfil e referência visual.
- `ícones`, node `12450-506`: componentes de ícone antes de criar qualquer placeholder.
- `↳ Sitemap`, node `12259:2`: estrutura visual de navegação.
- `↳ Design System`, node `12304-2`: foundations, component library, product patterns e `Design System / Phase 2 Expansion`.
  Status de acesso registrado:
- Acessado com sucesso via MCP para os nodes `12272:2`, `5999:10563` e `12259:2`.
- `ícones` e `↳ Design System` existem como páginas essenciais, mas seus node IDs diretos ainda precisam ser resolvidos para auditorias futuras via MCP.
  Ao trabalhar com Figma:
- Usar `↳ Jornadas dos Usuários` para fluxo e permissão.
- Usar `↳ Design Telas` para comparação visual.
- Usar `↳ Design System` para componentes, estilos e tokens.
- Usar `ícones` antes de desenhar ícones locais.
- Registrar node IDs relevantes no resumo final.
  Se o Figma não estiver acessível, declarar o bloqueio e continuar apenas com fontes locais.

## Perfis e planos

| Perfil                 | Área logada | Plano         | Enum técnico   | Prefixo de rota |
| ---------------------- | ----------- | ------------- | -------------- | --------------- |
| Paciente               | `/app`      | —             | —              | `/app`          |
| Terapeuta Free         | `/basico`   | Básico / Free | `free`         | `/basico`       |
| Terapeuta Premium      | `/pro`      | Premium       | `premium`      | `/pro`          |
| Terapeuta Premium Plus | `/plus`     | Premium Plus  | `premium_plus` | `/plus`         |
| Admin                  | `/admin`    | —             | —              | `/admin`        |

Regras:

- Em código, usar sempre os enums técnicos: `free`, `premium`, `premium_plus`.
- `Pro` e `Plus` são identificadores técnicos de rota, não copy de interface.
- Nomes comerciais (Básico, Premium, Premium Plus) são decisão de produto e UX.
- `src/lib/routes.ts` é a fonte canônica de rotas. `src/lib/permissions.ts` é a fonte canônica de permissões e recursos por plano.

## 5. Implementação

Stack real identificada:

- Next.js 14 com App Router.
- React 18.
- TypeScript strict.
- Tailwind CSS.
- CSS Variables TES em `src/app/globals.css`.
- shadcn/ui planejado via `components.json`.
- `lucide-react`, `class-variance-authority`, `clsx` e `tailwind-merge`.
- Supabase Postgres (banco transacional) + Supabase Auth + RLS + Edge Functions.
- Sempre seguir as boas práticas de desenvolvimento de software, e arquitetura moderna.
- Stripe: pagamentos de sessão (Separate Charges and Transfers) e assinaturas (Stripe Billing) via Stripe Connect Express.
- Zoom: sessões online via API/SDK (Server-to-Server OAuth), link gerado apenas após pagamento confirmado.
- Storybook: documentado, não instalado.
- Observabilidade: não identificado nos arquivos analisados.
  Regras:
- Usar `src/lib/routes.ts` para rotas.
- Usar `src/lib/permissions.ts` para permissões e recursos por plano.
- Usar `docs/design-system/tokens.md` como fonte única de tokens.
- Títulos e textos primários devem usar `text-brand-deep`/`text-tesText-primary` com valor canônico `#14105A`; não usar hex hardcoded como `#261433` ou variações próximas.
- Não alterar tokens globais sem avaliar impacto visual.
- Procurar componente existente antes de criar outro.
- Não duplicar componentes equivalentes.
- Não refatorar fora do escopo sem justificativa.
- Não quebrar rotas canônicas.
- Não criar abstrações sem necessidade real.
- Manter alterações pequenas e rastreáveis.
  Estado real importante:
- Storybook documentado, não instalado.
- Componentes React do Design System ainda não implementados.
- `src/lib/routes.ts` e `src/lib/permissions.ts` existem como fontes canônicas de rotas e permissões.
- `supabase/` parcialmente estruturado com migrations e Edge Function `match-therapies`.
- Stripe e Zoom: previstos na arquitetura, status de implementação não confirmado nos arquivos analisados.

## 6. QA e definição de pronto

Uma tarefa só pode ser considerada pronta quando:

- respeita Figma e fontes de verdade aplicáveis;
- respeita `src/lib/routes.ts` e `src/lib/permissions.ts`;
- usa tokens TES (`docs/design-system/tokens.md`);
- segue linguagem acolhedora e responsável — sem prometer cura, diagnóstico ou resultado;
- não expõe segredos;
- não salva dados individualizados do Match sem decisão LGPD registrada;
- valida pagamento por webhook Stripe (não apenas por redirecionamento);
- usa idempotência em operações Stripe;
- usa `session_payments` como fonte única de pagamentos de sessão;
- registra ledger para movimentações financeiras em `payment_ledger_entries`;
- cria repasses a partir de `transfer_batches` e `transfer_batch_items`;
- grava snapshot de preço e duração no momento da reserva;
- gera link Zoom apenas após pagamento confirmado via webhook;
- protege `zoom_start_url_encrypted` por RLS (somente terapeuta responsável e admin autorizado);
- protege dados por RLS conforme perfil;
- passa em `npm run typecheck`, `npm run lint` e `npm run build`;
- documenta limitações e riscos;
- lista arquivos alterados.
  Validações padrão:
- Conferir comandos disponíveis no `README.md` e em `package.json`.
- Rodar `npm run typecheck`, `npm run lint` e `npm run build` quando o ambiente permitir.
- Para UI, validar responsividade e comparar com Figma ou `Referencias/{perfil}` quando aplicável.
- Para docs, confirmar que não há referências quebradas nem duplicação desnecessária.
  Se uma validação não for executada, explicar o motivo.

## Gate de confirmação

Pausar e pedir decisão explícita antes de:

- alterar ou criar rota em `src/lib/routes.ts`;
- modificar schema de banco, migration ou policy RLS;
- remover ou renomear componente, hook ou integração existente;
- alterar arquitetura, providers ou layouts;
- adicionar nova dependência ao `package.json`;
- alterar comportamento de autenticação ou permissão;
- criar tabela nova em Supabase sem migration explícita.
  Para alterações documentais, de estilo ou de texto em componente isolado: executar e reportar no resultado.

## 7. Segurança

Nunca:

- commitar `.env`;
- commitar credenciais;
- commitar tokens de acesso;
- expor segredos em logs;
- incluir credenciais em diagnósticos ou outputs;
- copiar chaves privadas para documentação;
- registrar segredos em exemplos de código;
- assumir valores de ambiente sem confirmação.
  Regras específicas para Supabase:
- O app Next deve usar somente variáveis publicáveis com prefixo `NEXT_PUBLIC_`.
- Para Supabase no app Next, usar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Nunca usar `SUPABASE_SECRET_KEYS`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SERVICE_ROLE_KEY` ou `DATABASE_URL` no `.env.example`, `.env.local` ou `.env.production` do app Next.
- Secrets Supabase devem ficar em Supabase Edge Functions ou secrets remotos equivalentes.
  Ao encontrar risco de segurança, registrar o risco sem expor o segredo.

## 9. Atualização contínua

Atualizar este arquivo quando mudarem:

- fontes de verdade;
- stack;
- Design System;
- tokens;
- sitemap;
- rotas;
- estrutura de pastas;
- componentes base;
- permissões;
- scripts;
- integrações;
- autenticação;
- banco de dados;
- deploy;
- processo de QA.
  O Codex deve sugerir atualização do `AGENTS.md` quando detectar desatualização.

## 9.1 Skills locais por página

Toda página implementada ou refatorada deve ter uma skill local correspondente em `skills/`, com `SKILL.md` e, quando aplicável, `agents/openai.yaml`.

Regras:

- A skill deve registrar fontes obrigatórias, node(s) Figma, rotas, componentes, dados dinâmicos, fallback, checklist de QA, copy responsável e pendências conhecidas da página.
- A skill deve ser atualizada junto com a página sempre que mudarem layout, fonte de dados, rota, componente crítico, regra de negócio ou documentação relacionada.
- Exceção: páginas de perfil de terapeuta não usam uma única skill por plano. Devem existir skills por função contemplando simultaneamente Básico, Premium e Premium Plus, para evitar divergência entre os três planos.

## 9.2 Banco, migrations e seeds

Toda alteração de schema, view, function, policy, índice, enum ou projeção pública do Supabase deve ter migration versionada em `supabase/migrations/`.

Regras:

- Seeds, mocks e dados de desenvolvimento devem ser idempotentes e versionados em `supabase/seed.sql` ou em arquivo de seed documentado.
- Nunca criar, ajustar ou popular banco de forma ad hoc sem deixar arquivo rastreável no repositório.
- Migrations devem expor apenas dados compatíveis com a superfície pública/autenticada necessária, sem campos internos ou sensíveis.
- Quando Docker/Supabase local impedir validação, registrar exatamente quais comandos falharam e qual validação ficou pendente.

## 10. Formato de entrega

| Seção                     | Conteúdo esperado                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Resumo**                | O que foi feito e por quê                                                              |
| **Arquivos alterados**    | Lista completa                                                                         |
| **Validação**             | Como foi validado — Figma, lint, build ou leitura manual                               |
| **Comandos executados**   | Lista; registrar falha quando ocorrer                                                  |
| **Limitações/Pendências** | O que não foi possível verificar ou ficou pendente — nunca afirmar o que não aconteceu |
| **Riscos**                | Impactos, conflitos de fonte, e outras coisas mais                                     |
| **Próximos passos**       | Recomendações objetivas relacionadas à entrega                                         |

Skills planejadas para este projeto estão documentadas em `docs/` e no backlog técnico do `project.md` (seção 19).
