# Diagnóstico jurídico, suporte e transparência TES

Data: 2026-08-01

## Escopo auditado

- PDFs fornecidos: `Termos de Uso.pdf`, `Política de Privacidade.pdf` e
  `Política de Cancelamento, Reagendamento e Reembolso 2.pdf`.
- Rotas públicas: `/termos`, `/privacidade`, `/ajuda`, `/ajuda/zoom`,
  `/reserva`, `/reserva/sucesso`, cadastros de cliente e terapeuta.
- Rotas autenticadas relevantes: `/app/encontros`, `/app/encontros/:bookingId`,
  `/app/mensagens`, `/terapeuta/suporte`, `/terapeuta/mensagens`.
- Contratos auditados: `support_tickets`, `notifications`, `bookings`,
  `session_payments`, `booking_reschedule_requests`,
  `session_cancellation_decisions`, Edge Function `session-booking-checkout`.

## Extração e publicação local dos PDFs

Em 2026-08-01, os três PDFs anexados foram extraídos localmente com `pypdf`,
normalizados em blocos de leitura e materializados em
`src/domain/legal/legal-document-content.json`.

Hashes SHA-256 confirmados contra os PDFs em `C:/Users/vferrari/Downloads`:

- `Termos de Uso.pdf`:
  `28bb5da89e4ac90f113a8fb60f81c621c39e7e80d722ba8af67cb51e040c52d2`;
- `Política de Privacidade.pdf`:
  `239ff69e8730b2ed187fb6d90474bef99b5e9511bd600c398a2b36d36ae6f159`;
- `Política de Cancelamento, Reagendamento e Reembolso.pdf`:
  `ea6d646daa5d3e4398f3d7b243ec252a382036b59be236ee3c4866df9ea141a7`.

As páginas `/termos`, `/privacidade` e
`/cancelamento-reagendamento-reembolso` passam a publicar a versão
`2026.08.01-pdf` quando o registry local estiver em `status = published`.

## Matriz de divergências entre PDFs, produto e código

### Fonte operacional recebida em 2026-08-23

O arquivo `POLÍTICA DE CANCELAMENTO - OPERACIONAL.docx`, recebido para ajustar
o detalhe do encontro do paciente, foi tratado como fonte operacional para a
experiência autenticada e para a próxima versão de `financial_policy_versions`.
Ele orienta: 24 horas ou mais para solicitar reagendamento ou reembolso quando
aplicável; menos de 24 horas e não comparecimento sem obrigação de reembolso,
com análise individual de exceções; e início do processamento aprovado em até
7 dias úteis.

O documento não traz, nos arquivos analisados, versão jurídica publicada,
hash, data de vigência ou aprovação formal para substituir o documento público
`2026.08.01-pdf`. Por isso, o registry e as páginas jurídicas públicas não são
alterados por esta atualização operacional. A publicação jurídica continua
pendente até que esses metadados sejam fornecidos.

| Item                                                                                      | Evidência no código                                       | Risco                                                                          | Severidade | Ação                                                                                           |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- |
| `/termos` e `/privacidade` exibiam mensagens internas de pendência                        | `src/app/termos/page.tsx`, `src/app/privacidade/page.tsx` | Publicação de texto proibido ao usuário final                                  | P1         | Corrigido: páginas usam registry e bloqueiam publicação externa quando não há versão publicada |
| `/ajuda` e `/ajuda/zoom` existem só como diretórios vazios                                | `src/app/ajuda/`                                          | Rota canônica configurada, mas sem página; risco de link quebrado se reativada | P1         | Requer decisão de canal/SLA antes de publicar                                                  |
| `Contato` no rodapé não tinha destino                                                     | `src/components/tes/public-footer.tsx`                    | Item visual sem ação                                                           | P1         | Corrigido: item removido até canal aprovado                                                    |
| Sitemap documentava `/ajuda` como obsoleta, mas `src/lib/routes.ts` mantinha rota pública | `docs/product/sitemap.md`, `src/lib/routes.ts`            | Divergência entre documentação e código                                        | P1         | Corrigido: `/ajuda` existe como preview interno bloqueado ate canais/SLAs aprovados            |
| Não havia rota canônica para Política de Cancelamento, Reagendamento e Reembolso          | `src/lib/routes.ts`                                       | Política aplicável à reserva sem página pública própria                        | P1         | Corrigido: rota criada sob gate de publicacao juridica                                         |
| Checkout registrava apenas booleano `termsAccepted` no Next                               | `src/app/api/public/reservation/checkout/route.ts`        | Aceite sem versão/hash no contrato Next                                        | P0         | Corrigido: checkout faz preflight juridico e registra aceite versionado server-side            |
| Edge Function de checkout não persistia versão jurídica                                   | `supabase/functions/session-booking-checkout/index.ts`    | Bypass/evidência incompleta de aceite                                          | P0         | Corrigido: snapshots de versao juridica gravados no booking apos aceite                        |
| Cadastros validavam aceite booleano, sem versão jurídica normalizada                      | `src/app/api/auth/*/signup/route.ts`                      | Aceite insuficiente para prova versionada                                      | P0         | Corrigido: cadastros registram aceite versionado por RPC server-side                           |
| `support_tickets` permitia leitura, mas não criação autenticada                           | migrations e grant local                                  | Central de suporte não consegue abrir protocolo real                           | P1         | Corrigido: endpoint autenticado cria chamado por template aprovado e request idempotente       |
| Regras de cancelamento usam percentuais em código de apresentação                         | `src/features/bookings/patient-encounter-actions.ts`      | Texto financeiro pode divergir da política aprovada/backend                    | P1         | Requer matriz jurídica executável central                                                      |

