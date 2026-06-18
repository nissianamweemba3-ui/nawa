---
name: ckm:design-system
description: Token architecture, component specifications, and slide generation. Three-layer tokens (primitive→semantic→component), CSS variables, spacing/typography scales, component specs, strategic slide creation. Use for design tokens, systematic design, brand-compliant presentations.
argument-hint: "[component or token]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Design System

Systematic design token management and component specification.

## Token Architecture (3 Layers)

```
Primitive  →  --color-blue-600: #2563EB
Semantic   →  --color-primary: var(--color-blue-600)
Component  →  --button-bg: var(--color-primary)
```

**Critical Rule:** All implementations must import `assets/design-tokens.css` and use CSS variables exclusively — no hardcoded hex values.

## Key Capabilities

- Generate CSS variables from JSON config
- Validate hardcoded values in codebase
- Integrate with Tailwind theme
- Spacing and typography scales
- Component state definitions
- Strategic slide/presentation generation with Chart.js

## Slide Generation

```bash
/slides:create "10-slide investor pitch description"
```

Uses contextual decision engine with CSV databases for strategies, layouts, typography, colors, and copy formulas (PAS, AIDA, FAB patterns).

Validate compliance:
```bash
python3 scripts/slide-token-validator.py
```

## Integration Points

- **brand skill** → extracts primitive colors/typography
- **ui-styling skill** → component tokens → Tailwind config

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/generate-tokens.py` | Generate CSS from JSON config |
| `scripts/validate-tokens.py` | Check for hardcoded values |
| `scripts/slide-token-validator.py` | Validate slide token compliance |
