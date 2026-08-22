# Verification checklist

Manual acceptance pass for Sankey Builder. Run in a real browser — open
`index.html` directly (`file://`, double-click) for the file:// items; a
static server works fine for the rest.

This list covers only what automation cannot see: rendered visuals, live OS
theme changes, `file://` origin/storage behavior, and pointer-drag feel.
Everything else from the original checklist — node/link editing, cycle and
value validation, link color modes, alignment, palette switching, and
reload persistence — was verified once by a full scripted
acceptance pass at migration time; a subset of it (validation messages,
persistence hydration, color resolution, render guards, and the
boot/invalid-edit/recovery/storage-notice flows) is continuously asserted by
the automated suite (`make test`), but the rest (e.g. alignment, delete
cascades, dropdown propagation) is not — don't assume `make test` covers it.

## Theme

- [ ] On Auto theme, the page visually matches the OS light/dark preference.
- [ ] With Auto selected, flipping the OS light/dark preference updates the page live, without reload.
- [ ] In dark mode, error text and the node/link delete buttons render legibly — no low-contrast red-on-dark.
- [ ] Native form controls (selects) render dark chrome in dark mode and light chrome in light mode, matching the theme.

## Cold start / file:// load

- [ ] Double-click `index.html` from disk (`file://`) with no prior localStorage entry → the default diagram renders, with zero errors or warnings in the browser console.
- [ ] With a prior localStorage entry already saved (e.g. from a previous `file://` session in the same browser profile), double-clicking `index.html` again restores that state with zero console errors.

## Layout feel

- [ ] Dragging the divider between the editor column and the diagram resizes the column smoothly within its 240–640px bounds and reflows the diagram live.

## Responsive

Media/container queries do no real layout under happy-dom, so none of this is
automated — verify in a real browser (resize the window and use device
emulation).

- [ ] Above 820px: side-by-side layout with a working divider; the diagram hugs its own SVG height (no extra whitespace below it).
- [ ] Just below 820px: layout stacks to one column with the **diagram on top** and the editor column below; the divider is gone.
- [ ] While stacked, scrolling the editor content keeps the diagram pinned at the top (sticky), capped at ~45vh, with the SVG **letterboxed not cropped**, and editor rows do not show through the diagram's margins.
- [ ] No horizontal scrollbar at 360px, 390px, and 768px widths.
- [ ] Stacked with an EMPTY diagram (delete all links at phone width): the diagram box collapses to a small placeholder rather than an opaque ~480px block, and the editors below stay usable.
- [ ] Focus-under-sticky at phone width: Tab through the editor controls and confirm each focused field scrolls clear of the sticky diagram, never hidden behind it.
- [ ] On desktop, drag the column narrow (~240px): link rows wrap to two lines (source/target on top; handle, value, delete below with the handle leftmost). The same wrap appears purely from column width, independent of window width.
- [ ] Tab order through a wrapped link row is still handle → source → target → value → delete.
- [ ] On a real phone (coarse pointer): buttons, the drag handles, selects, and inputs are comfortably tappable (~44px), with slightly larger row spacing.
- [ ] Dark mode in the stacked layout: the sticky diagram's background matches the surface, no light seams.

## Row reordering (drag feel)

Reordering is driven by SortableJS (`vendor/sortable.min.js`, `forceFallback`
mode — a synthetic drag on every platform, not native HTML5 DnD). The
keyboard path (focus a handle, Arrow up/down) and the resulting state/DOM
changes are automated, as is the Sortable wiring itself (instance options,
cross-box group separation, the `onEnd` commit); the actual drag *feel* is
not — verify it in a real browser.

