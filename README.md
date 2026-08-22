# sankey-builder

A D3 Sankey diagram generator that's build-free to run: edit nodes and links in the browser,
pick a color palette, control link coloring and node alignment, and see the
diagram update live. State autosaves to localStorage, and the UI supports
light/dark themes.

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
dependencies once with `bun install`. Tooling runs on Node 24 (managed via
nvm / `.nvmrc`) and Bun 1.3.14 (already pinned in CI).

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

Most tests in `tests/` import `src/` directly. `tests/app.test.ts` and
`tests/lifecycle.test.ts` are broader: they boot the application through
`startApp()` (`src/app.ts`) against the real `index.html` markup with the
vendored d3/SortableJS, to catch integration issues unit tests can't see.

CI runs four jobs in parallel: lint, typecheck, tests, and an artifact job
(bundle-freshness check).

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

[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) is the authoritative
notice list: it attributes the full production dependency closure of the
bundled site (D3 and its `d3-*` modules, d3-sankey, and SortableJS), plus
Open Props, which is linked directly by `index.html` and shipped in full.
None of these are relicensed under the MIT License above.

The `vendor/LICENSE-*` files are the in-tree copies of the individual
upstream licenses these notices are drawn from.
