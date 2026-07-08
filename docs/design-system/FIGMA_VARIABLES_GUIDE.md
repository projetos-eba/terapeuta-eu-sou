# Figma Variables Guide - Terapeuta Eu Sou

Data: 2026-06-14

## Página

Todo o Design System foi centralizado em uma única página chamada:

```txt
Design System
```

Não foram criadas múltiplas páginas.

## Convenção de Nome

Figma Variables usam barras:

```txt
color/semantic/text/primary
spacing/6
radius/card
```

Documentação e código podem representar a mesma estrutura com ponto:

```txt
color.semantic.text.primary
spacing.6
radius.card
```

## Collections

| Collection | Modo | Observação |
|---|---|---|
| `Color / Primitive` | Light | Valores base, sem escopo amplo |
| `Color / Semantic` | Light | Tokens por intenção |
| `Typography` | Light | Fontes, pesos e tamanhos |
| `Spacing` | Light | Escala comum |
| `Radius` | Light | Cantos |
| `Shadow` | Light | Efeitos |
| `Size` | Light | Ícone, touch target, containers |
| `Border` | Light | Borda e foco |
| `Opacity` | Light | Estados |
| `Elevation` | Light | Camadas |
| `Component Tokens` | Light | Tokens específicos |

## Estado Atual

Após a revisão visual da página `Design System`, o arquivo contém 189 variables nas collections TES.

Mudanças principais de cor:

| Variable | Valor atual | Uso principal |
|---|---:|---|
| `color/primitive/purple/500` | `#6C3D91` | Base da ação principal e identidade TES |
| `color/primitive/cyan/500` | `#81BAE0` | Acento humano, paciente e dados leves |
| `color/semantic/action/primary/default` | `#6C3D91` | Botão primário, links e estado ativo |
| `color/semantic/profile/patient` | `#81BAE0` | Elementos do perfil paciente |

As escalas primitivas de roxo e ciano foram refeitas em `50-900` a partir dessas novas tonalidades.

## Regras de Uso

1. Use primitive apenas como fonte de verdade.
2. Aplique semantic tokens em telas e componentes.
3. Use component tokens só quando o componente tiver necessidade recorrente.
4. Não hardcode cor, radius, sombra ou spacing em componentes novos.
5. Não crie modo `Dark` enquanto não houver base visual validada.
6. Não crie modo por plano sem evidência de uso real.

## Binding

Os componentes criados no Figma usam bindings em:

- `fills`
- `strokes`
- `strokeWeight`
- `cornerRadius`
- texto
- padding/spacing quando aplicável

## Escopos

As variables novas evitam `ALL_SCOPES`.

Primitivas podem ficar sem escopo específico. Semânticas e component tokens foram criados com escopos apropriados para reduzir uso errado em handoff.

## Mapeamento Para Código

| Figma Variable | CSS Variable atual ou recomendada |
|---|---|
| `color/semantic/text/primary` | `--tes-color-text-primary` |
| `color/semantic/text/secondary` | `--tes-color-text-secondary` |
| `color/semantic/background/default` | `--tes-color-surface-page` |
| `color/semantic/surface/default` | `--tes-color-surface-default` |
| `color/semantic/action/primary/default` | `--tes-color-brand-primary` = `#6C3D91` |
| `color/semantic/action/primary/hover` | `--tes-color-brand-primary-hover` = `#5B337A` |
| `color/semantic/action/primary/pressed` | `--tes-color-brand-primary-pressed` = `#482861` |
| `color/semantic/profile/patient` | `--tes-color-profile-patient` = `#81BAE0` |
| `color/semantic/status/info` | `--tes-color-status-info` = `#5EA3D2` |
| `color/semantic/border/subtle` | `--border` ou novo `--tes-color-border-subtle` |
| `radius/card` | `--tes-radius-card` |
| `radius/panel` | `--tes-radius-panel` |
| `shadow/card` | `--tes-shadow-card` |
| `size/sidebar/default` | `--tes-layout-sidebar-width` |
| `size/topbar/height` | `--tes-layout-topbar-height` |

## Próximo Passo Técnico

Expandir `src/app/globals.css` e `tailwind.config.ts` para refletir todas as collections novas, especialmente:

- border tokens;
- profile colors;
- component tokens;
- spacing completo;
- size tokens;
- opacity tokens;
- elevation tokens.
