# Tokens

Fonte canônica única de tokens do Terapeuta Eu Sou para Figma, CSS Variables, Tailwind e wrappers de componentes.

Este arquivo consolida a documentação de tokens antes separada em dois documentos. Valores marcados como `inferido` vêm de recorrência visual nas referências.

## Fonte

- Figma: arquivo `Projeto Terapeuta Eu Sou Atualizado`, página `↳ Design System`.
- Código: `src/app/globals.css` e `tailwind.config.ts`.
- Referências visuais: `Referencias/Publico`, `Referencias/Paciente`, `Referencias/Terapeuta Básico`, `Referencias/Terapeuta Pro`, `Referencias/Terapeuta Plus` e `Referencias/Admin`.
- Documentação relacionada: `docs/design-system/design-system.md` e `docs/design-system/COMPONENT_ARCHITECTURE.md`.

## Modelo de Tokens

A hierarquia adotada é:

```txt
primitive -> semantic -> component
```

No Figma, os nomes usam barras:

```txt
color/primitive/purple/500
color/semantic/background/default
color/component/button/primary/background
```

Na documentação e no código, a mesma estrutura pode ser lida com pontos:

```txt
color.primitive.purple.500
color.semantic.background.default
color.component.button.primary.background
```

## Modo

Foi criado apenas o modo `Light`.

Não há modo `Dark` nem modo por plano, porque as telas e referências auditadas não trazem base visual suficiente para isso.

## Collections no Figma

| Collection          | Função                                  | Status |
| ------------------- | --------------------------------------- | ------ |
| `Color / Primitive` | Valores base de cor                     | Criada |
| `Color / Semantic`  | Uso por intenção                        | Criada |
| `Typography`        | Famílias, pesos, tamanhos e line-height | Criada |
| `Spacing`           | Escala de espaçamento                   | Criada |
| `Radius`            | Cantos arredondados                     | Criada |
| `Shadow`            | Sombras e foco                          | Criada |
| `Size`              | Ícones, touch target e layout           | Criada |
| `Border`            | Larguras e cores de borda               | Criada |
| `Opacity`           | Opacidades semânticas                   | Criada |
| `Elevation`         | Camadas de z-index                      | Criada |
| `Component Tokens`  | Tokens específicos quando necessários   | Criada |

Total documentado após a revisão de 2026-06-16: 189 variables TES ativas nas collections com modo `Light`, 67 aliases e 0 aliases quebrados.

Observação de auditoria: o Figma ainda mantém collections legadas de arranque (`Color Schemes`, `Primitives`, `UI Styles`, `Spacing & Sizing`) e uma collection antiga chamada `Typography` com modos `Desktop` e `Mobile`. A fonte de verdade para TES é a collection `Typography` com modo `Light`, junto das demais collections TES listadas abaixo.

## Status de Sincronização

| Fonte            | Status                                       |
| ---------------- | -------------------------------------------- |
| Figma Variables  | Criadas e aplicadas                          |
| Figma Styles TES | Criados                                      |
| CSS Variables    | Existentes, precisam acompanhar este arquivo |
| Tailwind         | Parcialmente alinhado por CSS variables      |
| Storybook        | Pendente, não instalado                      |

## Cores

### Marca

| Token                        |     Valor | Status              | Uso                             |
| ---------------------------- | --------: | ------------------- | ------------------------------- |
| `color.brand.primary`        | `#6C3D91` | atualizado no Figma | CTA, navegação ativa, foco.     |
| `color.brand.primaryHover`   | `#5B337A` | atualizado no Figma | Hover de CTA.                   |
| `color.brand.primaryPressed` | `#482861` | atualizado no Figma | Pressed/active.                 |
| `color.brand.deep`           | `#14105A` | atualizado no Figma | Títulos e links fortes.         |
| `color.brand.lavender`       | `#E2D1EC` | atualizado no Figma | Seleção, ilustração e gráficos. |
| `color.brand.lavenderSoft`   | `#F1E8F6` | atualizado no Figma | Fundo suave e nav ativa.        |
| `color.brand.cyan`           | `#81BAE0` | atualizado no Figma | Acento humano e dados leves.    |
| `color.brand.cyanSoft`       | `#F6FBFE` | atualizado no Figma | Badge e fundo de acento.        |
| `color.brand.mint`           | `#BEEBD8` | inferido            | Cuidado e sucesso suave.        |

