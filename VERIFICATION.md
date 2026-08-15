# Verification checklist

Manual acceptance pass for Sankey Builder. Run in a real browser — open
`index.html` directly (`file://`, double-click) for the file:// item, a
static server for the rest is fine too. Re-run after any change touching
the affected behavior.

## Node editor

- [ ] "Add node" appends a new node row with a distinct swatch color and a rect in the diagram.
- [ ] Renaming a node updates its label in the diagram and its name everywhere it appears in the link editor's source/target dropdowns, without changing its color.
- [ ] Deleting a node removes its row, its rect from the diagram, and cascade-removes any links referencing it (their rows and ribbons disappear too, no error).
- [ ] Deleting all nodes leaves an empty node editor and an empty diagram area — no console error, no crash.
- [ ] Adding a node again after deleting all shows that node's row in the editor and an empty diagram area (no links yet, so nothing to draw) — no console error, no crash, no vanished/NaN-positioned rect.

## Link editor

- [ ] "Add link" is disabled when fewer than two nodes exist, enabled otherwise.
- [ ] A link's target `<select>` cannot offer the node currently chosen as its source, and vice versa — a self-link cannot be selected through the UI.
- [ ] If a self-link is forced into state some other way, `validate()` reports "A link cannot connect X to itself." and the last-good diagram stays on screen.
- [ ] Creating a link that closes a loop (e.g. A→B, B→C, C→A) shows an inline error naming the full cycle path (e.g. "This link would create a cycle: A → B → C → A"); the diagram does not update.
- [ ] Setting a link's value to `0` shows an inline error ("needs a value greater than 0"); diagram unchanged.
- [ ] Setting a link's value to a negative number shows the same inline error; diagram unchanged.
- [ ] Clearing a link's value field (blank) shows the same inline error; diagram unchanged; the last valid diagram remains visible and correct.
- [ ] Fixing the offending link's value clears the error and the diagram re-renders immediately.
- [ ] Deleting the last remaining link empties the diagram area cleanly (no inline error, nodes still listed in the node editor) rather than leaving stray/invisible rects.
- [ ] Entering an absurdly large value (e.g. `1e16` or `1e308`) in any single link's value field — even the first link edited — shows an immediate inline error naming that link and its maximum; the last-good diagram is retained on screen and never goes NaN/blank at any point.

## Link color modes

- [ ] "Source" mode: every ribbon is a solid color matching its source node.
- [ ] "Target" mode: every ribbon is a solid color matching its target node.
- [ ] "Source → target" mode: each ribbon visibly blends from the source node's color to the target node's color along its length (inspect a ribbon between two differently-colored nodes).
- [ ] "Static" mode: every ribbon is the same neutral gray, regardless of endpoint colors.
- [ ] Switching between modes re-renders the diagram immediately without touching node/link editor state.

## Alignment

- [ ] "Left": source-only nodes (no incoming links) are pushed to the leftmost column.
- [ ] "Right": sink-only nodes (no outgoing links) are pushed to the rightmost column.
- [ ] "Center": nodes are positioned to minimize link crossings/length (d3-sankey's centered heuristic) rather than snapping to source/sink columns.
- [ ] "Justify" (default): both source and sink nodes are pushed to their respective extreme columns.
- [ ] Cycling through all four options re-renders the diagram without altering node/link data.

## Palette switching

- [ ] Switching among the named palettes (Observable 10, Tableau 10, Category 10, Set 2, Dark 2) recolors every node and, in turn, every ribbon that references those colors — consistently across nodes and gradient stops.
- [ ] Colors stay stable across renders when data changes but the palette doesn't (no reshuffle on rename/add/delete).

## Manual color mode

- [ ] Switching the palette dropdown to "Manual" reveals a color `<input type="color">` per node row, each seeded to that node's current computed color (nothing visually jumps).
- [ ] Changing one node's color picker recolors only that node's swatch, rect, and any ribbons using that node's color (per the active link-color mode) — live, while dragging the picker.
- [ ] Switching from Manual back to a named palette hides the color inputs and recolors nodes from that palette.
- [ ] Switching back to Manual afterward restores the previously hand-picked colors (round-trip: overrides are retained, not cleared, while a named palette was active).

## Reload persistence (localStorage)

- [ ] Build a non-trivial graph (several nodes/links, a non-default palette, link-color mode, alignment, and at least one manual color), reload the page → every node, link, and setting returns exactly as left, including manual mode and its per-node colors.
- [ ] Leave the state invalid before reloading (e.g. a link with a blank/zero value, or an unsaved cycle-adjacent edit) → after reload, the same inline error reappears, the node/link editors show the in-progress rows (including the blank/invalid value) so it's fixable, and no diagram is rendered (there is no prior diagram to fall back to in a fresh page load).
- [ ] Clear the app's localStorage entry (`sankey-builder`) and reload → the page loads the default four-node/three-link graph with no console error.
- [ ] Corrupt the localStorage value directly (e.g. set it to `"not json"` via devtools) and reload → the app falls back to the default graph with no console error.

## Theme

- [ ] Theme dropdown defaults to "Auto" on a fresh load, and the page matches the OS color-scheme preference.
- [ ] Selecting "Light" forces the light theme regardless of OS preference; selecting "Dark" forces dark regardless of OS preference.
- [ ] With the theme set to "Auto", flipping the OS-level appearance setting (light ↔ dark) while the page is open updates the UI and diagram chrome live, without a reload.
- [ ] In dark mode (either "Dark" or "Auto" + OS dark), error text and the node/link delete buttons remain clearly legible against the dark surface (no low-contrast red-on-near-black).
- [ ] Native form controls (selects, the manual-mode color inputs) render with dark chrome in dark mode and light chrome in light mode, not mismatched.
- [ ] The theme choice persists across reload along with the rest of settings.

## Cold start / file:// load

- [ ] Double-click `index.html` from disk (`file://`) with no prior localStorage entry → the default diagram renders, with zero errors or warnings in the browser console.
- [ ] With a prior localStorage entry already saved (e.g. from a previous `file://` session in the same browser profile), double-clicking `index.html` again restores that state with zero console errors.
