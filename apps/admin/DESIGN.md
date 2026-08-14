---
name: Better Commerce Admin
description: A calm, Persian-first merchant command desk for clear daily commerce operations.
colors:
  canvas: "oklch(0.967 0.004 215)"
  ink: "oklch(0.225 0.018 230)"
  surface: "oklch(0.995 0.002 215)"
  surface-ink: "oklch(0.22 0.018 235)"
  action-teal: "oklch(0.405 0.085 205)"
  action-on-teal: "oklch(0.985 0.005 210)"
  secondary-surface: "oklch(0.94 0.012 215)"
  secondary-ink: "oklch(0.3 0.045 225)"
  muted-surface: "oklch(0.95 0.008 215)"
  muted-ink: "oklch(0.48 0.025 230)"
  accent-surface: "oklch(0.92 0.025 215)"
  accent-ink: "oklch(0.3 0.055 225)"
  border: "oklch(0.875 0.012 220)"
  input-border: "oklch(0.82 0.018 220)"
  destructive: "oklch(0.58 0.22 27)"
  success: "oklch(0.52 0.14 155)"
  warning: "oklch(0.63 0.14 75)"
  info: "oklch(0.52 0.12 245)"
typography:
  headline:
    fontFamily: "IranSans, Tahoma, Arial, sans-serif"
    fontSize: "clamp(1.5rem, 1.25rem + 0.75vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "IranSans, Tahoma, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "IranSans, Tahoma, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "IranSans, Tahoma, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
  technical:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-teal}"
    textColor: "{colors.action-on-teal}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.surface-ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  status-badge:
    backgroundColor: "{colors.muted-surface}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    height: "24px"
---

# Design System: Better Commerce Admin

## Overview

**Creative North Star: "The Merchant Command Desk"**

Better Commerce Admin is a calm, professional operating environment for Persian-speaking merchants and non-technical store employees. It borrows the familiarity of mature commerce tools—clear sections, task-oriented pages, dense but readable records, and focused overlays—without copying Shopify's visual identity or page compositions. Brand character comes from disciplined RTL craft, cool neutral surfaces, and a restrained deep-teal action color.

The interface favors operational clarity over decoration. A user should be able to scan status, identify the next action, edit one coherent section, and understand the result without interpreting developer language. Forms expose ordinary merchant concepts; internal IDs and system metadata recede unless they are necessary for support or auditing.

**Key Characteristics:**

- Persian-first, RTL-first composition with intentional LTR islands for technical values.
- Quiet cool-gray canvas, near-white working surfaces, and rare deep-teal emphasis.
- Adaptive density: compact tables on wider screens and purpose-built record cards on narrow screens.
- Explicit section-level saves, visible status, and focused confirmation for consequential actions.
- Source-owned shadcn primitives as the default construction material.

## Colors

The palette is a cool, low-chroma operational system. Most of the screen stays neutral so status and primary actions remain immediately legible.

### Primary

- **Action Teal:** The sole brand/action accent. Use for the main action, active navigation, selected controls, links, and focus treatment.
- **Teal Contrast:** Text and icons placed on Action Teal.

### Secondary

- **Secondary Surface:** Hover states, quiet controls, selected-but-not-primary regions, and grouped navigation backgrounds.
- **Accent Surface:** A slightly stronger cool highlight for active or emphasized neutral states.

### Tertiary

- **Success Green:** Completed, active, available, and healthy states only.
- **Warning Amber:** Attention-required, pending, suspended, or potentially risky states only.
- **Destructive Red:** Destructive actions and failures only; never use it as decoration.
- **Information Blue:** Neutral operational information that is neither success nor warning.

### Neutral

- **Canvas:** The application background and default field surface.
- **Surface:** Cards, sidebars, popovers, and working panels.
- **Ink:** Primary copy and important values.
- **Muted Ink:** Supporting copy, labels, metadata, and empty-state guidance.
- **Border:** Dividers and ordinary container boundaries.
- **Input Border:** A deliberately clearer boundary for editable controls.

**The One Accent Rule.** Action Teal is scarce. A normal page has one visually dominant primary action; secondary work uses outline or ghost treatment.

**The Semantic Color Rule.** Green, amber, red, and blue always communicate state. Never use them simply to make a quiet page more colorful.

**The Token-Only Rule.** Change the visual theme through the custom properties in `src/styles/globals.css`. Feature code consumes semantic utilities such as primary, muted, border, success, and destructive; it does not introduce page-local brand colors.

## Typography

**Display Font:** IranSans, with Tahoma and Arial fallbacks

**Body Font:** IranSans, with Tahoma and Arial fallbacks
**Technical Font:** The platform UI sans-serif stack

**Character:** IranSans gives Persian labels and long-form guidance an even, professional rhythm. Weight and spacing—not oversized type—create hierarchy. Technical values deliberately use a neutral system face to preserve Latin glyph and numeral clarity.

The application expects these user-provided font assets under `public/admin/fonts/`:

