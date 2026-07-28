# Política Visual Automatizada TES

Data: 2026-07-28

Esta política impede regressões de tokens e tipografia sem redesenhar páginas
fora de escopo.

## Regras Automatizadas

- Não usar `text-[8px]`, `text-[9px]`, `text-[10px]` ou valores CSS
  `font-size` menores que `11px` fora da allowlist.
- Texto funcional deve permanecer em `14px` ou mais.
- Não introduzir hex hardcoded em código funcional fora da allowlist.
- Tokens globais podem declarar valores hex em `src/app/globals.css`.
- Documentação pode citar valores hex de tokens.
- Visualizações de dados e mapas semânticos podem ter exceções documentadas.

## Script

```bash
npm run lint:visual
```

`npm run lint` executa a política visual antes do Next lint, então a verificação
roda no mesmo caminho de CI usado pelo projeto.

## Allowlist Atual

A allowlist está em `scripts/visual-policy.config.mjs` e classifica exceções em:

- definição central de tokens;
- documentação;
- templates HTML de e-mail;
- visualização de dados;
- mapas semânticos de tema;
- superfícies legadas pendentes de saneamento dedicado.

Cada nova exceção deve ter motivo explícito. A allowlist não deve ser usada para
esconder texto funcional ilegível ou cor aplicada por preferência local.
