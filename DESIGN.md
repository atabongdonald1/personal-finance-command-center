# Design Brief

## Direction

Quiet Ledger — a warm-paper, editorial money command center that reads like a well-kept planning notebook, not a corporate bank dashboard.

## Tone

Refined and calm with an editorial edge — soft off-white paper, deep forest-teal ink, and a single burnt-amber accent; serious, human, trustworthy.

## Differentiation

Every currency figure is set in monospace tabular numerals so money aligns like a real ledger column, framed by warm paper surfaces and serif headings.

## Color Palette

| Token      | OKLCH         | Role                                    |
| ---------- | ------------- | --------------------------------------- |
| background | 0.985 0.008 85 | Warm paper canvas                      |
| foreground | 0.22 0.02 60   | Ink text                               |
| card       | 1 0.004 85     | Crisp elevated surfaces                |
| primary    | 0.42 0.084 178 | Forest-teal ink — actions, active nav  |
| accent     | 0.68 0.145 62  | Burnt amber — highlights, alerts       |
| muted      | 0.955 0.012 85 | Recessed panels, table stripes         |

## Typography

- Display: Fraunces — page and section headings, editorial serif voice
- Body: Satoshi — UI labels, paragraphs, navigation
- Mono: JetBrains Mono — all currency, percentages, and tabular figures
- Scale: hero `text-4xl md:text-5xl font-bold tracking-tight`, h2 `text-2xl md:text-3xl font-bold tracking-tight`, label `text-xs font-semibold uppercase tracking-widest`, body `text-sm md:text-base`

## Elevation & Depth

Flat paper base with hairline warm borders; cards lift via `shadow-subtle`, hover/active states via `shadow-elevated`; no glow or neon.

## Structural Zones

| Zone    | Background        | Border    | Notes                                          |
| ------- | ----------------- | --------- | ---------------------------------------------- |
| Sidebar | bg-sidebar        | border-r  | Teal active item, muted inactive, sticky       |
| Header  | bg-card           | border-b  | Page title + period selector + sign-out        |
| Content | bg-background     | —         | Sections alternate bg-card / bg-muted/40       |
| Footer  | bg-muted/40       | border-t  | Export/restore actions, muted small text       |

## Spacing & Rhythm

Spacious: `p-6 md:p-8` page padding, `gap-6` card grids, `space-y-8` between sections, `gap-2` inside stat cards; dense only within data tables.

## Component Patterns

- Buttons: 12px radius, primary teal fill, amber for alert actions, ghost for secondary; `transition-smooth` hover lift
- Cards: 12px radius, `bg-card`, hairline border, `shadow-subtle`; KPI cards use `label-caps` + mono value
- Badges: pill shape, tinted per semantic (success teal / warning amber / destructive red)

## Motion

- Entrance: `animate-fade-up` staggered 60ms per card on dashboard load
- Hover: `transition-smooth` 0.3s on buttons, rows, and nav items
- Decorative: `animate-grow-bar` for budget progress bars, `animate-fade-in` for alerts

## Constraints

- Never use raw hex or arbitrary Tailwind color classes — semantic tokens only
- All money and percentages in `font-mono` with tabular numerals
- Light theme is primary; dark mode is a tuned counterpart, not an inversion

## Signature Detail

The ledger-column treatment — monospace tabular numerals right-aligned across every figure, paired with Fraunces serif headings on warm paper.
