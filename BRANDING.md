# MeroDeutsch — Branding Guide

> **Name:** MeroDeutsch (*Mero* = Nepali “my” + *Deutsch*)
> **Tagline:** Learn German from zero — with Nepali support

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#2563eb` (blue) | CTA buttons, links, active states, header background |
| Mero red | `#dc2626` | "Mero" wordmark, error/danger accents |
| Accent gold | `#f59e0b` | Streak chips, "Deutsch" wordmark gradient, warning highlights |
| Neutrals | Slate scale | Body text, borders, surfaces |

## Logo Rules

- The logo shows **Mero** + **Deutsch**.
  - **Mero** = solid red.
  - **Deutsch** = amber/gold gradient wordmark (use solid dark/light where a gradient is weak on a blue surface).
- The logo is always a **link to Home (`/`)** in the header.
- Use the shared `BrandMark` component — never hand-roll the wordmark.

## Tone

Friendly, beginner-safe. Copy avoids jargon and keeps the learner confident.

## Components

- `BrandMark` component in `src/components/BrandMark.tsx`
- Brand tokens live in `src/config/theme.ts` → `theme.brand`
- Tagline used in hero + meta description