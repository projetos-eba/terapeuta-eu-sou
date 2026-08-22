# ADR-016 — Support Ticketing e Structured Participant Messaging

Data: 2026-08-21

## Status

Aceita.

## Contexto

A Central de Mensagens do TES reunia comunicação entre participante e avisos de suporte. As duas experiências têm necessidades distintas: participante exige linguagem controlada; suporte exige conversação rastreável com o TES. A policy legada de `messages` permitia escrita direta de participantes, tornando o controle pela rota insuficiente.

## Decisão

- Paciente ↔ terapeuta usa exclusivamente mensagens estruturadas resolvidas no servidor a partir de template aprovado.
- `messages` não aceita escrita direta de `authenticated`; a RPC autenticada deriva identidade, verifica conversa e direção e persiste a referência do template junto ao corpo resolvido.
- A V2 adiciona prévia sem persistência, categorias e descrições de uso, booking
  obrigatório quando aplicável, parâmetros de opções fechadas e CTAs allowlisted
  resolvidos pelo banco. Nenhum corpo, URL ou texto final é escolhido pelo
  browser; a V1 permanece como wrapper compatível.
- Usuário ↔ TES usa `support_tickets` e `support_ticket_messages` para texto livre em thread autorizada, separada de `messages`.
- Notas internas, auditoria e mensagens públicas de suporte são conceitos distintos; nota interna nunca será elegível ao DTO do solicitante.

## Alternativas rejeitadas

- **Manter somente validação na rota Next:** rejeitada porque um token autenticado ainda podia gravar `messages` diretamente via Data API.
- **Permitir textarea compartilhado na Central:** rejeitada porque abre chat livre entre paciente e terapeuta.
- **Reutilizar `messages` para suporte:** rejeitada porque mistura RLS, retenção, visibilidade interna e responsabilidades distintas.
- **Criar thread, inbox e SLA nesta fase:** rejeitada para manter a Fase 1 em contratos e fechamento da vulnerabilidade concreta.

## Consequências

- Templates participantes tornam-se dados versionados no banco e a rota não recebe corpo arbitrário.
- A Fase 2 criou `support_ticket_messages`, RPCs/RLS de suporte e DTOs separados para terapeuta; nota interna não pertence à policy nem ao DTO do solicitante.
- Tickets template-only históricos continuam legíveis: a descrição legada é apresentada como primeira mensagem conceitual até uma eventual migração auditável.

## Impacto documental

Documentação atualizada em `docs/support/`, `docs/product/integration-map.md` e `skills/message-center/SKILL.md`.
