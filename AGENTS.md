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

## 5. Implementação

Stack real identificada:

- Next.js 14 com App Router.
- React 18.
- TypeScript strict.
- Tailwind CSS.
- CSS Variables TES em `src/app/globals.css`.
- shadcn/ui planejado via `components.json`.
- `lucide-react`, `class-variance-authority`, `clsx` e `tailwind-merge`.

Regras:

- Usar `src/lib/routes.ts` para rotas.
- Usar `src/lib/permissions.ts` para permissões e recursos por plano.
- Usar `docs/design-system/tokens.md` como fonte única de tokens.
- Não alterar tokens globais sem avaliar impacto visual.
- Procurar componente existente antes de criar outro.
- Não duplicar componentes equivalentes.
- Não refatorar fora do escopo sem justificativa.
- Não quebrar rotas canônicas.
- Não criar abstrações sem necessidade real.
- Manter alterações pequenas e rastreáveis.

Estado real importante:

- Storybook está documentado, mas não instalado.
- Componentes React do Design System ainda não estão implementados.
- Autenticação, banco de dados, pagamento, email, vídeo, IA, storage, observabilidade e deploy: `Não identificado nos arquivos analisados.`

## 6. QA e definição de pronto

Uma tarefa só pode ser considerada pronta quando:

- respeita Figma e fontes de verdade aplicáveis;
- respeita sitemap, rotas e permissões;
- respeita `design-system.md` e `tokens.md`;
- não cria inconsistências visuais ou padrões paralelos;
- não expõe segredos;
- passa nas validações disponíveis;
- registra comandos executados;
- registra limitações e riscos;
- lista arquivos alterados.

Validações padrão:

- Conferir comandos disponíveis no `README.md` e em `package.json`.
- Rodar `npm run typecheck`, `npm run lint` e `npm run build` quando o ambiente permitir.
- Para UI, validar responsividade e comparar com Figma ou `Referencias/{perfil}` quando aplicável.
- Para docs, confirmar que não há referências quebradas nem duplicação desnecessária.

Se uma validação não for executada, explicar o motivo.

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

Ao encontrar risco de segurança, registrar o risco sem expor o segredo.

## 8. O que o Codex não deve fazer

Nunca inventar:

- stack;
- rotas;
- componentes;
- scripts;
- integrações;
- regras de negócio;
- estrutura do Figma;
- tokens;
- permissões;
- autenticação;
- banco de dados;
- deploy.

Nunca:

- ignorar documentação central;
- criar padrões visuais paralelos;
- criar tokens sem justificativa;
- modificar comportamento fora da solicitação;
- ocultar conflitos entre Figma, docs e código;
- afirmar que algo foi validado sem validação real.

Quando não souber algo, registrar: `Não identificado nos arquivos analisados.`

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

## 10. Formato esperado de entrega

Toda entrega deve conter:

- **Resumo:** o que foi feito.
- **Arquivos alterados:** lista completa.
- **Validação:** como foi validado.
- **Comandos executados:** comandos relevantes.
- **Limitações:** o que não foi possível verificar.
- **Riscos:** impactos ou pendências.
- **Próximos passos:** recomendações objetivas.

## 11. Recomendações futuras

Skills úteis para este projeto:

- `tes-token-sync`: sincronizar `globals.css` e `tailwind.config.ts` com `tokens.md`.
- `tes-storybook-sync`: criar Storybook a partir de `FIGMA_STORYBOOK_SYNC_MAP.md`.
- `tes-route-qa`: validar páginas contra sitemap, rotas e permissões.
- `tes-visual-qa`: comparar UI com Figma e referências locais.
- `tes-copy-guard`: revisar linguagem TES.
- `tes-security-env-audit`: revisar variáveis de ambiente e exposição de segredos.
