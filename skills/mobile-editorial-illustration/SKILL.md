---
name: mobile-editorial-illustration
description: Preserve an editorial illustration's subject in mobile banners without compromising readable copy, touch targets, or TES visual tokens.
---

# Mobile Editorial Illustration

Use this skill when a TES mobile banner, hero, or CTA needs its illustration to
remain visibly meaningful after responsive composition. Do not use it for
functional screenshots, data visualizations, avatars, or imagery that carries
required information.

## Outcome

Keep semantic content first in the DOM and reserve a lower, dedicated visual
region for a decorative editorial asset. The image should support the message,
not compete with copy or cause the banner to collapse into a text-only card.

## Technique

1. Inspect the asset's focal subject before selecting `object-position`.
2. On mobile, give the illustration a deliberate lower region inside one
   clipped, rounded parent; avoid a thin bottom strip that crops out the
   subject.
3. Keep heading, supporting copy, and one primary CTA in the upper region.
   Leave sufficient vertical room below the CTA for the illustration to read.
4. Use an overlay gradient from the TES brand surface into transparency to
   protect text contrast while allowing the lower subject to remain visible.
5. Use `TESDecorativeMedia` for decorative assets. Keep `alt=""`; all meaning
   and actions must remain HTML siblings.
6. Preserve at least 20px horizontal padding, 44px touch targets, and avoid
   reducing functional text below the TES minimum.
7. Treat desktop as a separate composition when it already uses lateral media;
   do not force the tall mobile crop onto larger breakpoints.

## QA

- Inspect 375px, 390px, and 430px wide viewports.
- Confirm the focal subject is visible below the CTA, copy is readable without
  being hidden by the asset, and the banner has no horizontal overflow.
- Confirm the action remains visible and accessible without relying on the
  illustration.
- Use TES tokens and document any changed page-specific composition in that
  page's skill and inventory.
