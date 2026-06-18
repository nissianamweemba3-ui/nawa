---
name: ckm:design
description: "Comprehensive design skill: brand identity, design tokens, UI styling, logo generation (55 styles, Gemini AI), corporate identity program (50 deliverables, CIP mockups), HTML presentations (Chart.js), banner design (22 styles, social/ads/web/print), icon design (15 styles, SVG, Gemini 3.1 Pro), social photos (HTML→screenshot, multi-platform). Actions: design logo, create CIP, generate mockups, build slides, design banner, generate icon, create social photos, social media images, brand identity, design system. Platforms: Facebook, Twitter, LinkedIn, YouTube, Instagram, Pinterest, TikTok, Threads, Google Ads."
argument-hint: "[design-type] [context]"
license: MIT
metadata:
  author: claudekit
  version: "2.1.0"
---

# Design

Unified design skill: brand, tokens, UI, logo, CIP, slides, banners, social photos, icons.

## When to Use

- Brand identity, voice, assets
- Design system tokens and specs
- UI styling with shadcn/ui + Tailwind
- Logo design and AI generation
- Corporate identity program (CIP) deliverables
- Presentations and pitch decks
- Banner design for social media, ads, web, print
- Social photos for Instagram, Facebook, LinkedIn, Twitter, Pinterest, TikTok

## Sub-skill Routing

| Task | Sub-skill |
|------|-----------|
| Brand identity, voice, assets | `ckm:brand` |
| Tokens, specs, CSS vars | `ckm:design-system` |
| shadcn/ui, Tailwind, code | `ckm:ui-styling` |
| Logo creation, AI generation | Logo (built-in) |
| CIP mockups, deliverables | CIP (built-in) |
| Presentations, pitch decks | `ckm:slides` |
| Banners, covers, headers | `ckm:banner-design` |
| Social media images/photos | Social Photos (built-in) |
| SVG icons, icon sets | Icon (built-in) |

## Logo Design

55+ styles, 30 color palettes, 25 industry guides. Uses Gemini AI.

```bash
# Generate design brief
python3 ~/.claude/skills/design/scripts/logo/search.py "tech startup modern" --design-brief -p "BrandName"

# Search styles/colors/industries
python3 ~/.claude/skills/design/scripts/logo/search.py "minimalist clean" --domain style
python3 ~/.claude/skills/design/scripts/logo/search.py "healthcare medical" --domain industry

# Generate with AI (always white background)
python3 ~/.claude/skills/design/scripts/logo/generate.py --brand "TechFlow" --style minimalist --industry tech
```

## CIP Design

50+ deliverables, 20 styles, 20 industries.

```bash
# Generate brief
python3 ~/.claude/skills/design/scripts/cip/search.py "tech startup" --cip-brief -b "BrandName"

# Generate mockups
python3 ~/.claude/skills/design/scripts/cip/generate.py --brand "TopGroup" --logo /path/to/logo.png --deliverable "business card" --industry "consulting"

# Full CIP set
python3 ~/.claude/skills/design/scripts/cip/generate.py --brand "TopGroup" --logo /path/to/logo.png --industry "consulting" --set
```

## Icon Design

15 styles, 12 categories. Gemini 3.1 Pro generates SVG text.

```bash
python3 ~/.claude/skills/design/scripts/icon/generate.py --prompt "settings gear" --style outlined
python3 ~/.claude/skills/design/scripts/icon/generate.py --prompt "shopping cart" --style filled --color "#6366F1"
```

## Social Photos

Multi-platform: HTML/CSS → screenshot export.

| Platform | Size (px) | Platform | Size (px) |
|----------|-----------|----------|-----------|
| IG Post | 1080×1080 | FB Post | 1200×630 |
| IG Story | 1080×1920 | X Post | 1200×675 |
| YT Thumb | 1280×720 | LinkedIn | 1200×627 |

## Setup

```bash
export GEMINI_API_KEY="your-key"  # https://aistudio.google.com/apikey
pip install google-genai pillow
```
