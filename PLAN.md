# UI polish plan

## Objective

Finish the UI before undertaking general code cleanup or refactoring. The first
UI change will remove the separate **Diagram controls** box and relocate each
setting according to its scope:

- Diagram appearance belongs in a toolbar attached to the diagram.
- The application theme belongs in the application header.
- Nodes and Links live together in a single Data card focused on constructing
  the diagram.

The page uses one consistent reading order at every width: the full-width
diagram comes first, followed by the full-width Data card. The Data card lays
out Nodes and Links side by side when it has enough room and stacks them when
it does not. The result must work comfortably on mobile without maintaining a
second desktop-only layout model.

## Decisions

### Remove manual node colors

Remove the manual-color feature for now. It complicates both the settings UI
and the Nodes editor, and can be reconsidered later as a separately designed
feature.

This should be a real feature removal rather than merely hiding the **Manual**
option:

- Remove Manual from the palette choices.
- Stop showing per-node color inputs.
- Remove manual-color behavior from active state, persistence, imports, and
  exports.
- Continue to tolerate previously saved/exported manual-color data. Load it
  using its last named palette and ignore the legacy per-node colors rather
  than rejecting the whole diagram.
- Update tests, documentation, and the verification checklist accordingly.

Directly related dead code should be removed as part of the feature removal.
Broader restructuring remains deferred until the UI work is complete.

### Use an adaptive diagram toolbar

The diagram gets a card header containing its appearance controls. The toolbar
sits above the SVG; it must not float over or obscure the diagram.

The toolbar changes representation based on the diagram card's own width. It
must not wrap into several lines.

Wide layout:

```text
┌─ Diagram ───────────────────────────────────────────────┐
│ ‹ [● ● ● ● ●] ›   Links [gradient ▾]   Align [↤][↔][↦][≡]   [Export] │
├────────────────────────────────────────────────────────────┤
│                         Sankey diagram                    │
└────────────────────────────────────────────────────────────┘
```

Narrow layout:

```text
┌─ Diagram ───────────────────────────────────────────────┐
│ ‹ [● ● ● ● ●] ›                         [Diagram ⚙] │
├───────────────────────────────────────────────────────────┤
│                         Sankey diagram                    │
└───────────────────────────────────────────────────────────┘
```

Use a container query on the diagram panel rather than a viewport media query.
This lets the toolbar respond to the space it actually receives. Determine the
final breakpoint by where the controls fit; the implemented starting point is
680px after adding diagram export.

## Control behavior

### Palette carousel

Keep the palette control directly accessible in both toolbar layouts:

- A previous button.
- A central preview containing swatches from the active palette.
- A next button.
- Cycling wraps through the five named palettes.
- Selecting a palette updates the diagram immediately.
- Clicking or tapping the preview may open a labelled palette chooser, making
  non-sequential selection possible and exposing the palette names.

The toolbar does not need a visible `Palette` label, but the control needs an
accessible name that includes the current value, for example
`Palette: Tableau 10`.

### Link colors

Link coloring and node palettes are different concepts and should not be
combined into one unexplained color button.

On a wide diagram, use one compact control showing the current link-color
pictogram and a short visible `Links` label. Activating it presents all four
choices with icons and text:

- Source
- Source to target (gradient)
- Target
- Neutral

The pictograms should depict a flow between two differently colored endpoints
so the distinction is visible. Because these modes are not standard universal
icons, their selection surface must contain text labels.

On a narrow diagram, move these choices into the **Diagram** surface instead
of keeping a separate dropdown in the toolbar.

### Alignment

On a wide diagram, use a text-editor-style group of four icon toggle buttons:

- Left
- Center
- Right
- Justify

Only one is active. The selected state must remain evident without relying on
color alone.

On a narrow diagram, move the four labelled choices into the **Diagram**
surface.

### Narrow-screen Diagram surface

The narrow toolbar contains one **Diagram** button for the less-frequently
changed diagram settings and exports. Activating it opens a mobile-friendly
modal or bottom-sheet surface rather than expanding inside the diagram panel.

```text
Diagram

Link colors
[Source] [Gradient] [Target] [Neutral]

Alignment
[Left] [Center] [Right] [Justify]

Export diagram
[SVG] [PNG]
```

Requirements:

- It must have an obvious close action and support Escape where a keyboard is
  present.
- Focus must move into it when opened and return to the trigger when closed.
- Choices must be comfortably tappable on coarse pointers.
- It must not depend on hover or tooltips for comprehension.
- It must not increase the height of the diagram panel while open.

### Theme

Move theme out of diagram settings and into the application header. Theme is
an application/browser preference, not diagram data; it is already excluded
from diagram exports.

Use one compact button reflecting the current state (system, light, or dark).
Activating it presents three explicitly labelled choices:

- System / Auto
- Light
- Dark

Keep the mobile header on one line. File actions stay in their data and diagram
contexts rather than moving into the app header.

## File actions

Distribute file actions according to what they operate on:

- Combine Nodes and Links into one **Data** card.
- Put Import and Export JSON in the Data card header.
- Put one grouped SVG/PNG Export control in the wide diagram toolbar.
- Put SVG/PNG choices in the narrow Diagram sheet rather than adding toolbar
  buttons that would cause wrapping.
- Show import/export results in one shared status toast that remains visible
  after a dialog or bottom sheet closes.

## Structure and rendering

Use a single-column page structure whose DOM order is also its visual and
assistive-technology reading order:

```text
Application header
Diagram panel (full content width)
Data card (full content width)
  Nodes | Links   ← side by side when the card is wide enough
  Nodes
  Links           ← stacked when the card is narrow
```

