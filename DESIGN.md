---
name: Pysäkkivahti
description: A calm, mobile-first transit departure board for Tampere-area commuters.
colors:
  accent: "#0a6bff"
  accent-oklch: "oklch(57.4% 0.234 260.5)"
  surface: "#ffffff"
  background: "#f4f6f8"
  text: "#1a1d21"
  muted: "#5c6570"
  success: "#2a9d4f"
  error: "#d02f2f"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
components:
  location-btn:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  location-btn-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  route-number:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  departures-container:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Pysäkkivahti

## 01 Overview

**Creative North Star: "The Clear Platform Sign."**

Pysäkkivahti looks like a clean, well-lit platform display shrunk to fit a phone. The design borrows from transit signage: strong hierarchy, a single authoritative blue, generous whitespace between groups, and no decorative flourishes. Everything serves the commuter’s task: see where they are, see the next departure, move on.

The interface is intentionally calm. There are no gradients, no glass panels, no celebratory motion. State is communicated through color, weight, and a small set of tactile components. The brand blue comes from the favicon and is used sparingly but decisively for the active location, route badges, and focus rings.

**Key Characteristics:**
- Mobile-first, max-width 480px container.
- Restrained color strategy: one accent plus cool-tinted neutrals and a single semantic green.
- Strong typographic hierarchy via a serif display face (Fraunces) for headings and a system sans for everything else.
- Flat surfaces; no drop shadows on cards.
- 4px spacing scale with varied rhythm.

## 02 Colors

The palette is built around the transit blue from the favicon, with neutrals tinted toward the brand hue at very low chroma for subconscious cohesion.

### Primary
- **Transit Blue** (`#0a6bff` / `oklch(57.4% 0.234 260.5)`): The active location button, route number badges, focus rings, and the app’s primary accent. Used on less than 10% of any screen.

### Neutral
- **Cool Paper** (`#f4f6f8` / `oklch(97% 0.005 260.5)`): Page background. Cool-tinted, not warm cream.
- **Surface White** (`#ffffff` / `oklch(100% 0 0)`): Cards, buttons, and departure rows.
- **Ink** (`#1a1d21` / `oklch(25% 0.01 260.5)`): Primary text.
- **Muted** (`#5c6570` / `oklch(55% 0.02 260.5)`): Timestamps, secondary metadata.

### Semantic
- **Realtime Green** (`#2a9d4f` / `oklch(60% 0.2 145)`): Real-time departure indicator dot and text.
- **Error Red** (`#d02f2f` / `oklch(55% 0.22 25)`): Error messages. Meets WCAG AA contrast against the background.

### Named Rules
**The One Accent Rule.** The transit blue is the only saturated hue on the screen. The green is a semantic signal, not a second brand color.

## 03 Typography

**Display Font:** Fraunces (with Georgia fallback)
**Body Font:** system-ui / -apple-system / BlinkMacSystemFont / Segoe UI / Roboto stack

**Character:** A confident serif display paired with a neutral, offline-resilient system sans. The contrast is between authority (headings) and utility (data), not between competing decorative faces.

### Hierarchy
- **Display** (700, 2rem, line-height 1.1): App title only.
- **Title** (700, 1.5rem, line-height 1.2): Location header (`Koti → Keskusta`).
- **Body** (400, 1.125rem, line-height 1.6): Departure headsigns, buttons, status text. Max line length 75ch where prose appears.
- **Caption** (400, 0.875rem, line-height 1.5): Last-updated timestamp and GPS indicator label.

### Named Rules
**The No-Display-Labels Rule.** Fraunces appears only on the app title and location header. Buttons, data, and status text stay in the system sans.

## 04 Elevation

Pysäkkivahti is flat by default. Depth is conveyed through background color shifts (cool paper vs. surface white) and generous spacing, not by shadows. There are no card shadows, no glass blur, and no backdrop-filter effects. Hover states lift through tonal changes, not by casting a shadow.

### Shadow Vocabulary
None. The system avoids elevation shadows entirely.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If a state needs emphasis, use color or a focus ring, not a shadow.

## 05 Components

### Buttons (location buttons and refresh)
- **Shape:** 8px radius, min-height 44px, min-width 44px.
- **Default:** white background, 1px cool-tinted border, ink text.
- **Hover:** slightly tinted background shift.
- **Active:** pressed down 1px via `translateY(1px)`.
- **Focus:** 2px accent outline with 2px offset.
- **Selected:** transit blue background, white text.
- **GPS-detected:** same default styling, but contains an inline `.gps-indicator` dot.
- **Transition:** 150ms ease-out on background, color, transform, and box-shadow.

### Route number badge
- **Shape:** 4px radius, padding 4px 8px.
- **Color:** transit blue background, white text.
- **Typography:** 1.25rem, bold, centered, fixed min-width.

### Departure row
- **Layout:** flex row with route badge, headsign, and time.
- **Spacing:** 8px gap within the row, 8px vertical padding.
- **Divider:** subtle 1px cool-tinted border between rows.
- **Real-time state:** a small green dot appears before the departure time, and the time text uses the realtime green.

### Status bar
- **Layout:** flex row, space-between, with last-updated caption and refresh button.
- **Typography:** caption size for the timestamp, body size for the button label.

### Departures container
- **Shape:** 12px radius, 16px padding, white background.
- **Behavior:** Shows loading, empty, or error states centered inside the container.

## 06 Do's and Don'ts

### Do:
- Use the transit blue for the active location, route badges, and focus rings.
- Keep body text at 1.125rem or larger for legibility on mobile.
- Use the 4px spacing scale and vary values for rhythm.
- Provide visible `:focus-visible` rings on all interactive elements.
- Honor `prefers-reduced-motion` by disabling transitions.
- Use `rgb()` / hex fallbacks before every `oklch()` color declaration.

### Don't:
- Use purple gradients, glassmorphism, or cream/beige backgrounds.
- Use a thick colored side-tab border (`border-left`) as a state indicator.
- Apply decorative motion, bounce, or elastic easing.
- Use extreme border-radius (>16px) on cards or containers.
- Use gradient text (`background-clip: text` with a gradient).
- Use Fraunces on buttons, labels, or data text.
