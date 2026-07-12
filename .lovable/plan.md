## Plan: Make startup card hover clearly visible in `/startups/grid`

### Confirmation before editing
- Confirm `src/routes/_authenticated/startups.index.tsx` renders the grid branch with `StartupCard`.
- Confirm `StartupCard` renders the outer clickable wrapper as the actual `<button>` when `onClick` is provided in grid mode.

### File scope
Only modify:
- `src/components/startups/startup-card.tsx`

No backend, database, migrations, RLS, grants, server functions, tenant routing, ownership, audit, lineage, API Gateway, Database Router, Physical Multi-Database architecture, or persistence code changes.

### Implementation
1. Add explicit local React state inside `StartupCard`:
   - `isHovered`
   - `isPressed`

2. Attach handlers directly to the outermost clickable card wrapper:
   - `onMouseEnter`
   - `onMouseLeave`
   - `onMouseDown`
   - `onMouseUp`
   - `onFocus`
   - `onBlur`

3. Apply inline styles directly on the root clickable wrapper.

   Hover state:
   - `backgroundColor: "#E0F2FE"`
   - `borderColor: "#0284C7"`
   - `boxShadow: "0 0 0 6px #0284C7, 0 0 0 10px rgba(14,165,233,0.22), 0 18px 36px rgba(14,165,233,0.35)"`

   Pressed state:
   - `borderColor: "#1D4ED8"`
   - `boxShadow: "0 0 0 6px #1D4ED8, 0 18px 36px rgba(29,78,216,0.35)"`

   Default state:
   - no inline override, preserving the existing class-based default card styling.

4. Remove `overflow-hidden` from the root card class so the outer glow/ring is not clipped.

5. Keep image clipping on the image banner container only, so images still respect the card shape.

6. Remove the previous internal hover/tint overlay divs to avoid z-index, clipping, and opacity issues.

7. Preserve existing behavior:
   - `onClick={onClick}` still opens the startup detail modal
   - no card dimension changes
   - no neighboring card movement
   - no grid layout shift
   - split view, filters, and pagination untouched

### Debug verification before final styling
1. Temporarily apply an extreme hover style:
   - bright red background
   - 8px bright blue ring
   - strong glow
2. Verify in `/startups` grid that the hovered card visibly changes.
3. If the extreme style does not appear, stop and inspect whether the wrong component or wrapper is being edited.
4. After confirming the correct wrapper, tune back to the approved light-blue/dark-blue style.

### Final screenshot proof
Save these files to `/mnt/documents/`:
- `startup-card-hover-default.png` — default state
- `startup-card-hover-active.png` — mouse hovering over one card
- `startup-card-hover-pressed.png` — mouse down / pressed state

Surface the screenshots with `<presentation-artifact>` tags.

### Completion checks
Before marking complete, verify:
- hovered card is clearly distinguishable from neighboring cards
- light-blue background is visible
- blue outer ring/glow is visible around the full card, including image cards
- pressed state turns dark blue
- card size does not change
- neighboring cards do not shift
- clicking still opens the startup detail modal
- no backend, migration, Supabase, server function, or direct database-call changes were made