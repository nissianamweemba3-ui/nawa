---
name: ckm:slides
description: Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies.
argument-hint: "[topic] [slide-count]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Slides — Strategic HTML Presentations

Generate professional HTML presentations with Chart.js, design tokens, and proven copywriting formulas.

## When to Use

- Marketing presentations and pitch decks
- Data-driven slides with Chart.js visualizations
- Investor presentations
- Strategic business decks

## Usage

```
/ckm:slides create "topic description" [slide-count]
```

## Knowledge Base

| Topic | File |
|-------|------|
| Creation Guide | `references/slides-create.md` |
| Layout Patterns | `references/slides-layout-patterns.md` |
| HTML Template | `references/slides-html-template.md` |
| Copywriting Formulas | `references/slides-copywriting-formulas.md` |
| Slide Strategies | `references/slides-strategies.md` |

## Copywriting Formulas

- **PAS** — Problem, Agitate, Solution
- **AIDA** — Attention, Interest, Desire, Action
- **FAB** — Features, Advantages, Benefits

## Design Requirements

- Import `assets/design-tokens.css` — single source of truth
- Use CSS variables exclusively, no hardcoded values
- Chart.js for all data visualizations
- Pattern breaks at 1/3 and 2/3 positions to alternate emotional beats
- Responsive layouts with design token spacing

## Reference Implementation

`assets/designs/slides/claudekit-pitch-251223.html`