### Escalas primitivas atualizadas

| Token                    |        50 |       100 |       200 |       300 |       400 |       500 |       600 |       700 |       800 |       900 |
| ------------------------ | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: | --------: |
| `color.primitive.purple` | `#FAF7FC` | `#F1E8F6` | `#E2D1EC` | `#C9ADDD` | `#9D72BB` | `#6C3D91` | `#5B337A` | `#482861` | `#361E49` | `#14105A` |
| `color.primitive.cyan`   | `#F6FBFE` | `#EAF5FC` | `#D7ECF8` | `#BFE0F1` | `#A0CCE9` | `#81BAE0` | `#5EA3D2` | `#3F84B4` | `#2E6388` | `#1F425B` |

Exemplo:

```tsx
<button className="bg-brand-primary text-white hover:bg-brand-primaryHover">
  Começar minha jornada
</button>
```

### Superfícies

| Token                    |                    Valor | Status      | Uso                                   |
| ------------------------ | -----------------------: | ----------- | ------------------------------------- |
| `color.surface.default`  |                `#FFFFFF` | referências | Cards, páginas e inputs.              |
| `color.surface.page`     |                `#FFFFFF` | decidido    | Background geral.                     |
| `color.surface.soft`     |                `#F7F4FF` | inferido    | Faixas e cards suaves.                |
| `color.surface.mist`     |                `#F1EFFA` | inferido    | Skeletons e seções.                   |
| `color.surface.elevated` |                `#FFFFFF` | referências | Modais e drawers.                     |
| `color.surface.admin`    |                `#FBFAFF` | inferido    | Admin denso.                          |
| `color.overlay`          | `rgba(20, 16, 90, 0.56)` | decidido    | Backdrop de modal sobre todo o shell. |

Exemplo:

```tsx
<section className="bg-surface-page">
  <article className="rounded-card bg-surface-default shadow-card" />
</section>
```

### Texto

| Token                  |     Valor | Status              | Uso                        |
| ---------------------- | --------: | ------------------- | -------------------------- |
| `color.text.primary`   | `#14105A` | atualizado no Figma | Títulos e texto principal. |
| `color.text.secondary` | `#5E5A8A` | inferido            | Parágrafos e descrições.   |
| `color.text.muted`     | `#8C87B2` | inferido            | Metadados.                 |
| `color.text.subtle`    | `#A9A4C6` | inferido            | Placeholder.               |
| `color.text.inverse`   | `#FFFFFF` | referências         | Texto sobre roxo.          |
| `color.text.link`      | `#6C3D91` | atualizado no Figma | Links.                     |

### Bordas

| Token                  |     Valor | Status              | Uso             |
| ---------------------- | --------: | ------------------- | --------------- |
| `color.border.subtle`  | `#E8E2F6` | inferido            | Cards e inputs. |
| `color.border.default` | `#DED5F2` | inferido            | Divisores.      |
| `color.border.strong`  | `#CDBFF0` | inferido            | Seleção.        |
| `color.border.focus`   | `#6C3D91` | atualizado no Figma | Focus ring.     |

### Status