- `IRANSansWeb.woff2` for regular text.
- `IRANSansWeb_Medium.woff2` for medium and semibold text.
- `IRANSansWeb_Bold.woff2` for bold text.

### Hierarchy

- **Headline:** Page titles only. Keep them short, semibold, and paired with a useful one- or two-line description.
- **Title:** Card titles, dialog titles, and major section headings.
- **Body:** Default labels, values, descriptions, and operational copy. Long descriptions should remain below approximately 70 characters per line where layout permits.
- **Label:** Table headings, eyebrow text, metadata labels, and compact status copy.
- **Technical:** SKUs, UUIDs, slugs, emails, request IDs, action keys, currency codes, and exact money strings.

**The Persian Hierarchy Rule.** Do not use uppercase, exaggerated tracking, or Latin editorial conventions to create hierarchy in Persian. Use weight, size, and spacing.

**The Human Language Rule.** Headings, buttons, validation, empty states, and errors speak to a store employee. Raw exception names, HTTP jargon, and database language never appear in the UI.

## Layout

The authenticated shell is RTL and uses a persistent right sidebar at desktop widths. The expanded sidebar is 280px wide and may collapse to 80px; content always occupies the remaining width without horizontal page scrolling. The top bar remains sticky and keeps global search available. Main content uses responsive horizontal padding of 16px, 24px, then 40px, with vertical page rhythm between 24px and 36px.

Operational pages normally use a centered maximum width near 1152px (`max-w-6xl`) and a 20–24px vertical rhythm. The page header separates context from work with a quiet bottom divider. Related fields belong in a card, and actions sit close to the section they affect. Use two-column layouts only when both columns remain useful peers; editor side panels may use a fixed width near 352px at large breakpoints.

Use the spacing tokens in multiples of 4px. Dense records use 12px cell padding, cards use 20px internal padding, and page sections use 20–24px gaps. Do not stretch simple forms across the full viewport: constrain readable fields and group them by merchant task.

At widths below 1024px, the sidebar becomes a right-side sheet and the content uses the full viewport. At widths below 768px, multi-column forms stack and data tables become designed record cards; do not merely force a wide table into horizontal scrolling. Mobile actions wrap or stack, remain at least 36px high, and preserve clear primary/secondary order. The document must not overflow horizontally at the 320px minimum viewport.

**The Adaptive Density Rule.** Desktop optimizes scanning across rows; mobile optimizes comprehension within one record. The information stays equivalent even when the composition changes.

**The Local Save Rule.** Each editable section owns an explicit save action. Do not create a single distant page-level save for unrelated product, media, variant, price, or inventory changes.

## Elevation & Depth

The system is flat by default. Surface hierarchy comes primarily from tonal separation, 1px borders or low-opacity rings, and spacing. Cards use a subtle foreground ring rather than a heavy shadow. Small controls may use a faint `shadow-xs`; floating dialogs, sheets, select menus, and popovers may use stronger shadow because they must sit clearly above the operating surface.

Overlays use a dark translucent scrim with a slight backdrop blur. Motion is short and functional: fades, modest scale changes, and sheet slides communicate entry and exit without becoming ornamental. All animation and transition duration is reduced to effectively zero when `prefers-reduced-motion: reduce` is active.

**The Flat-at-Rest Rule.** Ordinary cards and tables do not float. Reserve visible elevation for transient layers and focus.

## Shapes

The form language is gently rounded and practical. Buttons use compact 10px corners, fields and navigation controls use 12px corners, and cards/dialogs use 16px corners. Status badges are pills because they are small categorical labels, not containers. Thumbnail media uses tighter 8–10px corners so imagery remains visually precise.

Borders are quiet and structural. Use one boundary per grouping; avoid nested outlines around every child. Dashed borders belong only to genuine drop zones or empty upload targets. Destructive controls retain the same geometry as ordinary controls and rely on semantic color and copy, not alarming shapes.

**The One Container Rule.** If a card already defines a section boundary, its ordinary child rows use dividers or spacing—not another stack of decorative cards.

## Components

Build new work from `src/components/ui` before creating a feature-local primitive. Components are source-owned shadcn/Radix implementations and may be extended centrally when a recurring need is proven.

### Buttons

- **Primary:** Solid Action Teal with high-contrast text; one dominant action per region.
- **Outline:** Neutral background and border for secondary actions such as cancel, edit, and retry.
- **Ghost:** Low-emphasis navigation and row actions. Destructive ghost actions may use red text but still require clear copy.
- **Sizing:** Default controls are 36px high; compact is 32px, large is 40px, and icon-only is 36px square.
- **States:** Every button has visible hover and keyboard focus, communicates pending state in its label, and disables duplicate submission.

### Cards / Containers

- Cards group one merchant concept and use a near-white surface, a subtle ring, 16px corners, and 20px padding.
- Card headers state the task; descriptions explain consequences or scope, not implementation.
- Card footers may use a slightly muted surface and top divider to anchor section actions.
- Avoid blank cards, decorative KPI grids, and excessive nesting.

