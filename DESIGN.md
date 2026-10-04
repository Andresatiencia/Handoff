---
name: Handoff
description: Good things. New beginnings.
colors:
  terracotta: "#a54433"
  terracotta-hover: "#863725"
  ink: "#342d28"
  muted: "#706356"
  amber: "#80531c"
  ivory: "#f8f5ee"
  surface: "#fffcf7"
  sand: "#eee7dc"
  white: "#ffffff"
  line: "#342d2826"
typography:
  display:
    fontFamily: "Instrument, Georgia, serif"
    fontSize: "clamp(4.3rem, 7vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Instrument, Georgia, serif"
    fontSize: "clamp(2.6rem, 4.7vw, 4.8rem)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Instrument, Georgia, serif"
    fontSize: "clamp(1.75rem, 3vw, 2.75rem)"
    fontWeight: 400
    lineHeight: 1.06
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  wordmark:
    fontFamily: "Manrope, sans-serif"
    fontSize: "29px"
    fontWeight: 800
    letterSpacing: "-0.04em"
rounded:
  control: "6px"
  feedback: "8px"
  surface: "12px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "13px 21px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-hover}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "13px 21px"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  intent-selected:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
---

# Design System: Handoff

## Overview

**Creative North Star: "The Semester Handoff"**

Handoff looks like good essentials moving from one student's last chapter into another student's first. Warm paper tones, dark ink, and a restrained terracotta accent give the product an inviting campus character. Photographic cutout objects make that transfer tangible in editorial moments; real listings keep their own uploaded photos and practical facts in view.

Task screens are calm and direct. Strong serif headlines introduce the moment, while sans-serif labels, dates, prices, and controls carry the work. The leaving/arriving scene changes perspective with an explicit toggle; the interface remains understandable through text when motion is reduced.

**Key Characteristics:**
- Warm, tactile ivory surfaces with a single strong terracotta action color.
- Editorial serif headlines paired with compact, readable task typography.
- Illustrative cutout essentials in brand moments; clear photo provenance in marketplace cards.
- Dates, condition, price, and next action visible where decisions happen.

## Colors

Terracotta marks primary actions, selected controls, and meaningful emphasis. Ivory is the page canvas; the lighter surface and sand separate work areas without visual noise.

### Primary
- **Handoff terracotta:** Primary actions, active navigation, selected intent, and selective headline emphasis. Its deeper hover state signals pointer interaction.

### Secondary
- **Pickup amber:** Timing and availability context where it must be distinguished from the primary action.

### Neutral
- **Warm ink:** Main copy and structural contrast.
- **Quiet brown:** Supporting text and captions.
- **Ivory paper:** Base page canvas.
- **Light paper:** Forms and cards.
- **Soft sand:** Grouped facts and secondary backgrounds.
- **Ink line:** Fine borders and dividers.

**The One Accent Rule.** Give terracotta to decisions and selected states; let type, spacing, and real item content carry the rest of the hierarchy.

## Typography

Instrument Serif gives display and section headings an editorial voice. DM Sans carries forms, navigation, listings, and dense task text. Manrope appears in the Handoff wordmark.

- **Display:** The large, close-set home statement; it may tighten further on mobile.
- **Headline:** Page introductions and major task titles.
- **Section:** Group headings and editorial breaks.
- **Body:** Readable descriptions and form help text.
- **Label:** Buttons, field labels, and compact navigation.
- **Wordmark:** Heavy, close-set brand lettering with its mark.

**The Two-Voice Rule.** Use the serif for meaning and the sans for actions and data; never set a long form or marketplace facts in the display face.

## Layout

The page container tops out at 1400px with 5% horizontal padding, becoming 22px per side on narrow screens. The landing page uses spacious editorial blocks; task routes use constrained content and clear panels. Arriving and leaving forms split introduction from work on wide screens and stack on mobile. Marketplace filters sit beside a two-column listing grid on desktop; filters become a disclosure and cards use one column on a narrow phone. The message view similarly stacks its thread navigation and conversation. Account verification is a focused, single-panel task within this same visual language.

Use the spacing scale for control gaps and internal rhythm, then allow larger editorial gaps where the implemented page composition calls for them. Preserve readable width and touch targets of at least 44px.

## Elevation & Depth

Surfaces are flat. Borders, tonal contrast, cropped photography, and composition create depth. Task panels suppress incidental utility shadows; focus uses a visible terracotta outline instead of a glow.

**The Paper Surface Rule.** Separate a card from the ivory canvas with light paper and a fine ink border, not a floating shadow.

## Shapes

Controls use modestly curved corners; forms, cards, and panels use the broader surface corner. Status pills and the perspective switch are fully rounded. Fine borders define most containers. Photographic hero objects are cutouts without card frames, while the missing-photo state is an honest typographic panel.

## Components

### Buttons

Primary buttons are terracotta with white text, a compact control corner, and a 48px minimum height. Secondary buttons use a transparent surface and ink border. Hover darkens primary buttons or adds sand to secondary ones; active press scales subtly. Disabled controls dim and lose the pointer cursor. Keyboard focus remains a 3px terracotta outline with 4px offset.

### Inputs

Fields use light paper, a fine ink border, a modest corner, and a 48px minimum height. Focus moves the border to terracotta and retains the global visible outline. Place errors near the affected action or field with readable text.

The email verification panel uses the same light-paper surface, heading hierarchy, primary action, and clear success/error language as other account tasks. Keep the explicit confirmation button prominent; loading, expired-link, and confirmed states must be legible without relying on color alone.

### Cards and status

Listing and bundle cards sit on light paper with a fine border and broad corner. Listing cards prioritize actual uploaded photos, status, title, price, condition, and pickup window; missing photos use the labeled typographic fallback. Bundle cards distinguish demo bundles from real move-in kits and show needs coverage, timing, estimated savings, and the complete reservation route.

### Navigation

The wordmark anchors a quiet text navigation. The current route uses terracotta and an underline. On narrow screens, a labeled menu button expands a touch-friendly grid. Footer links repeat the essential actions.

### Perspective switch

The landing-page leaving/arriving switch is a two-option pill group with an explicit pressed state. Cutout chair, lamp, and kitchen objects move briefly between perspectives, while the caption changes with the state. Reduced-motion settings remove the transition.

## Do's and Don'ts

### Do:
- **Do** use real listing photos when supplied, with the neutral labeled fallback when absent.
- **Do** keep arrival, departure, and pickup windows visible in marketplace and bundle decisions.
- **Do** distinguish illustrative objects and labeled demo bundles from real offers.
- **Do** keep the mobile task layout, focus outline, and reduced-motion behavior intact.

### Don't:
- **Don't** present brand photography or demo content as a real student's available listing.
- **Don't** add decorative gradients, glass surfaces, or repeated floating shadows.
- **Don't** make every card animate or require motion to understand a state change.
