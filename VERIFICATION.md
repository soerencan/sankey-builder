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
