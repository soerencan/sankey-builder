# Verification checklist

Manual acceptance pass for Sankey Builder. Run in a real browser, served
either via `make dev` (Bun's dev server) or a static host serving a `make
build` output (`dist/`) — the app loads as an ES module, which requires an
HTTP(S) origin; `file://` is not supported.

GitHub Pages serves this project from a `/sankey-builder/` subpath, so it's
worth spot-checking `dist/` under one too (`tests/build/dist.test.ts` already
asserts asset URLs are relative, but a real browser catches anything that
test misses):

```
rm -rf /tmp/pages-check
make build
mkdir -p /tmp/pages-check/sankey-builder && cp -r dist/* /tmp/pages-check/sankey-builder/
python3 -m http.server 8000 --directory /tmp/pages-check
```

Then open `http://localhost:8000/sankey-builder/` and confirm the app loads
and renders with no console errors about failed asset requests.

This list covers only what `make test` cannot see: rendered visuals (real
layout, media/container queries), live OS theme changes, pointer/touch drag
feel, native `<dialog>` cancel/backdrop behavior, and cross-engine paste
behavior. Node/link editing, cycle and value validation, import/export
parsing and repair, persistence, and every control's click-driven wiring are
continuously asserted by the automated suite (`make test`) and are not
repeated here.

## Cold start / served load

- [ ] Load the app fresh (no prior localStorage entry) and again with a prior entry already saved: zero console errors or warnings in either case (happy-dom doesn't surface console output the way a real browser does).

## Theme

- [ ] On System (Auto), the page visually matches the OS light/dark preference, and flipping the OS preference updates the page live, without reload.
- [ ] In dark mode, error text and the node/link delete buttons render legibly — no low-contrast red-on-dark.
- [ ] Native form controls (selects) render dark chrome in dark mode and light chrome in light mode, matching the theme.
- [ ] The app header (title plus theme button) stays on one line at 360px, with no wrapping or clipping.
- [ ] At wide widths, the theme selector opens as a compact surface anchored beneath the top-right theme button and remains wholly within the viewport.
- [ ] At 360px and 390px, the theme selector opens as a bottom sheet (full width, flush to the bottom edge, rounded top corners only) with comfortably tappable System, Light, and Dark choices.
- [ ] Tab/Shift+Tab reach every choice in the theme selector, and touch operation does not depend on hover.
- [ ] With the theme selector open, pressing Escape or clicking the backdrop closes it (native `<dialog>` behavior, not exercised by the automated suite) and focus visibly returns to the theme button.

## Layout feel

- [ ] At wide widths, the diagram panel appears first and spans the available content width; the Data card follows below at the same width.
- [ ] The actual DOM, visual, screen-reader, and keyboard order all agree: app header → diagram → Data header/actions → Nodes → Links → footer.
- [ ] When the Data card is sufficiently wide, Nodes and Links render side by side with balanced usable space; resizing through the Data-card container-query breakpoint stacks them cleanly as Nodes then Links.
- [ ] The Data header actions do not collide with or wrap the Data title into an awkward multi-line header at 360px, 390px, or 768px.
- [ ] Scrolling is ordinary document scrolling: the diagram moves out of view naturally before the Data sections, without jumps or content passing beneath it.
- [ ] The footer (Source on GitHub, MIT License, Third-party licenses) sits below the Data card as one centered line at wide widths and wraps to further lines at 360px rather than overflowing; its links stay legible in both themes and are comfortably tappable on a coarse pointer.
- [ ] Against a served `dist/`, the Third-party licenses link opens the generated page, which renders in the current OS color scheme, lists every bundled package with its license text, and links back to the app.

## Responsive

Media/container queries do no real layout under happy-dom, so none of this is
automated — verify in a real browser (resize the window and use device
emulation).

- [ ] At desktop widths (for example 1440px and 1024px), the diagram remains first at full content width.
- [ ] At 768px, 390px, and 360px, the same diagram-first DOM order is preserved; only controls and the Data card's internal Nodes/Links layout adapt.
- [ ] Across the Data-card container-query breakpoint, Nodes and Links switch exactly once between side-by-side and stacked layouts, with no intermediate collision, overlap, or awkward sliver column.
- [ ] No horizontal scrollbar at 360px, 390px, and 768px widths.
- [ ] With an EMPTY diagram (delete all links at phone width), the diagram box collapses to an appropriate placeholder rather than leaving an excessive blank block; the toolbar and Data card remain usable.
- [ ] At phone width, Tab through the entire page and confirm focused controls scroll into view normally, with no unexpected scroll jump.
- [ ] Narrow the Data card until a link row wraps to two lines (source/target on top; handle, value, delete below with the handle leftmost). The wrap responds to the containing card/section width rather than an unrelated viewport breakpoint.
- [ ] On a real phone (coarse pointer): buttons, the drag handles, selects, and inputs are comfortably tappable (~44px), with slightly larger row spacing.
- [ ] In dark mode, the diagram and Data surfaces match cleanly with no light seams or content visible through margins.

## Diagram toolbar

- [ ] The toolbar renders as its own header bar above the diagram, on a visually distinct row — it never floats over or obscures the SVG at any width.
- [ ] The palette carousel's swatches (both the preview button and the dialog's rows) visually match the actual rendered node colors in the diagram, in both light and dark theme.
- [ ] With the palette dialog open, pressing Escape closes it (native `<dialog>` cancel behavior, not exercised by the automated suite), and focus visibly returns to the palette preview button.
- [ ] The four link-color pictograms (Source, Source to target, Target, Neutral) are visually distinguishable from each other in both light and dark theme, without relying on hover or a tooltip.
- [ ] At wide widths, the toolbar (palette carousel, Links button, alignment group, and one Export diagram control) stays on a single line — no wrapping, clipping, or overlap.
- [ ] Opening and closing the Export diagram dialog does not resize or obscure the diagram, and focus visibly returns to the Export diagram control after a selection, Escape, or backdrop click.
- [ ] The alignment group's pressed button (fill plus inset ring) is distinguishable from its unpressed neighbors without relying on color alone, in both light and dark theme.
- [ ] Tabbing through the alignment group shows a complete, unclipped focus ring on each button, including the ones between two pressed-looking neighbors — the shared inner borders never cut off part of the ring.
- [ ] Changing alignment visibly changes how nodes are packed within their columns (left/center/right/justify).

## Diagram toolbar — narrow mode

The wide/narrow swap is a container query on `.diagram-panel` itself
(`@container diagram-panel (max-width: 820px)` in style.css's "Diagram
toolbar" section), not a viewport media query. happy-dom doesn't evaluate
container queries, so none of this is automated.

- [ ] Resize the browser through the diagram toolbar's container-query breakpoint: the wide Links button + alignment group + Export diagram control and the narrow Diagram button swap cleanly at one width, with no point where controls clip, overlap, or wrap onto a second line.
- [ ] If the swap happens too early or too late relative to where the wide row actually stops fitting, tune the 820px value in style.css rather than filing it as a bug.
- [ ] No horizontal scrollbar appears at 360px, 390px, or 768px viewport widths with the narrow toolbar showing.
- [ ] On a small/phone viewport, tapping Diagram opens it as a bottom sheet (full width, flush to the bottom edge, rounded top corners only) rather than a small centered card.
- [ ] The diagram panel's rendered height does not change while the Diagram sheet is open (the sheet is a top-layer overlay, not part of panel layout).
- [ ] With the Diagram sheet open, pressing Escape closes it (native `<dialog>` behavior, not exercised by the automated suite); all rows/buttons remain comfortable touch targets (~44px).
- [ ] After closing the Diagram sheet (export, header Close button, backdrop click, or Escape), focus visibly returns to the Diagram button.
- [ ] Coarse-pointer targets (both toolbar buttons and the Diagram sheet's option rows) are comfortably tappable (~44px) on a real touch device.

## Row reordering (drag feel)

Reordering is driven by SortableJS (`forceFallback` mode — a synthetic drag
on every platform, not native HTML5 DnD). The keyboard path and the Sortable
wiring itself (instance options, cross-box group separation, the `onEnd`
commit) are automated; the actual drag *feel* is not.

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

The parse/serialize logic and the DOM wiring are automated (unit +
integration), but the real browser download dialog, native file picker, and
canvas rasterization aren't reachable from happy-dom — verify those against a
served app (`make dev` or a served `dist/`).

- [ ] Export: click Export JSON in the Data header → the download lands in Downloads as `sankey.json` with no console errors about blob URLs or the object-URL lifecycle.
- [ ] Import: click Import in the Data header → the native file picker opens; choosing a previously exported file replaces the diagram, editors, and controls with zero console errors.
- [ ] Export SVG: use Export diagram → SVG on a wide layout and Diagram → SVG on a narrow layout → `sankey.svg` downloads and opens standalone in a browser with an opaque background and legible node labels matching the current theme's colors (light theme → light background with dark labels; dark theme → dark background with light labels).
- [ ] Export PNG: use Export diagram → PNG on a wide layout and Diagram → PNG on a narrow layout → `sankey.png` downloads at 1920x960 with an opaque background and legible node labels matching the current theme's colors, with no console errors about blob URLs, canvas tainting, or the object-URL lifecycle — check both light and dark theme, and both link color modes (single color and source→target gradient, which must rasterize as a real gradient, not a solid fallback).
- [ ] Safari PNG export specifically: repeat the above in Safari — canvas + SVG rasterization (drawImage of an svg: URL, toBlob) is the part most likely to diverge from Chrome/Firefox; confirm the PNG downloads and its colors/dimensions match.
- [ ] Feedback in the consolidated notice region does not cause overlap or horizontal overflow at 360px or 390px.
- [ ] With a screen reader running, confirm the `aria-live="polite"` notice region announces restrainedly: typing an invalid link value repeatedly does not trigger a root announcement (it's an inline field error, not a root notice), and an unrelated action (e.g. a settings change, or a second import) while a notice is already showing doesn't re-announce unchanged notice text.


## Shared choice panels

- [ ] Links, Export, Theme, Palette, and Aspect ratio use the same anchored desktop panel, transparent backdrop, header Close button, and viewport clamping/flipping. The workspace remains modal/inert until dismissal.
- [ ] Every panel becomes a bottom sheet at narrow viewport widths, with a gentle backdrop, safe-area padding, and internally scrolling content. Close stays visible.
- [ ] Selected list choices have a soft accent tint and decorative checkmark; keyboard focus has its own visible ring. Compact alignment buttons retain their segmented treatment.
- [ ] Clicking interior padding keeps a panel open; outside clicks, Escape, and header Close dismiss it and return focus. Resizing and scrolling reposition open desktop panels.
- [ ] Single-setting choices close their panel; the combined Diagram sheet stays open after settings changes and closes after export.
## Implementation verification — 2026-09-06

- Automated: lint, TypeScript, unit/integration suites, and production build smoke tests passed.
- Chromium: checked 1440, 1024, 768, 390, and 360px in light and dark themes. No horizontal overflow; every available panel remained in bounds and focused the selected choice or first export action.
- Checked native Escape and Tab/Shift+Tab, focus return, and resizing an open Theme panel from 1440 to 1024px.
- Touch emulation: verified coarse-pointer detection, 44px drag handles and value fields. Safe-area padding is implemented; physical-device inset and drag feel still require the checklist above.
- Downloaded real SVG and PNG files during browser verification. Export handlers are unchanged; the final implementation restores the original label rendering and export typography.
- Label sizing/fitting was explored and then explicitly deferred. A 72-node, six-stage graph reduced every label to an ellipsis at 360px; avoiding overlap alone did not preserve meaning. Revisit readable-scale navigation and labels in a dedicated follow-up.
- Safari, Firefox, physical touch dragging, and assistive-technology checks remain manual follow-ups; they were not run in this Chromium session.
