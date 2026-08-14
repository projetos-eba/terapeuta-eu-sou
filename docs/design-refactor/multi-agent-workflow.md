# Workflow multi-agent de refatoração visual

Status: contrato de trabalho futuro  
Versão: 2026-08-13

Este fluxo complementa `docs/agent-work/`. Cada tarefa mantém owner único,
reviewer, arquivos reservados, handoff e release gate. Agentes não alteram
domínio fora de sua autoridade.

## Agent A — Product / UX Architect

Compreende objetivo, usuário, tarefa, informação, estados, interação e
transformação responsiva. Não implementa React.

Entrega obrigatória:

```text
Primary task
Secondary tasks
Information hierarchy
Critical states
Interaction model
Progressive disclosure
Responsive transformation
UX risks
```

Gate A: Product/domain owner confirma que a proposta preserva contratos,
permissões, nomenclatura, segurança e estados reais.

## Agent B — Visual Director

Traduz o UX aprovado para composição, ritmo, personalidade e densidade usando
TES Experience Language, Figma e referências. Pergunta central: “Isso parece TES
ou somente uma interface SaaS bem feita?”.

Entrega: direção visual, first fold, mapa de superfícies, tipografia, whitespace,
density, referências traduzidas e riscos. Não muda domínio nem implementa como
responsável primário.

Gate B: a direção passa pelo teste anti-genérico e explica cada card, border,
shadow, badge e CTA relevante.

## Agent C — Design System Guardian

Protege consistência e decide sobre reuso. Antes da implementação responde:

```text
Existe componente semelhante?
Existe pattern?
Existe token?
Pode ser variante?
É específico do domínio?
Isso merece entrar no Design System?
Isso introduz dívida visual?
```

Pode rejeitar proposta inconsistente. Entrega o mapa de componentes existentes,
composições locais, variants candidatas, tokens e dívida aceita. Não força
abstração prematura.

Gate C: nenhum componente novo sem busca documentada e classificação
`primitive`, `pattern`, `domain` ou `page-specific`.

## Agent D — Implementer

Recebe decisões consolidadas. Implementa React, Next.js, Tailwind, integração
real, acessibilidade, responsividade e preservação de contratos. Não inventa o
design durante a programação.

Entrega: código, testes, states, screenshots preliminares, arquivos alterados,
comandos e limitações. Qualquer decisão não coberta volta ao owner adequado.

Gate D: testes funcionais aplicáveis passam; nenhuma alteração de rota, banco,
API, permissão ou dependência ocorre sem o gate específico do projeto.

## Agent E — Visual QA / Critic

Avalia a implementação real em desktop, tablet e mobile. Compara:

```text
Intent
vs Implementation
vs TES Experience Language
vs Design System
```

Verifica hierarchy, alignment, density, whitespace, overflow, truncation, CTA,
surfaces, typography, states, teclado e aparência genérica. Pode reprovar a
implementação e não deve corrigir silenciosamente a direção que recebeu.

Gate E: Visual Quality Score `>= 85`, floors por dimensão, nenhum eliminatório e
evidence pack completo.

## Sequência e handoffs

1. Orchestrator registra objetivo, owners, arquivos e dependências.
2. Agent A entrega UX e recebe aprovação de domínio.
3. Agent B entrega direção visual; Agent C revisa o sistema em paralelo apenas
   quando os arquivos e responsabilidades não conflitam.
4. Agent C consolida reuso e decisões de componentização.
5. Agent D implementa o contrato aprovado.
6. Agent E executa Visual QA e score; reprovação volta ao owner da causa.
7. Domain owner revisa regressão funcional e QA/Release fecha o gate.

Decisões, rejeições e dívida aceita entram no handoff. Nenhuma média visual
substitui regressão de domínio, segurança ou acessibilidade.
