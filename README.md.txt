# MarcusOveracker.com — Design & Intent Blueprint

_Last updated: 2025-12-13_

This document records the **design decisions, conceptual constraints, and intended behavior** of the MarcusOveracker.com website.

It exists to:
- prevent design drift,
- avoid overbuilding,
- preserve intent across time,
- and keep the site subordinate to the compositional work itself.

This README describes **what the site is**, not how it is implemented.  
Tooling, frameworks, and build steps will be documented separately.

---

## 1. Core Purpose

MarcusOveracker.com is a **public-facing index of an active artistic practice**.

It is **not**:
- a brand platform
- a studio mythology
- a content feed
- a social-media substitute
- a comprehensive media archive

It **is**:
- a clear entry point to the work
- a living but restrained presence
- a site that feels inhabited rather than performative
- a container that stays subordinate to the compositions

The site must remain sustainable alongside composing, teaching, and research.

---

## 2. Identity & Tone

### Primary Identity
- **Name as anchor:** Marcus Overacker
- No studio name, brand name, or umbrella concept
- Identity is personal, not symbolic

### Descriptor Line
Displayed beneath the name:

> Composer · Guitarist · Teacher · Artist

This line:
- avoids hierarchy
- signals breadth without marketing
- counters a “stodgy academic” read without spectacle

### Overall Tone
- Quiet, intentional, contemporary
- Present-tense rather than archival
- Serious without austerity
- Lived-in, not ornamental

---

## 3. Front Page Structure (Mobile-First)

### Top of Page
- Largest text: **Marcus Overacker**
- Smaller text: descriptor line

### Navigation
Four vertically stacked, centered text links:

1. **Works**
2. **The Currents**
3. **About**
4. **Contact**

Navigation is:
- text-only
- vertically stacked
- calm and deliberate
- free of icons or menus

It should feel like entering a studio, not opening a dashboard.

### Monogram / Discretus Glyph
- Appears below navigation as a watermark-like element
- Secondary to the name
- Never centered or explained
- Functions as a personal authorship mark, not a symbol system

---

## 4. Subtle EMERGE Alignment (Front Page Only)

On interaction (hover on desktop, tap on mobile), the four navigation links briefly change color:

- Link 1: black background / white text
- Link 2: white background / black text
- Link 3: muted burnt yellow background / black text
- Link 4: earthy red background / white text

Constraints:
- Occurs **only on interaction**
- Appears **only on the front page**
- Does **not** persist to other pages
- Is **unnamed and unexplained**

This is a transient alignment with EMERGE’s alchemical logic, not a theme or branding system.

---

## 5. Works Page

### Structure
- Text-forward, static catalog
- Clear grouping:
  - Major works
  - Other works / revisions

### Each Work Entry Includes
- Title
- Year(s)
- Instrumentation
- Approximate duration
- Optional short neutral description

### Interaction
- Clicking a work reveals its **cover image** directly **below the text on the same page**
- No modals
- No galleries
- No navigation break

This interaction should feel like pulling an object from a drawer, not opening a presentation.

### Footer of Works Page
- A single quiet link:
  > Contact for scores

Signals professional availability without solicitation.

---

## 6. The Currents

### Purpose
The Currents is the **living present** of the site.

It exists to:
- signal ongoing



Implementations
---

## 11. Implementation (Current)

### Stack
- Vite (vanilla JS)
- Tailwind CSS v4 (via Vite plugin)
- PostCSS + Autoprefixer
- GitHub repo: `mrayover/marcusoveracker.com`

### Local paths (dev)
- Project root: `C:\Users\mrove\Projects\MarcusOveracker.com`

### Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

### Dependencies (see `package.json` for exact versions)
**devDependencies**
- `vite`
- `tailwindcss`
- `postcss`
- `autoprefixer`
- `@tailwindcss/vite`

---

### Config files (current)

#### `vite.config.js`
```js
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
@import "tailwindcss";

Front page implementation notes (current)
index.html

Must include the Vite entry script:

<script type="module" src="/src/main.js"></script>

src/main.js
import './style.css'

Home shell status

Name + descriptor line centered.

Four stacked nav “buttons” (beveled via inset shadow).

Interaction-only EMERGE color flashes (hover/active), confined to front page.

The Currents uses off-white (neutral-50) on interaction to distinguish from base white.

::contentReference[oaicite:1]{index=1}