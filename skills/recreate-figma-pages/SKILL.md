---
name: recreate-figma-pages
description: >
  Use whenever the user wants to recreate, rebuild, or improve a screen from
  Figma's 'Design Telas' page as an editable frame. Triggers include:
  "recreate this screen", "rebuild this page in Figma", "turn this screenshot
  into a real frame", "improve this Figma page", or any reference to recreating
  UI from a static image using the Design System. Always use this skill —
  don't attempt Figma screen recreation without it.
---

# Recreate Figma Pages

## Purpose

Recreate one static screen at a time from `↳ Design Telas` as an editable Figma frame, using the existing `↳ Design System` as the visual source of truth.

## Required Skills

Before any Figma write, load and follow:

- `figma-use`
- `figma-generate-design`
- `figma-generate-library` only when a reusable component must be created or updated.

## Workflow

1. Inspect the target screen frame in `↳ Design Telas`.
2. Capture or inspect the static image reference. If the source is an external screenshot or clipboard image, upload/use it only for the `Reference / ...` frame.
3. Extract the visible copy from the image as carefully as possible before building.
4. Inspect `↳ Design System` for reusable components, variables, text styles, effects, icons and assets.
5. Inspect the Figma page `ícones` for reusable icon components before drawing any icon-like placeholder.
6. Create one comparison wrapper beside the source frame:
   - `QA Pair / {Perfil} / {Tela}`
   - `Reference / {Perfil} / {Tela}`
   - `Page / {Perfil} / {Tela}`
7. Keep the original static frame untouched.
8. Recreate the editable page section by section.
9. Apply text styles from the Design System whenever matching styles exist.
10. Match section order, relative placement, proportions and visual rhythm against the reference, not only the general aesthetic.
11. Run visual and structural QA.
12. Fix issues before starting the next page.
13. Update documentation only when a new reusable component or pattern is created.

Load `references/figma-workflow.md` before building a screen. Load `references/qa-and-docs.md` before final QA or documentation updates.

## Rules

- Recreate exactly one page per iteration.
- Start from existing Design System components and variables.
- Use icon components from the Figma page `ícones` before creating generic dots, vector placeholders or improvised icon shapes.
- If no exact icon exists, choose the closest semantic icon from `ícones` and name the layer with the chosen icon, for example `Icon / calendar-check / Próximo horário`.
- If no reasonable icon exists, use a simple placeholder only as a last resort and report the approximation.
- Use existing text styles before manually assigning font size/weight.
- Preserve the source width, but allow the editable page height to grow when needed for better spacing, legibility and component quality.
- Never compress sections only to match the static screenshot height.
- Use comfortable section padding, consistent side margins and legible vertical gaps from the Design System spacing scale.
- Keep image, illustration and icon areas clearly defined even when they must be represented by structured placeholders.
- When the user says images can be placeholders, or exact image recreation is not essential, do not spend time recreating or generating those images in the editable page. Use named editable frames such as `Image Slot / Service thumbnail` or `Hero Image Slot / ...`, preserving the reference proportions and placement.
- Preserve the actual visible text from the reference image whenever it is readable.
- If a word is unreadable, use a close TES-voice substitute and mark the inference in the completion report.
- Position major sections and repeated elements to match the reference image as closely as practical.
- Do not create abstract components for one-off layout needs.
- Create or update a Design System component only when the pattern is recurring or likely reusable.
- Keep patient and therapist language human, calm and non-aggressive.
- Avoid `lead`, `funil`, `CTR`, `conversão`, `baixa performance`, promises of cure, diagnosis or financial gain.
- Return created and mutated Figma node IDs from every write.
- Validate the full `QA Pair` and the editable `Page` before reporting completion.

## Naming

Use predictable names:

- `QA Pair / Público / Home`
- `Reference / Público / Home`
- `Page / Público / Home`
- `Section / Como funciona`
- `Hero`
- `Header / PublicHeader Instance`
- `TherapyCard/Reiki`
- `TherapistCard/Ana Oliveira`

Never leave generic names such as `Frame 123`, `Card 1`, `Teste`, `Botão novo` or `Versão final`.
