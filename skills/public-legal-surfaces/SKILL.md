---
name: public-legal-surfaces
description: Implementar e manter as paginas publicas juridicas, ajuda e status do TES com gate de publicacao e aceite versionado.
---

# Superficies juridicas publicas TES

## Fontes obrigatorias

1. `AGENTS.md`.
2. `docs/product/sitemap.md`.
3. `docs/product/routes-map.md`.
4. `docs/product/page-inventory.md`.
5. `docs/product/integration-map.md`.
6. `docs/design-system/design-system.md`.
7. `docs/legal/launch-readiness-diagnosis.md`.
8. `src/domain/legal/legal-registry.json`.

## Rotas

- `/termos`: termos de uso.
- `/privacidade`: politica de privacidade.
- `/cancelamento-reagendamento-reembolso`: politica de cancelamento,
  reagendamento e reembolso.
- `/ajuda`: central publica de ajuda, bloqueada ate canais e SLAs aprovados.
- `/status`: status operacional, bloqueado ate fonte operacional auditada.

## Regras criticas

- Nunca publicar placeholder, mensagem interna de pendencia ou texto juridico
  nao aprovado ao usuario final.
- Producao deve retornar `notFound()` quando o documento ou a superficie ainda
  nao estiver publicavel.
- Documento publicavel exige status `published`, versao, vigencia, hash,
  aprovacao e rota canonica em `src/domain/legal/legal-registry.json`.
- Sitemap deve listar apenas documentos juridicos publicaveis.
- Checkout e cadastros gravam aceite server-side com a versao publicada; o
  navegador envia somente a intencao de aceite.
- `/app/ajuda` nao existe neste momento. Suporte autenticado do paciente usa
  `/app/mensagens` com templates aprovados.

## Dados dinamicos

- Registry local: `src/domain/legal/legal-registry.ts`.
- Banco: `legal_document_versions`, `legal_acceptances` e snapshots juridicos
  em `bookings`.
- Suporte: `support_tickets` com `request_id`, `correlation_id`,
  `diagnostic_context`, `source` e `urgency`.

## Fallback

- Fallback nao pode mascarar falha juridica ou operacional.
- Em desenvolvimento, previews internos podem explicar bloqueios.
- Em producao, superficie sem aprovacao deve ficar indisponivel.

## QA

- Rodar `npm run legal:check`; modo strict deve falhar enquanto houver
  `LEGAL_DECISION_REQUIRED`.
- Rodar testes de registry e suporte.
- Validar que `/termos`, `/privacidade` e sitemap nao publicam documento em
  status de revisao.
- Validar que signup e checkout falham fechado quando nao ha versao juridica
  publicada.
- Validar que chamados de suporte sao abertos por template autenticado, sem
  texto livre.

## Pendencias conhecidas

- Fonte HTML acessivel dos PDFs foi extraida localmente em
  `src/domain/legal/legal-document-content.json` em 2026-08-01.
- As versoes juridicas `2026.08.01-pdf` foram reconciliadas no registry local
  com hashes SHA-256 dos PDFs anexados.
- A matriz de suporte foi reconciliada com os canais autenticados existentes da
  plataforma.
- Preencher entidade controladora completa, CNPJ, endereco, e-mails oficiais e
  horario operacional publico.
- Definir fonte operacional real para `/status`.
