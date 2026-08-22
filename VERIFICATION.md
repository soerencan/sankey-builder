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
persistence hydration, color resolution, render guards, the alignment
toggle group's wiring, and the boot/invalid-edit/recovery/storage-notice
flows) is continuously asserted by the automated suite (`make test`), but
the rest (e.g. delete cascades, dropdown propagation, and the actual visual
layout effect of each alignment mode) is not — don't assume `make test`
covers it.

## Theme

- [ ] The app-header theme button and selector show the current mode's icon/label (System, Light, or Dark) and stay in sync after each choice.
- [ ] On System (Auto), the page visually matches the OS light/dark preference — the mechanism (no `data-theme` attribute, `prefers-color-scheme` media query) is unchanged by this move.
- [ ] With System selected, flipping the OS light/dark preference updates the page live, without reload.
- [ ] In dark mode, error text and the node/link delete buttons render legibly — no low-contrast red-on-dark.
- [ ] Native form controls (selects) render dark chrome in dark mode and light chrome in light mode, matching the theme.
- [ ] The app header (title plus theme button) stays on one line at 360px, with no wrapping or clipping.
- [ ] At wide widths, the theme selector opens as a compact surface anchored beneath the top-right theme button and remains wholly within the viewport.
- [ ] At 360px and 390px, the theme selector opens as a bottom sheet (full width, flush to the bottom edge, rounded top corners only) with comfortably tappable System, Light, and Dark choices.
- [ ] The theme selector supports keyboard and touch operation: Tab/Shift+Tab reach every choice, Enter/Space activates the focused choice, touch does not depend on hover, and Escape closes it.
- [ ] After the theme selector closes through a choice, Escape, backdrop click, or its Close control, focus visibly returns to the app-header theme button.

## Cold start / file:// load

- [ ] Double-click `index.html` from disk (`file://`) with no prior localStorage entry → the default diagram renders, with zero errors or warnings in the browser console.
- [ ] With a prior localStorage entry already saved (e.g. from a previous `file://` session in the same browser profile), double-clicking `index.html` again restores that state with zero console errors.

## Layout feel

- [ ] At wide widths, the diagram panel appears first and spans the available content width; the Data card follows below at the same width.
- [ ] The actual DOM, visual, screen-reader, and keyboard order all agree: app header → diagram → Data header/actions → Nodes → Links.
- [ ] The page contains one visually coherent **Data** card with distinct Nodes and Links sections; there are no separate input cards, detached file-actions area, empty leftover box, or stray gap.
- [ ] When the Data card is sufficiently wide, Nodes and Links render side by side with balanced usable space; resizing through the Data-card container-query breakpoint stacks them cleanly as Nodes then Links.
- [ ] The Data header contains Import and Export JSON controls, and both remain visually and semantically associated with the data editor at wide and narrow widths.
- [ ] The Data header actions do not collide with or wrap the Data title into an awkward multi-line header at 360px, 390px, or 768px.
- [ ] There is no divider/resizer, saved editor-width behavior, sticky diagram, translucent content underlay, or large compensating top scroll padding.
- [ ] Scrolling is ordinary document scrolling: the diagram moves out of view naturally before the Data sections, without jumps or content passing beneath it.

## Responsive

Media/container queries do no real layout under happy-dom, so none of this is
automated — verify in a real browser (resize the window and use device
emulation).

- [ ] At desktop widths (for example 1440px and 1024px), the diagram remains first at full content width, with no legacy two-column editor/diagram split or unused gutter.
- [ ] At 768px, 390px, and 360px, the same diagram-first DOM order is preserved; only controls and the Data card's internal Nodes/Links layout adapt.
- [ ] Across the Data-card container-query breakpoint, Nodes and Links switch exactly once between side-by-side and stacked layouts, with no intermediate collision, overlap, or awkward sliver column.
- [ ] No horizontal scrollbar at 360px, 390px, and 768px widths.
- [ ] With an EMPTY diagram (delete all links at phone width), the diagram box collapses to an appropriate placeholder rather than leaving an excessive blank block; the toolbar and Data card remain usable.
- [ ] At phone width, Tab through the entire page and confirm focused controls scroll into view normally, with no sticky overlay obscuring them and no unexpected scroll jump.
- [ ] Narrow the Data card until a link row wraps to two lines (source/target on top; handle, value, delete below with the handle leftmost). The wrap responds to the containing card/section width rather than an unrelated viewport breakpoint.
- [ ] Tab order through a wrapped link row is still handle → source → target → value → delete.
- [ ] On a real phone (coarse pointer): buttons, the drag handles, selects, and inputs are comfortably tappable (~44px), with slightly larger row spacing.
- [ ] In dark mode, the diagram and Data surfaces match cleanly with no light seams or content visible through margins.
- [ ] Edit node names, link endpoints/values, order, palette, link color, and alignment while the Data card is both side-by-side and stacked; every valid change updates the full-width diagram immediately without changing page order or causing overflow.

