# Design System Document

## 1. Overview & Creative North Star: "The Digital Ledger Editorial"

This design system transcends the "utility app" aesthetic to create a premium, editorial-grade financial experience. Moving away from cluttered grids and standard list views, we adopt the **Creative North Star: The Digital Ledger Editorial.**

The system treats every transaction and financial summary as a piece of high-end content. Inspired by the Apple Store’s spatial philosophy, we use **intentional asymmetry**, massive typographic scales, and **tonal layering** instead of structural lines. By prioritizing white space as a functional element rather than a void, we achieve a "breathing" interface that feels expensive, authoritative, and calm.

---

## 2. Colors: High-Contrast Monochromatics

The palette is strictly controlled to ensure a sophisticated, focused environment. We use tonal shifts to guide the eye rather than decorative colors.

### The Palette
- **Primary (`#000000`):** Used for "Hero" typography and primary actions. It represents authority.
- **Surface (`#f9f9fb`):** Our standard canvas. It is a "warm" white that reduces eye strain compared to pure `#FFFFFF`.
- **Surface-Container-Lowest (`#ffffff`):** Reserved for elevated "Hero Cards" or floating elements.
- **Surface-Container-Highest (`#e2e2e4`):** Used for subtle grouping and deep-background recessed areas.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders (`#CCCCCC` or similar) to separate sections. 
*   **How to separate:** Use a background shift from `surface` to `surface-container-low`.
*   **The Goal:** Content should feel like it is resting on a continuous plane, not trapped in boxes.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of fine paper:
1.  **Base Layer:** `surface` (`#f9f9fb`)
2.  **Sectional Layer:** `surface-container-low` (`#f3f3f5`) to define broad areas (e.g., a monthly summary block).
3.  **Action Layer:** `surface-container-lowest` (`#ffffff`) for the actual interactive cards.

---

## 3. Typography: Editorial Authority

Typography is the primary "graphic" element of this system. We use the **Inter** family (mimicking San Francisco) to provide a clean, neo-grotesque look.

*   **Display-LG (3.5rem / Bold):** Used for massive, single-number displays (e.g., total monthly balance). It should feel like a headline in a fashion magazine.
*   **Headline-LG (2rem / Semi-Bold):** Used for page titles. Always left-aligned with significant bottom margin (`spacing-8`).
*   **Title-MD (1.125rem / Medium):** For category headers in lists.
*   **Body-MD (0.875rem / Regular):** For transaction descriptions and secondary data.
*   **Label-SM (0.6875rem / Bold / All-Caps):** Used sparingly for metadata like "PENDING" or "TAX-DEDUCTIBLE" to provide a technical, high-end feel.

**Visual Hierarchy Tip:** Always pair a `Display-LG` number with a `Label-MD` descriptor to create a clear "High-Low" typographic contrast.

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows are replaced by **Ambient Depth**. We create hierarchy through light and blur, not dark outlines.

*   **The Layering Principle:** To lift a card, do not add a heavy shadow. Instead, place a `#ffffff` (Lowest) card on a `#f3f3f5` (Low) background.
*   **Ambient Shadows:** For floating action buttons or modal sheets, use:
    *   `Color: rgba(0, 0, 0, 0.04)`
    *   `Blur: 40px`
    *   `Spread: 0px`
    *   This mimics natural gallery lighting.
*   **Glassmorphism (The "Blur" Rule):** For top navigation bars or sticky summary headers, use a semi-transparent `surface` color with a `backdrop-filter: blur(20px)`. This keeps the user grounded in the scrollable content below.
*   **The "Ghost Border":** If a card is on a white background, use `outline-variant` at **10% opacity** as a hair-line container.

---

## 5. Components

### Cards & Lists
*   **Rule:** Forbid divider lines between list items.
*   **Implementation:** Use `spacing-3` (1rem) of vertical white space between transaction items. Group daily transactions onto a single `surface-container-lowest` card with a `roundedness-xl` (1.5rem) corner.

### Buttons
*   **Primary:** Solid `primary` (`#000000`) with `on-primary` (`#e2e2e2`) text. `roundedness-full`. 
*   **Secondary:** `surface-container-high` background with `on-surface` text. No border.
*   **Interaction:** On press, scale the button down to 0.96x to simulate a physical "click" into the screen.

### Input Fields
*   **Minimalist Entry:** No "box" for inputs. Use a single bold `headline-sm` font for the value being typed, with a `label-sm` floating above it. 
*   **Focus State:** The label transitions from `secondary` to `primary` color. No bottom line change.

### The "Pulse" Chip
*   **Usage:** For indicating live sync or "Today's" status. 
*   **Style:** A small, soft-grey (`surface-container-highest`) pill with a tiny 4px black dot.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace Asymmetry:** It’s okay to have a large balance on the left and empty space on the right. It feels intentional and "designed."
*   **Use Spacing as a Tool:** Use `spacing-16` (5.5rem) to separate major functional blocks.
*   **Respect the Corner Radius:** Stick strictly to `xl` (1.5rem/24px) for large containers and `md` (0.75rem/12px) for interactive elements.

### Don't:
*   **Don't use pure grey for text:** Use `on-surface-variant` (`#474747`) for a rich, deep charcoal that feels more premium than flat grey.
*   **Don't use icons for everything:** Sometimes a bold, well-kerned word is more effective and cleaner than a generic icon.
*   **Don't use standard WeChat "Green/Red" for finance:** Use `primary` (Black) for positive and `error` (`#ba1a1a`) for negative, but keep the red sophisticated and muted.

---

## 7. Signature Detail: The "Deep Scroll"
As the user scrolls, the total balance in the header should shrink and fade into a `title-sm` inside a glassmorphic top bar. This transition must be fluid, rewarding the user with a sense of "tactile" software.