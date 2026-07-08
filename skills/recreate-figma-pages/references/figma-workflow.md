# Figma Workflow

Use this guide when recreating a static screen from `↳ Design Telas`.

## Discovery

1. Set the current Figma page to `↳ Design Telas`.
2. Find the source static frame by route/name or provided node id.
3. Record:
   - source frame id;
   - route;
   - profile group;
   - width and height;
   - image fill hash when the frame is a raster screenshot.
4. Inspect `↳ Design System` for matching components before drawing manually.
5. Inspect the Figma page `ícones` and build a small task-local icon map from available icon component names.
6. Inspect local text styles and pick the closest style for each heading, body, label and microcopy.
7. Read the visible text from the reference image before building. Preserve exact copy when readable.
8. Record the source width as fixed. Treat source height as visual reference only, not as a hard constraint.

## Icon Usage

Use the page `ícones` as the first source for UI icons. The page contains a broad Lucide icon set as Figma components.

Process:

1. Search `ícones` by semantic terms from the target screen, such as `calendar`, `heart`, `shield`, `star`, `message`, `user`, `help`, `video`, `search`, `filter`, `share`, `clock` and close synonyms.
2. Use exact matches when available.
3. If an exact icon is not available, use a close semantic substitute from the same page.
4. Keep icon style consistent: normally `16`, `20` or `24px`, line icon, rounded visual feel.
5. Put icons inside clear icon slots when the layout expects a badge, feature marker or action glyph.
6. Name icon layers with both the chosen source and the UI intent, for example `Icon / shield-check / Segurança`.

Do not draw generic circles, dots or custom vector approximations when a usable icon exists on `ícones`.

## Image Handling

Separate reference imagery from editable page imagery.

- If the user provides a screenshot or clipboard image, upload it to Figma only so `Reference / {Perfil} / {Tela}` can show the source beside the editable page. If the upload tool places a stray node elsewhere, remove that stray node after copying its `imageHash` into the reference frame.
- In `Page / {Perfil} / {Tela}`, reuse existing Design System assets only when they are already available and clearly match the reference.
- When the user says images can be placeholders, says not to spend time on images, or exact image fidelity is not important, use editable image slots instead of raster image fills.
- Image slots should be visible, named, and stable: use a `FRAME` named like `Image Slot / Reiki thumbnail`, `Hero Image Slot / Portal scene`, or `Banner Image Slot / Mountain sunrise`; give it fixed dimensions matching the reference proportions, subtle TES-style fill/border, and optional small label text such as `Imagem`.
- Do not use a plain rectangle for an image slot if it needs nested text, icons, or inner decoration; use a frame so QA can inspect and edit it cleanly.
- Preserve image positions, relative sizes, crop intent, and rhythm from the reference even when the actual bitmap is replaced by a slot.
- Report in the completion note when images were intentionally represented as slots.

## Placement

Create the comparison wrapper beside the source frame, not on a new page:

- `QA Pair / {Perfil} / {Tela}`
- `Reference / {Perfil} / {Tela}`
- `Page / {Perfil} / {Tela}`

Keep the original source frame untouched.

## Sizing and Spacing

Preserve the static screen width so side-by-side QA is meaningful.

Allow the editable page height to grow when the source screenshot is compressed or when faithful components need more room. The recreated page should feel like a production screen, not a squeezed thumbnail.

Minimum quality rules:

- use comfortable section padding, normally no less than 24px on large public sections;
- use consistent lateral margins or centered content widths;
- keep vertical gaps readable between hero, cards, plan blocks, tables, FAQ and footer;
- use `TES/Caption` for table labels, helper text and compact card copy;
- use `TES/Micro` only for dense metadata, badges, tiny table marks or compact labels;
- create explicit image/illustration/icon slots when the original asset cannot be recreated exactly;
- do not reduce text below the Design System's smallest style unless a new style is intentionally added and documented.

## Composition

Build the editable page top-down:

1. wrapper and reference;
2. editable page frame;
3. header or shell;
4. hero/main content;
5. repeated cards/lists/tables;
6. support, plans, footer or secondary sections.

Before building each section, compare the reference position and approximate height. Use the same section order, density and alignment unless the source is visibly broken or too compressed. When the source is cramped, preserve hierarchy and intent while increasing spacing.

Prefer component instances for:

- navigation;
- buttons;
- badges;
- cards;
- shells;
- product cards;
- icons;
- chart/data components.

Use local auto-layout sections for page-specific composition. Bind fills/strokes to variables when available.

Apply text styles from `↳ Design System` whenever available. Fall back to direct font settings only when no matching text style exists.

## Missing Components

Create a local page section when the pattern is unique.

Create or update a Design System component when the pattern is:

- repeated across multiple static screens;
- needed by Storybook/code;
- a product-specific block such as session, payment, verification, chart or plan pattern.

When a component is created, update `↳ Design System` and the documentation in the same iteration.

## Figma API Guardrails

- Load fonts before editing text.
- Use `await figma.setCurrentPageAsync(page)`.
- Do not use `figma.currentPage = page`.
- Do not use `figma.notify()`.
- Return created and mutated IDs.
- Prefer fixed sizing for pixel-oriented reconstruction unless responsive behavior is being documented.
- Do not leave hidden placeholders unless they are intentionally named as Design System references.
