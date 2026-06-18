---
name: ui-ux-pro-max
description: "UI/UX design intelligence for web and mobile. Includes 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across 10 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, and HTML/CSS). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, and check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, and mobile app. Elements: button, modal, navbar, sidebar, card, table, form, and chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, and flat design. Topics: color systems, accessibility, animation, layout, typography, font pairing, spacing, interaction states, shadow, and gradient."
license: MIT
metadata:
  author: nextlevelbuilder
  version: "2.5.0"
---

# UI/UX Pro Max — Design Intelligence

Comprehensive design system for professional UI/UX across web and mobile platforms.

## When to Use

Invoke when tasks involve UI structure, visual design decisions, interaction patterns, or experience quality. Essential for designing pages, creating components, selecting color schemes, reviewing UI code, implementing navigation, or improving interface clarity.

## Coverage

- **50+ design styles** — glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, skeuomorphism, flat design
- **161 color palettes** aligned with product categories
- **57 font pairings** with Google Fonts
- **161 product types** with industry-specific reasoning rules
- **99 UX guidelines**
- **25 chart types**
- **15+ tech stacks** — React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, HTML/CSS

## Priority Rule Hierarchy (1–10)

1. **Accessibility** (CRITICAL) — 4.5:1 contrast, keyboard navigation, focus states, ARIA labels
2. **Touch & Interaction** (CRITICAL) — 44×44px minimum targets, 8px spacing, feedback within 100ms
3. **Performance** (HIGH) — WebP/AVIF images, lazy loading, CLS < 0.1
4. **Style Selection** (HIGH) — Match product type, consistency, SVG icons (no emoji)
5. **Layout & Responsive** (HIGH) — Mobile-first, no horizontal scroll
6. **Typography & Color** (MEDIUM) — 16px base, 1.5 line-height, semantic tokens
7. **Animation** (MEDIUM) — 150–300ms duration, meaningful transitions, reduced-motion support
8. **Forms & Feedback** (MEDIUM) — Visible labels, inline validation, clear errors
9. **Navigation Patterns** (HIGH) — Bottom nav ≤5 items, predictable back, deep linking
10. **Charts & Data** (LOW) — Appropriate chart types, accessible colors, legends, tooltips

## Workflow

**Step 1:** Analyze requirements — product type, audience, style keywords, tech stack

**Step 2:** Generate complete design system:
```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Project"
```

**Step 3:** Supplement with domain searches:
```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <product|style|color|typography|ux|chart|react-native>
```

## Pre-Delivery Checklist

- No emoji used as icons — use SVG
- Consistent icon family throughout
- Touch targets ≥ 44×44px
- 4.5:1 contrast ratio in both light and dark themes
- Safe-area compliance on mobile
- Reduced-motion support
- No layout-shifting on interaction states
- Semantic color token consistency

## Common Pitfalls to Avoid

- Emoji as structural icons
- Unlabeled icon-only buttons
- Insufficient contrast in dark mode
- Layouts that shift on load (CLS)
- Animations exceeding 500ms
- Touch targets under 44px
- Hover-only interactions (no touch equivalent)
- Color as the sole state indicator