| Token                    |     Valor | Status              | Uso                            |
| ------------------------ | --------: | ------------------- | ------------------------------ |
| `color.status.success`   | `#2FAE78` | inferido            | Confirmado, pago, operacional. |
| `color.status.successBg` | `#EAF8F1` | inferido            | Badge de sucesso.              |
| `color.status.warning`   | `#F29B4B` | inferido            | Pendente e dica.               |
| `color.status.warningBg` | `#FFF3E8` | inferido            | Badge de atenção.              |
| `color.status.danger`    | `#EF5B7A` | inferido            | Cancelado e crítico.           |
| `color.status.dangerBg`  | `#FDECF1` | inferido            | Badge crítico.                 |
| `color.status.info`      | `#5EA3D2` | atualizado no Figma | Informativo e online.          |
| `color.status.infoBg`    | `#F6FBFE` | atualizado no Figma | Badge informativo.             |

### Perfis

| Token                      |     Valor | Uso        |
| -------------------------- | --------: | ---------- |
| `color.profile.public`     | `#6C3D91` | Público.   |
| `color.profile.patient`    | `#81BAE0` | Paciente.  |
| `color.profile.basic`      | `#9D72BB` | Básico.    |
| `color.profile.pro`        | `#6C3D91` | Pro.       |
| `color.profile.plus`       | `#5B337A` | Plus.      |
| `color.profile.plusAccent` | `#F4B84A` | Selo Plus. |
| `color.profile.admin`      | `#482861` | Admin.     |

### Gradientes

| Token                      | Valor                                                            | Uso                                         |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| `gradient.brand.cta`       | `linear-gradient(135deg, #6C3D91 0%, #5B337A 100%)`              | CTA principal.                              |
| `gradient.brand.ctaLinear` | `linear-gradient(135deg, #6C3D91 0%, #AE94C3 100%)`              | CTA premium e variação `gradient` de botão. |
| `gradient.brand.soft`      | `linear-gradient(135deg, #FFFFFF 0%, #F1E8F6 60%, #F6FBFE 100%)` | Hero e banners.                             |
| `gradient.plus.aura`       | `linear-gradient(135deg, #FAF7FC 0%, #F6FBFE 55%, #FFF6E8 100%)` | Plus e IA.                                  |
| `gradient.status.success`  | `linear-gradient(135deg, #EAF8F1 0%, #F7FFFB 100%)`              | Sucesso.                                    |

## Tipografia

| Token                 | Valor                                                                  | Uso                         |
| --------------------- | ---------------------------------------------------------------------- | --------------------------- |
| `font.family.display` | `"IvyPresto Display", "Cormorant Garamond", "Playfair Display", serif` | H1, hero, ênfase emocional. |
| `font.family.body`    | `"Manrope", "Inter", system-ui, sans-serif`                            | UI, dashboards, tabelas.    |
| `font.family.accent`  | `"IvyPresto Display", "Cormorant Garamond", serif`                     | Palavra em itálico/ciano.   |

Figma:

- Variáveis atualizadas: `font/family/display` e `font/family/accent`.
- Styles preparados: `TES/Display/IvyPresto/2XL`, `TES/Display/IvyPresto/XL`, `TES/Display/IvyPresto/LG` e `TES/Accent/IvyPresto`.
- Observação operacional: IvyPresto Display precisa estar instalada/listada no Figma para aplicar os styles aos componentes sem gerar fonte ausente. O CSS registra cortes locais de `IvyPresto Headline` e `IvyPresto Display` até o peso máximo `600` em `/public/fonts/ivy-presto`; pesos superiores não são declarados nem sintetizados. Enquanto o Figma não listar a família, os styles legados `TES/Display/*` permanecem em `Cormorant Garamond` como fallback visual seguro.

| Token                   | Tamanho | Line-height |  Peso | Uso               |
| ----------------------- | ------: | ----------: | ----: | ----------------- |
| `font.size.display.2xl` |  `64px` |      `1.02` | `600` | H1 público.       |
| `font.size.display.xl`  |  `52px` |      `1.05` | `600` | Hero.             |
| `font.size.display.lg`  |  `40px` |       `1.1` | `600` | Título de página. |
| `font.size.heading.h1`  |  `32px` |       `1.2` | `650` | Apps.             |
| `font.size.heading.h2`  |  `24px` |      `1.25` | `650` | Seções.           |
| `font.size.heading.h3`  |  `20px` |       `1.3` | `650` | Cards.            |
| `font.size.body.lg`     |  `18px` |       `1.6` | `400` | Subheadline.      |
| `font.size.body.md`     |  `16px` |      `1.55` | `400` | Corpo.            |
| `font.size.body.sm`     |  `14px` |      `1.45` | `400` | UI.               |
| `font.size.caption`     |  `12px` |      `1.35` | `500` | Badges.           |
| `font.size.micro`       |  `11px` |       `1.3` | `600` | Tabelas densas.   |

