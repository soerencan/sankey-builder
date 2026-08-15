# sankey-builder

A build-free D3 Sankey diagram generator: edit nodes and links in the browser,
pick a color palette or assign manual per-node colors, control link coloring
and node alignment, and see the diagram update live. State autosaves to
localStorage, and the UI supports light/dark themes.

## Usage

Open `index.html` — double-click it from disk (`file://`) or serve it
statically. There's no build step and no dependencies to install.

## Dependencies

Vendored in `vendor/`: d3 7.9.0 and d3-sankey 0.12.3. See
[`vendor/README.md`](vendor/README.md) for sources and update instructions.

## Verification

[`VERIFICATION.md`](VERIFICATION.md) has a manual acceptance checklist to run
through in a real browser after any change.

## Known limitations

- **Single-tab persistence** — localStorage autosave is last-writer-wins; two
  tabs open on the same diagram will overwrite each other.
- **Acyclic only** — circular links aren't supported (a d3-sankey design
  constraint), and creating one is rejected with an inline error.
- **Palette size** — named palettes recycle colors past 10 nodes (8 for Set 2
  and Dark 2).
- **Two-node links** — with exactly two nodes, a link's direction can't be
  reversed (there's no second node to swap it with).
