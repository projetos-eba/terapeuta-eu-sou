# QA and Documentation

Use this guide before reporting a recreated Figma page as complete.

## Structural QA

Check the editable page frame for:

- no generic names;
- no placeholder text such as `Title`, `Heading`, `Button` or empty text;
- no child wider than the page frame;
- no empty image fills;
- no clipped primary content;
- clear top-level section names;
- metadata linking the recreation to the source frame id and route.

## Visual QA

Compare `Reference / {Perfil} / {Tela}` and `Page / {Perfil} / {Tela}` side by side.

Validate:

- page width matches the source;
- editable page height may exceed the source when needed for spacing and legibility;
- no section is compressed only to fit the source screenshot height;
- hierarchy and major sections match;
- visible text is copied faithfully when readable;
- typography uses Design System text styles or an explicitly close fallback;
- compact text uses `TES/Caption` or `TES/Micro` where appropriate;
- major sections sit in the same relative position as the reference;
- spacing rhythm is close to the reference while preserving comfortable padding;
- sections have consistent side margins and clear vertical gaps;
- colors use TES variables;
- typography is legible and close to the static screen;
- cards, radius, borders and shadows feel consistent;
- icons and assets follow the Design System style;
- icon-like marks use components from the Figma page `ícones` when a usable match exists;
- semantic substitutions are reasonable and named clearly, instead of using random or generic dots;
- image, illustration and icon slots are clearly defined and not visually accidental;
- no overlap, crop or clipped text.
- no internal overflow inside composed cards, tables, filters, action rows or hero artwork;
- action columns and metadata columns remain fully visible inside their parent card;
- centered sections are actually centered in the page frame, not merely narrower than the page;
- if a recurring composition is needed to fix clipping or alignment, create/update the component in `Design System` and document it in the same iteration.

## Documentation Updates

Only update documentation when a reusable component, variant, pattern or token is created or changed.

Update these files when applicable:

- `COMPONENT_ARCHITECTURE.md`
- `COMPONENT_USAGE_GUIDELINES.md`
- `FIGMA_STORYBOOK_SYNC_MAP.md`
- `DESIGN_SYSTEM_FINAL_HANDOFF.md`
- `docs/design-system/component-inventory.md`
- `docs/design-system/storybook-plan.md`
- `docs/design-system/qa-checklist.md`

Record:

- component name;
- purpose;
- when to use;
- Design System section where it was added;
- Storybook/code mapping status;
- remaining risks or pending implementation.

## Completion Report

Report:

- source frame id;
- created QA pair id;
- editable page id;
- QA status;
- whether documentation changed;
- next recommended screen.