Regra de legibilidade: o menor texto em desktop é `11px`; em mobile é
`10px`. Esses tamanhos ficam restritos a metadados secundários, grade densa,
legenda ou status. Texto funcional segue com mínimo de `14px`. Nunca usar
tamanhos inferiores; no Tailwind, declarar variação explícita, por exemplo
`text-[10px] md:text-[11px]`.

Exemplo:

```tsx
<h1 className="font-display text-[64px] leading-[1.02] text-tesText-primary">
  Encontre um caminho que faça sentido agora.
</h1>
```

## Espaçamento

| Token        |  Valor |
| ------------ | -----: |
| `spacing.0`  |    `0` |
| `spacing.1`  |  `4px` |
| `spacing.2`  |  `8px` |
| `spacing.3`  | `12px` |
| `spacing.4`  | `16px` |
| `spacing.5`  | `20px` |
| `spacing.6`  | `24px` |
| `spacing.8`  | `32px` |
| `spacing.10` | `40px` |
| `spacing.12` | `48px` |
| `spacing.16` | `64px` |
| `spacing.20` | `80px` |
| `spacing.24` | `96px` |

Uso:

- Card pequeno: `spacing.4`.
- Card de dashboard: `spacing.5` a `spacing.6`.
- Grid: `spacing.4` a `spacing.6`.
- Seção pública: `spacing.16` a `spacing.24`.

Exemplo:

```tsx
<div className="grid gap-6 p-6" />
```

## Radius

| Token          |   Valor | Uso                    |
| -------------- | ------: | ---------------------- |
| `radius.xs`    |   `6px` | Badge pequeno.         |
| `radius.sm`    |   `8px` | Input e botão pequeno. |
| `radius.md`    |  `12px` | Chip.                  |
| `radius.card`  |  `18px` | Card padrão.           |
| `radius.panel` |  `22px` | Painel.                |
| `radius.hero`  |  `28px` | Hero e banner.         |
| `radius.full`  | `999px` | Pill e avatar.         |

## Sombras

| Token          | Valor                                | Uso             |
| -------------- | ------------------------------------ | --------------- |
| `shadow.none`  | `none`                               | Plano.          |
| `shadow.soft`  | `0 12px 36px rgba(38, 20, 51, 0.08)` | Card destacado. |
| `shadow.card`  | `0 8px 24px rgba(38, 20, 51, 0.06)`  | Card padrão.    |
| `shadow.float` | `0 18px 48px rgba(38, 20, 51, 0.14)` | Modal/drawer.   |
| `shadow.focus` | `0 0 0 4px rgba(108, 61, 145, 0.18)` | Focus ring.     |

## Layout

| Token                         |    Valor | Uso               |
| ----------------------------- | -------: | ----------------- |
| `layout.public.maxWidth`      | `1200px` | Público.          |
| `layout.app.maxWidth`         | `1280px` | Dashboards.       |
| `layout.sidebar.width`        |  `220px` | Sidebar desktop.  |
| `layout.sidebar.compactWidth` |   `76px` | Sidebar compacta. |
| `layout.topbar.height`        |   `72px` | Topbar apps.      |
| `layout.footer.height`        |   `96px` | Footer simples.   |
| `layout.card.minHeight`       |   `96px` | Cards dashboard.  |
| `layout.hero.dashboardHeight` |  `240px` | Hero app.         |