The diagram is the primary output and therefore appears first. The Data card
follows it in normal page flow. Use a container query on the Data card for its
two-section layout rather than coupling the switch to viewport width. This
also keeps the sections responsive if the app is embedded in a narrower
container later.

Do not use a desktop editor/diagram split, draggable resizer, stored editor
width, sticky diagram, content underlay, or compensating scroll padding. The
page should use ordinary vertical scrolling on desktop and mobile. Removing
those mechanisms includes removing their markup, styling, setup calls,
persistence, and directly related dead code.

Introduce a diagram-panel wrapper with a persistent header and a dedicated
render target:

```html
<section class="diagram-panel" aria-labelledby="diagram-heading">
  <header class="diagram-toolbar">…</header>
  <div id="diagram" aria-label="Sankey diagram"></div>
</section>
```

Do not insert the toolbar directly into the existing `#diagram`. The renderer
currently clears that element before rebuilding the SVG, which would delete
the toolbar after every change.

Let the diagram preserve its intrinsic aspect ratio at the available content
width. It must remain visible in normal document flow and must not be cropped,
overlaid, or pinned while the user scrolls to the Data card.

Use small inline SVG pictograms with `currentColor` rather than Unicode glyphs
or a new icon dependency. Icons should have a consistent visual weight and
remain legible in both themes.

## Accessibility and interaction requirements

- Every icon-only button has an accessible name.
- Current values are announced, not just represented visually.
- Toggle groups expose their selected state programmatically.
- All operations work with keyboard, touch, and pointer input.
- Coarse-pointer targets remain approximately 44px.
- Focus indicators remain visible in light and dark themes.
- Selection surfaces contain text; tooltips are supplementary and must not be
  the only explanation.
- The toolbar stays on one line in each responsive representation.
- No horizontal page scrolling is introduced at 360px, 390px, or 768px.

## Implementation sequence

### 1. Remove manual colors

- Remove the Manual palette option and per-node color inputs.
- Remove or normalize manual-color state and legacy persistence/import data.
- Update export output to omit manual-color-only fields.
- Delete directly related actions and rendering branches.
- Update automated tests and documentation.

### 2. Add the diagram panel and wide toolbar

- Add the persistent panel/header structure around `#diagram`.
- Implement the named-palette carousel.
- Implement the labelled link-color selector.
- Implement the four-button alignment group.
- Preserve diagram rendering and export behavior.

### 3. Move theme to the app header

- Replace the Diagram controls theme select with a header control.
- Preserve Auto, Light, and Dark behavior and persistence.
- Verify live OS-theme changes still work in Auto mode.

### 4. Add the narrow toolbar and Diagram surface

- Add a diagram-panel container query.
- Swap the wide controls for the narrow Diagram trigger without wrapping.
- Implement the labelled link-color, alignment, and SVG/PNG export choices in
  the mobile surface.
- Verify dialog sizing and focus behavior at narrow widths.

### 5. Remove the old Diagram controls box

- Delete its remaining markup and styles.
- Combine Nodes and Links into one Data card with Import and Export JSON in its
  header.
- Add one grouped SVG/PNG export control to the wide diagram toolbar.
- Remove obsolete control-row styling if it has no remaining consumers.

### 6. Establish the diagram-first page layout

- Put the diagram panel before the Data card in the actual DOM.
- Make both cards span the available content width.
- Lay out Nodes and Links side by side using a Data-card container query, then
  stack them when the card itself becomes too narrow.
- Remove the resizer, editor-width persistence, desktop split layout, sticky
  positioning, content-underlay treatment, and compensating scroll padding.
- Confirm live data edits still update the diagram above immediately and do
  not cause horizontal overflow or unexpected page jumps.

### 7. Verify before broader refactoring

- Run formatting, type checking, unit tests, the smoke test, and bundle
  freshness checks.
- Complete the real-browser verification below.
- Only then begin the separate general code-tidying/refactoring phase.

## Acceptance criteria

### Desktop

- The separate Diagram controls box no longer exists.
- The diagram appears first at full content width, with the Data card below it;
  DOM order and visual order match.
- Nodes and Links share the Data card and sit side by side when the card is
  sufficiently wide.
- Palette, link-color, and alignment changes are available from the diagram
  toolbar and update the diagram immediately.
- The toolbar remains a single line at all supported diagram widths.
- The theme control is in the application header and retains all three modes.
- The page has no resizer or stored editor-width behavior and scrolls normally.

### Mobile and narrow containers

- The diagram remains above the Data card in normal page flow and scrolls away
  naturally as the user moves down the page.
- Nodes and Links stack in DOM order when the Data card is narrow.
- The narrow toolbar contains the palette carousel and one Diagram trigger.
- Link colors, alignment, and SVG/PNG exports are available in a labelled,
  touch-friendly surface.
- Opening settings does not permanently reduce the diagram area or cause the
  toolbar to wrap.
- Nothing is cropped, overlapped, or horizontally scrollable at 360px, 390px,
  and 768px.
- Keyboard focus follows the same diagram-then-Nodes-then-Links reading order
  shown visually.

### Compatibility and regression checks

- Existing automatic-palette diagrams load unchanged.
- Legacy manual-color diagrams load successfully using their stored named
  palette, with legacy node colors ignored.
- Import, JSON export, SVG export, and PNG export continue to work under both
  served and `file://` use.
- Diagram exports still use the correct light/dark background and label color.
- Empty and invalid diagrams retain their current behavior.
- Auto theme still follows live OS preference changes.

## Deferred work

- Reintroducing individually editable node colors, if later justified by a
  clearer workflow.
- A navigation drawer if the app later gains enough destinations and global
  commands to justify one.
- General code cleanup and architectural refactoring unrelated to this UI
  change.
