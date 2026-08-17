# Verification checklist

Manual acceptance pass for Sankey Builder. Run in a real browser — open
`index.html` directly (`file://`, double-click) for the file:// items; a
static server works fine for the rest.

This list covers only what automation cannot see: rendered visuals, live OS
theme changes, `file://` origin/storage behavior, and pointer-drag feel.
Everything else from the original checklist — node/link editing, cycle and
value validation, color modes, alignment, palette switching, manual color
overrides, and reload persistence — was verified once by a full scripted
acceptance pass at migration time; a subset of it (validation messages,
persistence hydration, color resolution, render guards, and the
boot/invalid-edit/recovery/storage-notice flows) is continuously asserted by
the automated suite (`make test`), but the rest (e.g. alignment, delete
cascades, dropdown propagation) is not — don't assume `make test` covers it.

## Theme

- [ ] On Auto theme, the page visually matches the OS light/dark preference.
- [ ] With Auto selected, flipping the OS light/dark preference updates the page live, without reload.
- [ ] In dark mode, error text and the node/link delete buttons render legibly — no low-contrast red-on-dark.
- [ ] Native form controls (selects, the manual-mode color inputs) render dark chrome in dark mode and light chrome in light mode, matching the theme.

## Cold start / file:// load

- [ ] Double-click `index.html` from disk (`file://`) with no prior localStorage entry → the default diagram renders, with zero errors or warnings in the browser console.
- [ ] With a prior localStorage entry already saved (e.g. from a previous `file://` session in the same browser profile), double-clicking `index.html` again restores that state with zero console errors.

## Layout feel

- [ ] Dragging the divider between the editor column and the diagram resizes the column smoothly within its 240–640px bounds and reflows the diagram live.

## Link value paste truncation (cross-engine)

The 4-decimal cap is enforced at `beforeinput`, which reads the pasted text
from the event's `data`. Some engines deliver paste with `data: null` (payload
lives in `dataTransfer` instead), in which case truncation can't run and the
edit silently degrades to the aria-invalid highlight — still safe, just not
truncated. This can't be automated (happy-dom doesn't run the native editing
pipeline), so verify per engine which behavior actually occurs.

- [ ] Chrome: paste `1.23456789` into a link value → field truncates to `1.2345` and the diagram updates.
- [ ] Safari: paste `1.23456789` → note whether it truncates to `1.2345` or falls back to the red aria-invalid highlight (some WebKit builds send paste `beforeinput` with null `data`).
- [ ] Firefox: paste `1.23456789` → same check as Safari; record truncate vs. highlight.
- [ ] Drag-and-drop text (e.g. drag `1.23456789` from another field) into a link value → truncates in engines that send `insertFromDrop` with `data`, otherwise highlights. Verify it's never worse than the highlight.
- [ ] Mobile IME keyboard: typing digits that arrive via `insertCompositionText` bypasses the keystroke block — confirm over-precise input lands on the aria-invalid highlight (acceptable) rather than reaching state as bad geometry.