## Grid e Breakpoints

| Token                 |    Valor |
| --------------------- | -------: |
| `grid.public.columns` |     `12` |
| `grid.app.columns`    |     `12` |
| `grid.gap.sm`         |   `16px` |
| `grid.gap.md`         |   `24px` |
| `grid.gap.lg`         |   `32px` |
| `breakpoint.xs`       |  `360px` |
| `breakpoint.sm`       |  `640px` |
| `breakpoint.md`       |  `768px` |
| `breakpoint.lg`       | `1024px` |
| `breakpoint.xl`       | `1280px` |
| `breakpoint.2xl`      | `1440px` |

## Camadas

| Token        | Valor | Uso             |
| ------------ | ----: | --------------- |
| `z.base`     |   `0` | Conteúdo.       |
| `z.sticky`   |  `10` | Header/sidebar. |
| `z.dropdown` |  `30` | Menus.          |
| `z.toast`    |  `50` | Toasts.         |
| `z.modal`    |  `70` | Modais.         |
| `z.overlay`  |  `80` | Overlays.       |
| `z.tooltip`  |  `90` | Tooltips.       |

## Opacidade e Ícones

| Token                      |   Valor | Uso               |
| -------------------------- | ------: | ----------------- |
| `opacity.disabled`         |  `0.45` | Desabilitado.     |
| `opacity.subtle`           |  `0.72` | Texto secundário. |
| `opacity.overlay`          |  `0.48` | Backdrop.         |
| `opacity.illustrationSoft` |  `0.78` | Ilustração.       |
| `icon.size.xs`             |  `14px` | Badge.            |
| `icon.size.sm`             |  `16px` | Input.            |
| `icon.size.md`             |  `20px` | Nav e botão.      |
| `icon.size.lg`             |  `24px` | Card.             |
| `icon.size.xl`             |  `32px` | Feature card.     |
| `icon.stroke`              | `1.8px` | Line icon.        |

## CSS Variables

```css
:root {
  --tes-color-brand-primary: #6c3d91;
  --tes-color-brand-primary-hover: #5b337a;
  --tes-color-brand-primary-pressed: #482861;
  --tes-color-brand-deep: #14105a;
  --tes-color-brand-lavender: #e2d1ec;
  --tes-color-brand-lavender-soft: #f1e8f6;
  --tes-color-brand-cyan: #81bae0;
  --tes-color-brand-cyan-soft: #f6fbfe;
  --tes-color-surface-page: #ffffff;
  --tes-color-surface-default: #ffffff;
  --tes-color-border-subtle: #e8e2f6;
  --tes-color-text-primary: #14105a;
  --tes-color-text-secondary: #5e5a8a;
  --tes-radius-card: 18px;
  --tes-shadow-card: 0 8px 24px rgba(38, 20, 51, 0.06);
  --tes-layout-sidebar-width: 220px;
  --tes-layout-topbar-height: 72px;
}
```

## Tailwind

```ts
colors: {
  brand: {
    primary: 'var(--tes-color-brand-primary)',
    deep: 'var(--tes-color-brand-deep)',
    lavender: 'var(--tes-color-brand-lavender)',
    cyan: 'var(--tes-color-brand-cyan)',
  },
  surface: {
    page: 'var(--tes-color-surface-page)',
    default: 'var(--tes-color-surface-default)',
  },
  tesText: {
    primary: 'var(--tes-color-text-primary)',
    secondary: 'var(--tes-color-text-secondary)',
  },
}
```

## shadcn/ui

Mapear `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `border`, `ring` e `destructive` para tokens TES. Usar wrappers:

- `TESButton`
- `TESCard`
- `TESInput`
- `TESSelect`
- `TESDialog`
- `TESTable`
- `TESBadge`
- `TESTabs`

Exemplo:

```tsx
<TESButton variant="primary">Ver terapeutas</TESButton>
<TESCard tone="soft">Que tal revisar sua descrição?</TESCard>
```
