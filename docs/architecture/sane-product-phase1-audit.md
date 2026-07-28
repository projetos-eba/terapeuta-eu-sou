# Saneamento Transversal - Fase 1

Data: 2026-07-28

## Escopo

Esta fase consolidou taxonomia, documentação e guardrails iniciais para impedir
retorno de inconsistências de linguagem, rotas de paciente e fallbacks públicos.

## Divergências Encontradas

| Área               | Decisão canônica                                       | Estado encontrado                                                                                         | Ação                                                                                                                     |
| ------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Paciente           | Interface usa “Encontro” e rota `/app/encontros`       | Docs e helpers ainda expunham `/app/sessoes/*` como rotas de paciente                                     | Links internos migrados e aliases documentados como legados                                                              |
| Terapeuta/admin    | Podem usar “Sessão” operacional                        | Agenda do terapeuta mistura “encontro” em algumas microcopies operacionais                                | Registrado para fase posterior; não alterado em massa                                                                    |
| Planos             | Free, Premium, Premium Plus                            | Docs e referências antigas ainda citam Básico/Pro/Plus                                                    | AGENTS, sitemap e copy nova ajustados; aliases preservados                                                               |
| Serviços           | UI usa “Suas terapias”; domínio usa serviço            | Fundação Fase 2 já alinhada; docs ainda tinham “serviços” em inventário legado                            | Glossário criado para distinguir produto e domínio                                                                       |
| Fallbacks públicos | Falha não vira sucesso demo                            | Busca/perfil públicos retornavam fallback em config ausente, erro e zero resultado                        | Contrato discriminado aplicado em busca e perfil                                                                         |
| Encoding           | Markdown UTF-8 consistente                             | `docs/product/integration-map.md`, `routes-map.md`, `page-inventory.md` e algumas skills possuem mojibake | Risco documentado; correção completa deve ser fase própria para evitar alteração semântica acidental em arquivos grandes |
| Analytics          | Plan props canônicas `free`, `premium`, `premium_plus` | Não identificado emissor novo de `basico`, `pro`, `plus` nos arquivos analisados                          | Guardrail documentado no glossário/AGENTS                                                                                |

## Fallbacks e Degradações Observadas

| Superfície          | Antes                                                              | Depois                                                                       | Demo permitido                                                        |
| ------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/terapeutas`       | Sem config, erro ou zero resultados retornavam terapeutas fallback | Sem config/erro retorna `degraded`; zero resultado retorna `empty`           | Somente `TES_ENABLE_DEMO_DATA=true` fora de produção                  |
| `/terapeutas/:slug` | Sem config/erro/slug fallback podia retornar perfil demo           | Slug inexistente retorna `not_found`; erro/config ausente retorna `degraded` | Somente `TES_ENABLE_DEMO_DATA=true` fora de produção e slug conhecido |
| Home pública        | Ainda possui fallback local                                        | Pendente para fase seguinte                                                  | Deve migrar para contrato discriminado                                |
| Match               | Ainda possui fallback local                                        | Pendente para fase seguinte                                                  | Deve migrar para contrato discriminado                                |
| Terapias públicas   | Já retorna erro/unconfigured sem dados demo                        | Mantido                                                                      | Não usa demo automático                                               |

Nos testes desta fase, dados demonstrativos só foram acionados em cenários com
`TES_ENABLE_DEMO_DATA=true`. Nenhum teste de sucesso foi contado como live
quando usou demo.

## Decisões

- Não renomear entidades técnicas `session`, `booking`, `service` ou tabelas.
- Não remover rotas legadas; manter redirects compatíveis em `next.config.mjs`.
- Não fazer conversão cega de “sessão” para “encontro”.
- Não fazer conversão global de encoding em arquivos grandes com conteúdo
  semanticamente misto; registrar dívida e tratar com revisão dedicada.

## Testes Adicionados

- Contrato de fallback da busca pública.
- Contrato de fallback do perfil público.
- Redirects e helpers canônicos de paciente.
- Copy primária do paciente usando “Encontro”.
- Nomes comerciais canônicos dos planos.

## Pendências da Fase 2

- Aplicar `PublicDataResult` em Home, Match e demais fallbacks locais.
- Normalizar encoding dos documentos grandes com revisão semântica.
- Expandir guardrails para e-mails, analytics e skills restantes.
