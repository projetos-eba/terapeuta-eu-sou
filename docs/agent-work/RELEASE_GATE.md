# Release Gate Multi-Agent

Este gate complementa, sem reduzir, a definição de pronto do `AGENTS.md` e os
runbooks de cada domínio.

## Estados

| Estado              | Significado                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `NOT_READY`         | Há P0/P1, contrato indefinido, build quebrado ou evidência crítica ausente. |
| `PARTIAL`           | Parte dos gates foi executada; faltam validações obrigatórias.              |
| `READY_FOR_HML`     | Integração local aprovada e pronta para escrita/testes controlados em HML.  |
| `HOMOLOGATED`       | HML real foi executada com evidências, sem P0/P1 aberto.                    |
| `READY_FOR_RELEASE` | HML, segurança, legal, operação e go/no-go humano concluídos.               |

## Ordem do gate

1. Owner executa self-test e entrega handoff.
2. Reviewer de domínio valida contrato e impactos.
3. Security & Supabase revisa migrations, RLS, grants, Auth, Storage e
   boundaries quando aplicável.
4. Orchestrator integra mudanças compatíveis.
5. QA & Release executa o gate integrado.
6. Humano autoriza HML/produção e qualquer ação externa de risco.

## Checklist mínima

| Gate              | Evidência mínima                                                     | Quando                                               |
| ----------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Formatação        | `npm run format:check`                                               | Toda entrega com arquivos suportados pelo Prettier.  |
| Lint              | `npm run lint`                                                       | Toda alteração de app/docs coberta pelos scripts.    |
| TypeScript        | `npm run typecheck`                                                  | Código TypeScript/Next.                              |
| Unitários         | `npm run test` e testes focados                                      | Código de domínio/UI.                                |
| Deno              | `npm run test:deno`                                                  | Edge Functions/módulos compartilhados.               |
| Migrations        | `npx supabase db reset`                                              | Schema, seeds, functions, views, policies ou grants. |
| SQL lint          | `npx supabase db lint`                                               | Mudança Supabase.                                    |
| RLS/pgTAP         | `npx supabase test db` e teste focado                                | Mudança Supabase ou contrato de autorização.         |
| Tipos             | Regenerar e revisar `database.types.ts`                              | Contrato público do banco alterado.                  |
| Build             | `npm run build`                                                      | Antes de QA integrado.                               |
| Playwright        | Specs focadas e fluxo cross-shell                                    | UI, auth, navegação ou integração.                   |
| Acessibilidade    | Teclado, foco, labels, contraste e mobile                            | UI.                                                  |
| Performance smoke | Console, network, erros e regressões evidentes                       | UI/integração.                                       |
| Security          | Authn/authz, IDOR, secrets, PII, grants, replay                      | Toda fronteira sensível.                             |
| Stripe            | Test mode, webhook assinado, duplicado/fora de ordem e reconciliação | Financeiro/reserva/plano.                            |
| Zoom              | Testes locais; runbook real só com gate humano                       | Sessões/Zoom.                                        |
| Legal             | `npm run legal:check` e decisões aprovadas                           | Copy/aceite/publicação/release.                      |
| Documentação      | Impacto documental declarado e links revisados                       | Toda entrega.                                        |

QA não valida feature em branch que falha em build/typecheck. Testes externos
Stripe/Zoom, HML e ações produtivas nunca são disparados automaticamente por
este documento.

## Severidade

- `P0`: vazamento, bypass de autorização/financeiro, perda/corrupção de dados,
  cobrança indevida ou acesso Admin indevido. Bloqueia tudo.
- `P1`: fluxo crítico quebrado, regressão cross-shell, contrato ou integridade.
  Bloqueia homologação/release.
- `P2`: performance, acessibilidade, observabilidade ou risco operacional não
  crítico. Exige decisão explícita para avançar.
- `P3`: melhoria futura rastreada; não pode esconder ausência de requisito.

O repositório não possui workflow versionado em `.github/` na data desta
configuração. Portanto, esta checklist é manual até que uma tarefa separada e
aprovada implemente CI.

## Gate do lote Admin — 2026-08-11

Estado: `NOT_READY`.

- Aprovados: typecheck, lint, testes focados, build, verificação de whitespace e
  formatação dos arquivos alterados neste lote.
- Sem impacto: schema, migrations, RLS, Auth, rotas, permissões, Stripe externo
  e Zoom.
- Pendente: reexecução dos fluxos E2E Admin após alinhar suas asserções à nova
  estrutura. O Supabase local deixou de estar disponível e impediu o login na
  última tentativa.
- Pendente: comparação visual autenticada das rotas Admin em desktop e mobile,
  pois nenhum navegador estava disponível no Browser MCP durante o gate.
- Limitação preexistente: `npm run format:check` global encontra arquivos fora
  do padrão que não pertencem a este lote; a checagem focada dos arquivos do
  lote foi aprovada.

## Gate Zoom Video SDK + HML — 2026-08-11

Estado: `NOT_READY`.

- Aprovados localmente: auditoria de lifecycle, adapter de sala e chamada,
  janela T-15, reconexão, preflight, idempotência do webhook, leitura Admin
  sanitizada, harness HML e regressões de produto.
- Gate local aprovado: TypeScript, lint, build, Vitest, Deno, Playwright headed,
  pgTAP com 1.211 testes e lint do schema sem erros.
- HML Supabase: migrations de hardening de sessão Admin e transição de
  verificações aplicadas e contratos consultados diretamente no projeto de
  homologação. A migration final de privilégios dos RPCs Zoom ainda deve ser
  publicada e revalidada antes do webhook.
- Pendente: executar Playwright headed em HML usando `_vercel_share` e contexts
  independentes para cliente, terapeuta e Admin.
- Fonte remota disponível: o Supabase de HML está acessível por CLI e MCP. A
  persistência da chamada real ainda não existe e não pode ser inferida pelas
  validações de schema.
- Bloqueio de interface: o compartilhamento `_vercel_share` fornecido não
  liberou a navegação na última tentativa. É necessário revalidar o acesso e o
  deploy da aplicação antes de abrir a sessão real.
