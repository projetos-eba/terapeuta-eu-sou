# Ferramentas e Ambientes

## Menor privilégio por agente

Esta matriz recomenda acesso; ela não exige que todos os MCPs estejam
instalados e não concede credenciais por meio dos TOMLs.

| Agente              | Ferramentas recomendadas                              | Limite                                                         |
| ------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Orchestrator        | Git/GitHub, leitura de docs e status dos agentes      | Evitar credenciais de domínio e escrita externa direta.        |
| Security & Supabase | GitHub, Supabase CLI/MCP, SQL/pgTAP                   | Produção read-only; secrets somente no runtime autorizado.     |
| Admin               | GitHub, Supabase, Figma, Playwright                   | Stripe/Zoom somente via owner e ambiente de teste.             |
| Stripe & Finance    | GitHub, Supabase, Stripe Docs/test tools, Playwright  | Test mode por padrão; LIVE exige go/no-go humano.              |
| Sessions & Zoom     | GitHub, Supabase, Zoom docs/test tools, Playwright    | Sem sessão real, webhook remoto ou consumo externo automático. |
| QA & Release        | GitHub, Supabase, Playwright e evidências Stripe/Zoom | Não precisa acesso de escrita a produto/produção para validar. |
| Public / Patient    | GitHub, Figma, Playwright, Supabase local/HML mínimo  | Sem acesso financeiro ou service role no navegador.            |
| Therapist Product   | GitHub, Figma, Playwright, Supabase local/HML mínimo  | Financeiro/Zoom profundo somente com owners.                   |

Quando um conector especializado não estiver disponível, registre a limitação;
não invente configuração MCP, resultado, permissão ou evidência.

## Política de ambientes

### LOCAL

- Maior autonomia para leitura, edição, migrations locais e testes.
- Dados e secrets continuam protegidos; flags reais permanecem fail-closed.
- Stripe usa test mode e Zoom real permanece bloqueado salvo runbook e
  confirmação explícita.

### HML

- Escrita controlada pelo owner, com objetivo, alvo e evidência definidos.
- Migration requer Security & Supabase; integrações requerem owner de domínio.
- Sem dados produtivos copiados ad hoc e sem fallback demonstrativo silencioso.
- Go/no-go humano antes de testes externos com custo ou efeito persistente.

### PRODUCTION

- Read-only por padrão para todos os agentes.
- Nenhum agente aplica migration, muda configuração, reprocessa evento, cria
  cobrança, transferência, payout, sessão Zoom, secret ou conteúdo
  automaticamente.
- Escrita exige instrução humana explícita, alvo resolvido, plano de
  rollback/roll-forward, owner, reviewer, janela e evidência posterior.

## Segredos e evidências

- Nunca copiar valores de `.env`, tokens, cookies, chaves, cartões, dados
  bancários, JWTs ou URLs privadas para prompts, logs, screenshots ou handoffs.
- Evidência deve usar IDs truncados/sanitizados e registrar ambiente/modo.
- Acesso de ferramenta não substitui autorização do produto nem revisão de
  segurança.
