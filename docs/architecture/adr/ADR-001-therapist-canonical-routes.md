# ADR-001 - Rotas canônicas do terapeuta

Data: 2026-07-25

Status: aceito e implementado na Fase Agenda 1.

## Contexto

Free, Premium e Premium Plus possuíam árvores `/basico`, `/pro` e `/plus`.
Isso fazia o plano participar da identidade da rota e pressionava o projeto a
duplicar shells, páginas e links a cada evolução.

O prefixo plural `/terapeutas/*` já identifica o catálogo público. O alias
público singular `/terapeuta/:slug` também existia.

## Decisão

- `/terapeuta/*` é o único namespace autenticado.
- Plano e capability controlam acesso e composição, nunca o endereço.
- `/basico/*`, `/pro/*` e `/plus/*` são redirects temporários.
- Query string e segmentos dinâmicos são preservados.
- `/terapeutas/*` permanece público.
- Rotas estáticas autenticadas têm precedência sobre o alias público singular.
- O alias singular redireciona perfis antigos para `/terapeutas/:slug`.

## Alternativas

- Manter três árvores: rejeitada por duplicar navegação e contratos.
- Usar `/terapeutas/app/*`: rejeitada por misturar catálogo público e operação.
- Remover aliases imediatamente: rejeitada por quebrar bookmarks e retornos.

## Consequências

- Upgrade e downgrade não alteram bookmarks.
- Toda autorização deve consultar sessão, status, plano e capability.
- Redirects precisam permanecer cobertos por testes até sua remoção aprovada.

## Compatibilidade

Os redirects temporários ficam em `next.config.mjs`. Casos sem correspondência
direta, como pagamento, métricas e plano, possuem destinos explícitos antes das
regras genéricas.

## Critério de revisão

Os aliases podem se tornar permanentes após estabilização. Sua remoção exige
telemetria de uso, comunicação e aprovação explícita.
