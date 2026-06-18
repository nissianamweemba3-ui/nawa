---
name: ckm:brand
description: Brand voice, visual identity, messaging frameworks, asset management, brand consistency. Activate for branded content, tone of voice, marketing assets, brand compliance, style guides.
argument-hint: "[update|review|create] [args]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Brand Identity Kit

Comprehensive brand management: voice, visual identity, assets, and consistency.

## When to Use

- Defining or updating brand voice and tone
- Creating messaging frameworks
- Managing visual identity (colors, typography, logo)
- Auditing brand compliance
- Generating style guides

## Core Domains

1. **Voice & Messaging** — Tone guidance, communication frameworks
2. **Visual Standards** — Color palettes, typography, design specs
3. **Asset Management** — Organization, naming, validation
4. **Consistency Auditing** — Brand compliance review
5. **Synchronization** — Keep brand definitions aligned with design tokens

## Key Workflow

1. Edit `brand-guidelines.md` (source of truth)
2. Sync to design tokens via `scripts/sync-tokens.cjs`
3. Validate outputs with `scripts/validate-assets.cjs`

## Scripts

| Script | Purpose |
|--------|---------|
| `inject-brand-context.cjs` | Extract brand info for prompt enrichment |
| `sync-tokens.cjs` | Sync guidelines → design tokens |
| `validate-assets.cjs` | Check naming, formats, dimensions |
| `extract-colors.cjs` | Analyze and compare palette adherence |

## References

| Topic | File |
|-------|------|
| Voice Framework | `references/voice-framework.md` |
| Visual Identity | `references/visual-identity.md` |
| Logo Usage | `references/logo-usage.md` |
| Color System | `references/color-system.md` |
| Typography | `references/typography.md` |
| Asset Guidelines | `references/asset-guidelines.md` |
| Approval Checklist | `references/approval-checklist.md` |
