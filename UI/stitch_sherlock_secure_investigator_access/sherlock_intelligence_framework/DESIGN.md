---
name: Sherlock Intelligence Framework
colors:
  surface: '#f7f9ff'
  surface-dim: '#d4dae5'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e8eefa'
  surface-container-high: '#e2e9f4'
  surface-container-highest: '#dce3ee'
  on-surface: '#151c24'
  on-surface-variant: '#434655'
  inverse-surface: '#2a3139'
  inverse-on-surface: '#eaf1fc'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#5a5f67'
  on-secondary: '#ffffff'
  secondary-container: '#dbe0ea'
  on-secondary-container: '#5e636b'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dee2ec'
  secondary-fixed-dim: '#c2c7d0'
  on-secondary-fixed: '#171c23'
  on-secondary-fixed-variant: '#42474f'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f7f9ff'
  on-background: '#151c24'
  surface-variant: '#dce3ee'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  headline-md-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is engineered for high-stakes investigative environments, prioritizing clarity, speed of cognition, and analytical rigor. The aesthetic is **Corporate Modern** with a lean toward **Minimalism**, characterized by a structured "Command Center" feel. 

The interface facilitates long-duration focus sessions by utilizing a neutral, low-strain background while highlighting critical data points through purposeful accent colors. The visual language conveys authority and precision, ensuring that the investigator's attention is directed entirely toward evidence and pattern recognition without visual distraction.

## Colors
The palette is built on a foundation of professional grays and deep charcoals to establish an institutional tone. 

- **Primary Accent (#2563EB):** Reserved strictly for interactive elements and primary calls to action.
- **Sidebar/Brand (#151A21):** Used for structural navigation to provide a strong visual anchor and contrast against the workspace.
- **Semantic Colors:** Success, Warning, and Critical tones are slightly desaturated to maintain a professional appearance while ensuring high legibility for status indicators and alerts.
- **Surface Strategy:** Use `#FFFFFF` for primary content containers to create a clear "layering" effect against the `#F5F6F8` workspace background.

## Typography
The system employs a tri-font strategy to differentiate between intent:
1. **Hanken Grotesk** (Headlines): Provides a sharp, contemporary authority for page titles and module headers.
2. **Inter** (Body): Optimized for readability in data-dense forms and descriptions.
3. **JetBrains Mono** (Technical Data): Used for ID numbers, timestamps, coordinates, and technical metadata to ensure character distinctness (e.g., 0 vs O).

Maintain a tight vertical rhythm. In information-heavy views, use `body-md` as the default size to maximize data density without sacrificing legibility.

## Layout & Spacing
This design system utilizes a **Fixed Grid** model for analytical dashboards.
- **Grid:** 12-column system for desktop, 4-column for mobile.
- **Density:** High density. Use 8px (sm) and 16px (md) increments for internal component padding.
- **Sidebar:** A fixed left-hand navigation (240px width) keeps global tools accessible.
- **Panels:** Use a "Master-Detail" layout for investigations, where the primary list is on the left and the detailed intelligence report occupies the center-right fluid area.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Subtle Shadows** rather than heavy lighting effects.
- **Level 0 (Background):** `#F5F6F8` - The base workspace.
- **Level 1 (Panels/Cards):** `#FFFFFF` - Primary containers. Use a 1px border of `#DDE1E6`.
- **Shadows:** Use a single, highly diffused shadow for elevated elements (like active dropdowns or modals): `0px 4px 12px rgba(28, 35, 43, 0.08)`.
- **Interaction:** On hover, a card should not rise; instead, change the border color to the Primary Accent or increase the border-width slightly to maintain the flat, analytical feel.

## Shapes
The shape language is precise and modular.
- **Standard Controls:** Buttons, inputs, and tags use an **8px (0.5rem)** radius. This offers a modern feel while remaining professional.
- **Structural Containers:** Cards and main content panels use a **12px (0.75rem)** radius to soften the layout and distinguish the container from the content within.
- **Icons:** Use 20px bounding boxes with a 2px stroke weight to match the technicality of the typography.

## Components
- **Buttons:** Primary buttons are solid `#2563EB` with white text. Secondary buttons use a white background with a `#DDE1E6` border and `#1C232B` text. No gradients.
- **Input Fields:** Use 1px `#DDE1E6` borders. On focus, the border shifts to `#2563EB` with a subtle 2px soft outer glow in the same color (opacity 10%).
- **Intelligence Chips:** Small tags used for classification (e.g., "High Risk"). Use a light tint of the semantic color for the background (10% opacity) and the full-strength color for the text.
- **Data Tables:** Row height should be a compact 40px. Use alternating row stripes or subtle dividers (`#DDE1E6`). Header text should use `label-caps`.
- **Status Indicators:** Simple 8px circular dots paired with text for real-time status.
- **Investigation Timeline:** A vertical 2px line with nodes representing events, utilizing JetBrains Mono for timestamps.