## LEGAL_DECISION_REQUIRED

| Chave                          | Decisão necessária                         | Impacto                           | Responsável esperado | Superfície bloqueada              |
| ------------------------------ | ------------------------------------------ | --------------------------------- | -------------------- | --------------------------------- |
| legal_entity.businessName      | Nome empresarial da controladora           | Publicação de documentos e rodapé | Jurídico/Empresa     | `/termos`, `/privacidade`, rodapé |
| legal_entity.cnpj              | CNPJ                                       | Identificação do fornecedor       | Jurídico/Empresa     | Documentos públicos               |
| legal_entity.address           | Endereço completo                          | Documentos e atendimento          | Jurídico/Empresa     | Documentos públicos               |
| legal_entity.generalEmail      | E-mail geral oficial                       | Contato público                   | Operação/Jurídico    | Rodapé e `/ajuda`                 |
| legal_entity.supportEmail      | Canal de suporte                           | Atendimento e tickets             | Operação             | `/ajuda`, suporte urgente         |
| legal_entity.privacyEmail      | Canal do titular/LGPD                      | Direitos de titulares             | Jurídico/Privacidade | `/privacidade`, `/ajuda`          |
| legal_entity.securityEmail     | Canal de segurança                         | Denúncias e vulnerabilidades      | Segurança/Operação   | `/ajuda`, incidentes              |
| legal_entity.supportHours      | Horário de atendimento                     | SLA público                       | Operação             | `/ajuda`, rodapé                  |
| legal_entity.dataController    | Controlador de dados                       | LGPD                              | Jurídico/Privacidade | `/privacidade`                    |
| legal_entity.dpo               | Encarregado ou decisão de dispensa         | LGPD                              | Jurídico/Privacidade | `/privacidade`                    |
| legal_entity.jurisdictionVenue | Foro                                       | Termos                            | Jurídico             | `/termos`                         |
| legal_documents.versioning     | Versão, vigência, aprovação e hash         | Aceite eletrônico                 | Jurídico/Engenharia  | Cadastros, reserva, checkout      |
| cancellation.route             | Slug canônico da política                  | Link público e checkout           | Produto/Jurídico     | Rodapé, reserva                   |
| cancellation.rules             | Antecedência, retenção, no-show, reembolso | Backend, Stripe e UI              | Jurídico/Financeiro  | Cancelamento/reembolso            |
| support.slas                   | Confirmação, primeira resposta e resolução | Publicação de `/ajuda`            | Operação             | `/ajuda`, suporte urgente         |
| pdf.sources                    | Fonte editável aprovada                    | HTML acessível                    | Jurídico             | Páginas jurídicas                 |

## Rotas e rodapé implementados sob gate

- Mantidos `/termos` e `/privacidade`, publicados somente quando o registry
  indicar `status = published` com versão, vigência, aprovação, hash e conteúdo
  extraído.
- `/cancelamento-reagendamento-reembolso` publica a política aprovada quando o
  registry indicar documento publicável e conteúdo extraído.
- `/ajuda` publica a matriz de suporte reconciliada quando todos os itens de
  `supportMatrix` estiverem publicáveis; a abertura de chamado permanece nos
  canais autenticados existentes.
- `/status` existe apenas como preview interno e deve ser publicado somente com
  fonte operacional explícita, sem fallback de
  “tudo operacional”.
- Rodapé final contém links jurídicos e de suporte somente quando as respectivas
  superfícies estiverem aprovadas/publicáveis.

## Modelo de versionamento e aceite

Implementado nesta fase:

- `src/domain/legal/legal-registry.json` e helper tipado em
  `src/domain/legal/legal-registry.ts`.
- Migration
  `supabase/migrations/20260801170000_legal_acceptance_support_foundation.sql`.
- `legal_document_versions`: chave, versão, hash, vigência, status, caminho
  canônico, responsável e imutabilidade de versões publicadas.
- `legal_acceptances`: usuário, papel, documento, versão, contexto, booking
  opcional, `request_id`, evidência técnica mínima e timestamps server-side.
- RLS: usuário lê os próprios aceites; escrita de aceite apenas por fluxos
  autorizados server-side.
- Edge Functions: cadastros e checkout selecionam versão publicada no servidor,
  ignoram versão enviada pelo navegador e gravam aceite versionado.
- Checkout: preflight bloqueia a reserva antes de criar hold/booking quando
  documentos juridicos aplicaveis nao estao publicados.
- Suporte: `POST /api/support/tickets` abre chamado autenticado por template
  aprovado, sem texto livre do navegador.

## Plano de testes

- Unitários: registry, completude, seleção de documento publicado, gate strict.
- Integração: migrations, RLS, aceite imutável, signup direto, checkout direto.
- Playwright: links do rodapé, documentos, cadastros sem aceite/com aceite,
  reserva sem aceite/com aceite, suporte e status quando publicados.
- Segurança: bypass de aceite, alteração de versão pelo cliente, IDOR em
  tickets, booking de outro paciente, XSS em tickets e logs sensíveis.

## Launch checklist jurídico

- Entidade responsável completa.
- Documentos aprovados com fonte HTML acessível.
- Hash e versão publicados.
- Aceite normalizado nos cadastros e checkout.
- Política de cancelamento executável e igual ao texto publicado.
- `/ajuda` com canal real e SLA operacional.
- Suporte urgente com protocolo real.
- Inventário de privacidade e cookies reconciliado com a implementação.
- Gate `npm run legal:check` passando em modo strict.
