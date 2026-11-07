# Browser verification

Use this checklist to check behavior that the happy-dom tests do not exercise: visual layout, native dialogs and file pickers, operating-system themes, touch gestures, editing events, and image rasterization. For application changes, run the automated checks as well; they cover graph edits, validation, persistence, import repair, control wiring, and lifecycle cleanup.

Run the sections relevant to the change. Record the revision, browser and version, operating system, viewport sizes, input method, and checks actually performed. Identify anything left untested.

## Setup and served load

Follow the README's [production preview instructions](README.md#preview-the-production-build). Use the built site for downloads, license notices, or deployment checks.

GitHub Pages serves the app under `/sankey-builder/`. To check the built site under that subpath:

```sh
preview_root=$(mktemp -d)
mkdir -p "$preview_root/sankey-builder"
cp -R dist/. "$preview_root/sankey-builder/"
python3 -m http.server 8000 --directory "$preview_root"
```

Open [localhost:8000/sankey-builder/](http://localhost:8000/sankey-builder/). The build tests check relative asset URLs; a browser run checks that those assets load and render together.

- [ ] Load with no saved state, then reload with saved state. Confirm the diagram renders without console errors, warnings, or failed asset requests.
- [ ] In the built site, open Third-party licenses from the footer. Confirm package notices are readable, follow the OS color scheme, and link back to the app under the same subpath.

## Layout and theme

Check wide layouts at 1440px and 1024px, and narrower layouts at 768px, 390px, and 360px. Include 320px when changing toolbar or icon sizing. Use both light and dark themes.

- [ ] The page order stays consistent visually, in the DOM, and for keyboard and screen-reader navigation: header and notices, diagram, Data actions, Nodes, Links, footer.
- [ ] The diagram panel spans the available content width above the Data card. Nodes and Links sit side by side in a wide Data card and stack in that order when it narrows. Check the container-query transition for overlap or unusably narrow columns.
- [ ] The header title, theme button, Data heading, and file actions remain legible without collisions. There is no horizontal page scrollbar.
- [ ] Narrow link rows stack source, target, value, and Delete vertically, with the drag handle beside the source. The layout follows the editor's width, and field errors remain readable.
- [ ] Scrolling follows normal document flow. Keyboard focus brings controls into view without unexpected jumps.
- [ ] With all links deleted, the empty preview retains the selected aspect ratio, and the toolbar and Data card remain usable.
- [ ] The footer stays below the Data card, wraps at narrow widths, and has legible links with comfortable touch targets.
- [ ] System theme follows OS light/dark changes without a reload. Explicit Light and Dark choices override the OS preference.
- [ ] Error text, delete buttons, focus rings, and native selects are legible in both themes. Diagram and Data surfaces have no unintended light seams.
- [ ] On a coarse pointer, buttons, handles, selects, and inputs have comfortable touch targets of at least 44px height.

## Panels and diagram controls

The four panels are Theme, Palette, Appearance, and Export diagram. Appearance contains native selects for Node alignment, Aspect ratio, and Link colors. These settings do not have separate panels.

- [ ] Palette navigation, Appearance, and Export remain visible without clipped icons. The toolbar can wrap at very narrow widths.
- [ ] On wide screens, panels anchor near their trigger and stay within the viewport. Open one, then scroll or resize to check repositioning.
- [ ] On narrow screens, panels become full-width bottom sheets with rounded top corners, a transparent backdrop, and scrollable content. Close remains reachable, and the page behind the panel cannot be used until dismissal.
- [ ] Opening Theme or Palette focuses the selected choice. Other panels focus their first control. Selected choices have a tint and checkmark distinct from the keyboard focus ring.
- [ ] Tab and Shift+Tab stay usable within each panel. Interior padding does not dismiss it; outside clicks, Escape, and Close dismiss it and visibly return focus to its trigger.
- [ ] Theme and palette choices close their panel. Appearance stays open while its selects update the diagram; the selections survive a reload. Node alignment changes horizontal placement where the graph permits, while preserving node order within each column.
- [ ] Export diagram presents SVG and PNG at every screen size. Choosing a format closes the panel and restores focus, including with an empty diagram.
- [ ] On wide layouts, use the preview's smaller/larger buttons, drag its horizontal handle, and try Arrow Up, Arrow Down, Home, and End with that handle focused. The preview resizes smoothly without changing the exported dimensions. On narrow layouts, these controls hide and the preview fits the available width.

### Physical iPhone checks

- [ ] In Safari, open and close each sheet in portrait and landscape, with the browser controls expanded and collapsed. Page, sheet, and bottom edge share a continuous background, without a dimming flash or border seam.
- [ ] Sheet content clears the home indicator; long content scrolls and Close remains reachable. Tapping outside dismisses the sheet without activating controls behind it.
- [ ] Native selects remain usable and focusing them does not trigger unwanted page zoom.

## Row dragging

SortableJS uses a floating clone on all platforms (`forceFallback`). Tests cover keyboard reordering and drag callbacks; check the actual gesture and visual feedback here.

- [ ] Drag a node and a link by their vertical grip handles. The floating row follows the pointer, its original slot becomes a dimmed placeholder, and neighboring rows animate into position.
- [ ] Drop each row in a new position. Row order, diagram order, and endpoint choices update without a jump or a leftover clone. The clone shows the current input values and selected endpoints.
- [ ] Drag between the Nodes and Links lists. No row crosses into the other list, and no placeholder or clone remains afterward.
- [ ] Starting from a name field, value field, or select allows normal editing without initiating a drag.
- [ ] Mouse dragging starts immediately. On touch, a brief hold of about 150ms lifts the row; a quick tap does not. Movement during the hold cancels the pending lift so a scroll gesture starting on a row can scroll.
- [ ] During dragging, neither the row nor surrounding page text becomes selected. On iOS, no text-selection callout appears.
- [ ] Return the row to its original position and release to leave its order unchanged. Pointer/touch dragging has no Escape-to-cancel behavior.

## Link-value input across browsers

The editor allows four decimal places. It intercepts `beforeinput` to block extra typed digits and truncate pasted or dropped decimals. When an event does not expose its text through `data`, or composition input bypasses that interception, validation must still keep the invalid draft out of saved state and diagram geometry. Test native editing events, not only scripted input dispatches.

- [ ] In Chrome, Safari, and Firefox, paste `1.23456789` into an empty value field. Record whether it truncates to `1.2345` or shows an inline error. Truncated input updates the diagram; an invalid draft leaves the last committed value unchanged.
- [ ] Drop the same text into a value field. Check truncation or inline validation according to the browser's event behavior.
- [ ] With a mobile input method editor (IME), enter an over-precise value. Confirm validation catches any input that bypasses the keystroke limit.

## Import, export, and notices

Use the built site for native file-picker, download, and canvas checks. Run exports on wide and narrow layouts, in light and dark themes.

- [ ] Use Export JSON in the Data header. `sankey.json` downloads without console errors about blob URLs. Import it through Import JSON and confirm the diagram, editors, and settings return correctly.
- [ ] Use Export diagram, then SVG. `sankey.svg` opens standalone with a transparent background and labels matching the current theme: dark labels in Light, light labels in Dark.
- [ ] Export PNG. `sankey.png` has a transparent background and matching label colors. With the default 2:1 aspect ratio, its size is 1920 by 960 pixels. Change the aspect ratio and confirm PNG dimensions are twice the SVG's logical dimensions. Resizing only the preview does not change them.
- [ ] Check PNG output with single-color links and source-to-target gradients. Gradients rasterize as gradients, with no canvas or blob-URL errors. Repeat in Safari, where image loading and rasterization can differ.
- [ ] At 360px and 390px, notices and their Dismiss button remain readable without overlap or horizontal overflow.
- [ ] With a screen reader, check polite notice announcements. Repeated invalid value drafts produce inline errors without repeated page-level announcements. An unrelated action does not reannounce unchanged notices.