### Inputs / Fields

- Every field has a programmatically associated visible label. Optional help text explains format or business meaning.
- Inputs are 40px high with an explicit border, quiet background, 12px horizontal padding, and a clear teal focus ring.
- Errors are associated through `aria-invalid` and nearby human-readable guidance. Disabled fields remain legible and look inactive.
- Money uses exact decimal strings and a visible currency. A missing price is a supported business state, not a validation error.

### Tables and Record Lists

- Use semantic table elements for genuinely tabular desktop data, with scoped column headings and 12px cell padding.
- Keep the primary identity column visually strongest; supporting metadata is muted. Put row actions in a dedicated, compact action cell.
- Long technical values truncate in the row and expose the full value through an accessible detail view or title where appropriate.
- Below the medium breakpoint, render record cards with labeled values and the same available actions. Never shrink six columns until content wraps character by character.

### Status and Feedback

- Use `StatusBadge` for short states and counts; choose neutral, info, success, warning, or destructive by meaning.
- Use `FeedbackPanel` for actionable inline information, success, warning, or error. Errors say what failed and what the employee can try next.
- Use toasts for short confirmation after an action. Persistent or blocking failures stay near the affected task.
- Loading uses skeletons shaped like the incoming content. Empty states explain why the area is empty and offer a relevant next action when one exists.

### Tabs and Navigation

- Tabs divide one resource workspace into stable, backed sections. The active tab must be represented in router state so refresh, back, forward, and direct links work.
- Use short Persian nouns with icons only when the icon improves scanning. Do not hide the label on ordinary widths.
- Sidebar groups reflect merchant tasks, not backend module boundaries. Active navigation uses a tinted teal state rather than a loud filled block.
- Global search opens from the header, `Ctrl/Cmd+K`, or `/` when focus is not inside an editor.

### Dialogs, Sheets, and Confirmation

- Dialogs focus one bounded task. They include a specific title, consequence-oriented description, labeled controls, and explicit submit/cancel actions.
- Use an alert dialog for destructive or access-changing actions. State exactly what changes and whether it can be reversed.
- Use a right-side sheet for mobile navigation and similarly contextual narrow workflows; do not turn every editor into a modal.
- Dialog actions stack on narrow screens and align as a compact group on wider screens. Focus is trapped and returns to the trigger on close.

### Product Media and Variants

- Product media uses one focused preview, a compact ordered thumbnail rail, clear primary-image state, alt-text editing, and a dedicated upload target.
- The full product gallery remains visible. Selecting a variant emphasizes media assigned to that variant without erasing the product-level gallery context.
- Variant editing groups identity, price, inventory, status, and assigned media into readable sections. Price and inventory remain variant-level values and may change independently.
- Do not expose variants as raw JSON, require users to paste product or variant IDs for normal tasks, or compress the editor into an unreadable mega-table.

### Technical LTR Islands

- Keep the page and component direction RTL. Wrap technical values in `<bdi dir="ltr">` or a narrowly scoped `dir="ltr"` element.
- Apply LTR treatment to UUIDs, emails, SKUs, slugs, request IDs, action keys, decimal amounts, and currency codes—not to the entire containing row.
- Technical islands use the technical font token and tabular numerals. Preserve logical start/end alignment in surrounding RTL layouts.

## Do's and Don'ts

### Do:

- **Do** begin every screen with a clear Persian page title, a useful description, and only the actions relevant at that level.
- **Do** use semantic theme tokens so the accent and neutral character can be changed centrally.
- **Do** favor familiar merchant vocabulary and show current values before asking for a change.
- **Do** keep price optional, display its currency, and distinguish “no price” from zero.
- **Do** adapt desktop tables into intentionally composed mobile cards with equivalent information and actions.
- **Do** preserve keyboard operation, visible focus, semantic headings, labels, live feedback, and WCAG 2.2 AA contrast.
- **Do** confirm destructive, publication, staff-access, and other consequential state changes with plain-language consequences.
- **Do** test RTL layout with long Persian copy and LTR identifiers together, including 320px, 768px, 1024px, and wide desktop widths.

### Don't:

- **Don't** copy Shopify branding, exact layouts, illustrations, or decorative styling; borrow only proven commerce interaction familiarity.
- **Don't** show JSON editors, raw API errors, HTTP codes, stack traces, database terms, or required UUID entry in ordinary merchant workflows.
- **Don't** use page-local hex values, gradients, decorative color, or heavy shadows to create hierarchy.
- **Don't** place unrelated edits behind one global save, silently discard changes, or rely on ambiguous icon-only actions.
- **Don't** use a horizontally scrolling desktop table as the finished mobile experience.
- **Don't** reverse the entire interface to LTR because one field contains Latin text, and don't allow identifiers to break Persian reading order.
- **Don't** over-card the interface, nest outlined containers repeatedly, or add dashboard metrics that are not backed by real commerce data.
- **Don't** animate for spectacle. Honor reduced motion and keep transitions brief, purposeful, and interruptible.