## Diagram toolbar

- [ ] The toolbar renders as its own header bar above the diagram, on a visually distinct row — it never floats over or obscures the SVG at any width.
- [ ] The palette carousel's swatches (both the preview button and the dialog's rows) visually match the actual rendered node colors in the diagram, in both light and dark theme.
- [ ] With the palette dialog open, pressing Escape closes it (native `<dialog>` cancel behavior — not exercised by the automated suite, since happy-dom doesn't simulate a real Escape-triggered cancel).
- [ ] After closing the palette dialog (Escape, Close button, or backdrop click), focus visibly returns to the palette preview button — a visible focus ring lands there, not somewhere else on the page.
- [ ] The four link-color pictograms (Source, Source to target, Target, Neutral — both the Links button and the dialog rows) are visually distinguishable from each other in both light and dark theme, without relying on hover or a tooltip.
- [ ] At wide widths, the toolbar (palette carousel, Links button, alignment group, and one Export diagram control) stays on a single line — no wrapping, clipping, or overlap.
- [ ] The wide toolbar contains one Export diagram control rather than separate SVG/PNG buttons; opening it presents clearly labelled SVG and PNG actions.
- [ ] Opening and closing the Export diagram surface does not resize or obscure the diagram, and focus returns visibly to the Export diagram control after a selection, Escape, backdrop click, or Close.
- [ ] The Export diagram control and both format choices work with keyboard and touch input; the menu/surface never relies on hover-only affordances.
- [ ] The alignment group's pressed button (fill plus inset ring) is distinguishable from its unpressed neighbors without relying on color alone, in both light and dark theme.
- [ ] Tabbing through the alignment group shows a complete, unclipped focus ring on each button, including the ones between two pressed-looking neighbors — the shared inner borders never cut off part of the ring.
- [ ] Changing alignment visibly changes how nodes are packed within their columns (left/center/right/justify) — this behavioral effect isn't asserted by `make test`, only the button wiring is.

## Diagram toolbar — narrow mode

The wide/narrow swap is a container query on `.diagram-panel` itself
(`@container diagram-panel (max-width: 680px)` in style.css's "Diagram
toolbar" section), not a viewport media query. happy-dom doesn't evaluate
container queries, so none of this is automated.

- [ ] Resize the browser through the diagram toolbar's container-query breakpoint: the wide Links button + alignment group + Export diagram control and the narrow Diagram button swap cleanly at one width, with no point where controls clip, overlap, or wrap onto a second line.
- [ ] If the swap happens too early or too late relative to where the wide row actually stops fitting, tune the 680px value in style.css rather than filing it as a bug.
- [ ] No horizontal scrollbar appears at 360px, 390px, or 768px viewport widths with the narrow toolbar showing.
- [ ] At 360px, 390px, and 768px, whichever toolbar representation the diagram container selects remains exactly one line tall; no control wraps, overlaps, clips, or forces horizontal page overflow.
- [ ] On a small/phone viewport, tapping Diagram opens it as a bottom sheet (full width, flush to the bottom edge, rounded top corners only) rather than a small centered card; on a wider narrow panel it may use the appropriate compact dialog treatment.
- [ ] The Diagram sheet contains all narrow-mode diagram actions: labelled Link color choices, labelled Alignment choices, and clearly labelled SVG and PNG export actions.
- [ ] Choosing a link color or alignment option inside the Diagram sheet updates the diagram immediately, WITHOUT closing the sheet — repeated taps across both groups keep it open so several changes can be made in one visit.
- [ ] Choosing SVG or PNG from the Diagram sheet performs the requested download and leaves any resulting success/error feedback visible after the sheet closes.
- [ ] The diagram panel's rendered height does not change while the Diagram sheet is open (the sheet is a top-layer overlay, not part of panel layout).
- [ ] With the Diagram sheet open, pressing Escape closes it; Tab/Shift+Tab reach every interactive choice, Enter/Space activates controls, and all rows/buttons remain comfortable touch targets (~44px).
- [ ] After closing the Diagram sheet (format choice, Close button, backdrop click, or Escape), focus visibly returns to the Diagram button.
- [ ] Link color and alignment choices made in the Diagram sheet stay in sync with the wide toolbar's Links button/alignment group when the layout swaps back to wide (e.g. widen the window after choosing Neutral in Diagram) — both copies reflect the same state.
- [ ] Coarse-pointer targets (both toolbar buttons and the Diagram sheet's option rows) are comfortably tappable (~44px) on a real touch device.

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

- [ ] The Data card header contains Import and Export JSON only; the diagram toolbar/sheet contains SVG and PNG only, keeping data-file and rendered-diagram actions in their respective contexts.
- [ ] Export (served): click Export JSON in the Data header → the browser downloads `sankey.json`; opening it shows a pretty-printed `{nodes, links, settings}` with no `theme` key and no incomplete links.
- [ ] Import (served): click Import in the Data header → the native file picker opens; choosing a previously exported file replaces the diagram, editors, and controls, and the theme in use does not change.
- [ ] Import repairs: hand-edit an exported file to introduce an unknown palette and a dangling link endpoint, then import → the diagram loads and the notice lists the adjustments made.
- [ ] Legacy manual-color import: hand-edit an exported file to add `"colorMode": "manual"` and hex `color` values on the nodes, then import → the diagram loads using the file's named palette, the per-node colors are ignored, and the notice mentions manual colors are no longer supported.
- [ ] Import rejection: pick an unrelated `.json` file → the diagram is left untouched and the notice says it doesn't look like a diagram export.
- [ ] Import a topologically-invalid file (e.g. a cycle A→B→A): state is replaced and saved, `#error` shows the cycle message, the previous diagram stays rendered (refresh bails before re-render on an invalid graph), and `#io-notice` still reports the import — confirm that three-way combination reads acceptably rather than confusingly.
- [ ] `file://` export: double-click `index.html` from disk, click Export JSON in the Data header → the download still lands in Downloads (no console errors about blob URLs or the object-URL lifecycle).
- [ ] `file://` import: from the same `file://` page, use Import in the Data header and choose a file → the diagram updates with zero console errors.
- [ ] Export SVG: use Export diagram → SVG on a wide layout and Diagram → SVG on a narrow layout → `sankey.svg` downloads and opens standalone in a browser with an opaque background and legible node labels matching the current theme's colors (light theme → light background with dark labels; dark theme → dark background with light labels — each theme's own text color).
- [ ] Export SVG on an empty diagram (delete all links first): clicking Export SVG downloads nothing; `#io-notice` shows "Nothing to export — the diagram is empty."
- [ ] Export PNG: use Export diagram → PNG on a wide layout and Diagram → PNG on a narrow layout → `sankey.png` downloads at 1920x960 with an opaque background and legible node labels matching the current theme's colors — check both light and dark theme, and both link color modes (single color and source→target gradient, which must rasterize as a real gradient, not a solid fallback).
- [ ] Export PNG on an empty diagram (delete all links first): clicking Export PNG downloads nothing; `#io-notice` shows "Nothing to export — the diagram is empty."
- [ ] `file://` PNG export: double-click `index.html` from disk, click Export PNG → the download still lands in Downloads (no console errors about blob URLs, canvas tainting, or the object-URL lifecycle).
- [ ] Safari PNG export specifically: repeat the above (served and `file://`) in Safari — canvas + SVG rasterization (drawImage of an svg: URL, toBlob) is the part most likely to diverge from Chrome/Firefox; confirm the PNG downloads and its colors/dimensions match.
- [ ] Feedback from both contexts appears in the shared status toast: import/JSON notices and SVG/PNG success or empty-diagram errors remain visible after menus/sheets close and do not cause overlap or horizontal overflow at 360px or 390px.