- [ ] Grab a node row by its ⠿ handle and drag (mouse): a floating clone of the row detaches and tracks the pointer/cursor exactly, with a raised shadow; the row's original slot in the list shows a dimmed placeholder that moves live as you drag over other rows, and the list around it animates (siblings slide) rather than jumping.
- [ ] Releasing the drag drops the row where the placeholder was, and the diagram/dropdowns update to the new order.
- [ ] Dragging a node row over the *link* box (or vice-versa) does nothing — no cross-box move; the floating clone snaps back to its box, no stray placeholder left behind.
- [ ] Starting a drag from a non-handle part of the row (e.g. the name field or a dropdown) does NOT initiate a reorder — text selection and normal control behavior are unaffected.
- [ ] Touch (real phone or touch emulation): a mouse drag starts immediately, but a touch drag requires a brief press-and-hold (~150ms) on the handle before it lifts — a quick tap doesn't start a drag. During that hold, wiggling the finger more than a few pixels cancels the pending drag rather than starting one, so a scroll gesture that begins on a row still scrolls the page instead of lifting it.
- [ ] Touch: once a drag has lifted, the row/handle text is never selected/highlighted during the gesture (no iOS text-selection callout).
- [ ] During any drag (mouse or touch), the rest of the page's text doesn't show selection highlighting even if the pointer strays off the handle mid-gesture.
- [ ] There's no Escape-to-cancel for a pointer/touch drag (keyboard-arrow moves are unaffected) — dropping outside any row, or releasing back at the row's origin, is the way to abandon a drag without reordering.

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

## Export / Import

The parse/serialize logic and the DOM wiring are automated (unit + smoke), but
the real browser download dialog and native file picker aren't reachable from
happy-dom — verify those, and confirm they work under `file://` where storage
and origin behavior differ.

- [ ] Export (served): click Export JSON → the browser downloads `sankey.json`; opening it shows a pretty-printed `{nodes, links, settings}` with no `theme` key and no incomplete links.
- [ ] Import (served): click Import → the native file picker opens; choosing a previously exported file replaces the diagram, editors, and controls, and the theme in use does not change.
- [ ] Import repairs: hand-edit an exported file to introduce an unknown palette and a dangling link endpoint, then import → the diagram loads and the notice lists the adjustments made.
- [ ] Legacy manual-color import: hand-edit an exported file to add `"colorMode": "manual"` and hex `color` values on the nodes, then import → the diagram loads using the file's named palette, the per-node colors are ignored, and the notice mentions manual colors are no longer supported.
- [ ] Import rejection: pick an unrelated `.json` file → the diagram is left untouched and the notice says it doesn't look like a diagram export.
- [ ] Import a topologically-invalid file (e.g. a cycle A→B→A): state is replaced and saved, `#error` shows the cycle message, the previous diagram stays rendered (refresh bails before re-render on an invalid graph), and `#io-notice` still reports the import — confirm that three-way combination reads acceptably rather than confusingly.
- [ ] `file://` export: double-click `index.html` from disk, click Export JSON → the download still lands in Downloads (no console errors about blob URLs or the object-URL lifecycle).
- [ ] `file://` import: from the same `file://` page, import a file via the picker → the diagram updates with zero console errors.
- [ ] Export SVG: click Export SVG → `sankey.svg` downloads and opens standalone in a browser with an opaque background and legible node labels matching the current theme's colors (light theme → light background with dark labels; dark theme → dark background with light labels — each theme's own text color).
- [ ] Export SVG on an empty diagram (delete all links first): clicking Export SVG downloads nothing; `#io-notice` shows "Nothing to export — the diagram is empty."
- [ ] Export PNG: click Export PNG → `sankey.png` downloads at 1920x960 with an opaque background and legible node labels matching the current theme's colors — check both light and dark theme, and both link color modes (single color and source→target gradient, which must rasterize as a real gradient, not a solid fallback).
- [ ] Export PNG on an empty diagram (delete all links first): clicking Export PNG downloads nothing; `#io-notice` shows "Nothing to export — the diagram is empty."
- [ ] `file://` PNG export: double-click `index.html` from disk, click Export PNG → the download still lands in Downloads (no console errors about blob URLs, canvas tainting, or the object-URL lifecycle).
- [ ] Safari PNG export specifically: repeat the above (served and `file://`) in Safari — canvas + SVG rasterization (drawImage of an svg: URL, toBlob) is the part most likely to diverge from Chrome/Firefox; confirm the PNG downloads and its colors/dimensions match.
