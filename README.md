# sankey-builder

A D3 Sankey diagram generator that's build-free to run: edit nodes and links in the browser,
pick a color palette or assign manual per-node colors, control link coloring
and node alignment, and see the diagram update live. State autosaves to
localStorage, and the UI supports light/dark themes.

## Usage

Open `index.html` — double-click it from disk (`file://`) or serve it
statically. No build step or dependencies are needed to run it.

## Dependencies

Vendored in `vendor/`: d3 7.9.0, d3-sankey 0.12.3, Open Props 1.7.14, and
SortableJS 1.15.7. See [`vendor/README.md`](vendor/README.md) for sources and
update instructions.

## Verification

[`VERIFICATION.md`](VERIFICATION.md) has a manual acceptance checklist to run
through in a real browser after any change.

## Development

Running the app needs nothing beyond a browser (see Usage above). Developing
it needs [bun](https://bun.sh) — that's the only required tool. Install
dependencies once with `bun install`.

The app is written in TypeScript under `src/` and bundled into the committed
`app.js`. **`app.js` is generated — never edit it by hand.** Run `make watch`
while developing to keep it rebuilt from source, and `make build` before
committing. `make check` fails if the committed bundle has drifted from
`src/`.

Available `make` targets:

| Target | Description |
| --- | --- |
| `build` | Bundle `src/` into `app.js` |
| `watch` | Rebuild `app.js` on change, for local dev against the `file://` artifact |
| `lint` | Check formatting and lint rules (no fixes) |
| `format` | Fix formatting and lint issues |
| `typecheck` | Type-check with `tsc --noEmit` |
| `check` | Typecheck plus bundle-freshness check (fails if `app.js` is stale) |
| `test` | Run all tests |
| `test-unit` | Run unit tests (excludes the artifact smoke test) |
| `test-smoke` | Run only the artifact smoke test |

Unit tests in `tests/` import `src/` directly. The smoke test is different:
it builds a fresh bundle and boots it against the real `index.html` markup
with the vendored d3, to catch bundling issues the unit tests can't see.

CI runs four jobs in parallel: lint, typecheck, unit tests, and an artifact
job (smoke test plus bundle-freshness check).

## Known limitations

- **Single-tab persistence** — localStorage autosave is last-writer-wins; two
  tabs open on the same diagram will overwrite each other.
- **Acyclic only** — circular links aren't supported (a d3-sankey design
  constraint), and creating one is rejected with an inline error.
- **Palette size** — named palettes recycle colors past 10 nodes (8 for Set 2
  and Dark 2).
- **Two-node links** — with exactly two nodes, a link's direction can't be
  reversed (there's no second node to swap it with).

## License

Except for the third-party components listed below, this project is licensed
under the [MIT License](LICENSE).

The following vendored components retain their original copyright and license
terms and are not relicensed under the MIT License:

- `vendor/d3.min.js` — D3 7.9.0, ISC License
  ([license](vendor/LICENSE-d3), [source](https://github.com/d3/d3))
- `vendor/d3-sankey.min.js` — d3-sankey 0.12.3, BSD 3-Clause License
  ([license](vendor/LICENSE-d3-sankey), [source](https://github.com/d3/d3-sankey))
- `vendor/open-props.min.css` — Open Props 1.7.14, MIT License
  ([license](vendor/LICENSE-open-props), [source](https://github.com/argyleink/open-props))
- `vendor/sortable.min.js` — SortableJS 1.15.7, MIT License
  ([license](vendor/LICENSE-sortablejs), [source](https://github.com/SortableJS/Sortable))
