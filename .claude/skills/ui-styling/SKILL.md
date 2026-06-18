---
name: ckm:ui-styling
description: Create beautiful, accessible user interfaces with shadcn/ui components (built on Radix UI + Tailwind), Tailwind CSS utility-first styling, and canvas-based visual designs. Use when building user interfaces, implementing design systems, creating responsive layouts, adding accessible components (dialogs, dropdowns, forms, tables), customizing themes and colors, implementing dark mode, generating visual designs and posters, or establishing consistent styling patterns across applications.
argument-hint: "[component or layout]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# UI Styling

Build beautiful, accessible UIs with shadcn/ui + Tailwind CSS.

## Core Stack

- **shadcn/ui** — Pre-built accessible components via Radix UI primitives, copy-paste distribution, TypeScript support
- **Tailwind CSS** — Utility-first, zero runtime overhead, automatic dead code elimination
- **Canvas** — Visual design layer for sophisticated minimal-text compositions

## Supported Frameworks

React, Next.js, Vite, Remix, Astro

## Key Capabilities

- Accessible components: forms, dialogs, tables, dropdowns, navigation
- Responsive mobile-first layouts
- Dark mode and theme customization
- Design system tokens with CSS variables
- Complex patterns: data tables, command palettes, comboboxes

## Setup

```bash
npx shadcn@latest init
```

Then add components individually:
```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add form
```

## Best Practices

- Composition over repetition — build from primitives
- Accessibility-first — leverage Radix UI built-in behavior
- Mobile-first responsive — `sm:` `md:` `lg:` breakpoints
- Semantic color tokens — never hardcode hex values
- Consistent spacing rhythm — 4/8dp grid

## References

| Topic | File |
|-------|------|
| Component Catalog | `references/components.md` |
| Theming System | `references/theming.md` |
| Accessibility Patterns | `references/accessibility.md` |
| Tailwind Utilities | `references/tailwind.md` |
| Responsive Design | `references/responsive.md` |
| Canvas Visual Design | `references/canvas.md` |
