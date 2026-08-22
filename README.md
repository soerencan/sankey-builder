# sankey-builder

A D3 Sankey diagram generator: edit nodes and links in the browser, pick a
color palette, control link coloring and node alignment, and see the diagram
update live. State autosaves to localStorage, and the UI supports light/dark
themes.

## Usage

Serve the built site with `make build` (see Development below) and host the
resulting `dist/` directory statically — GitHub Pages, any static file host,
or `python3 -m http.server` from inside `dist/` for a quick local check.
Direct `file://` execution isn't supported: the app loads as an ES module,
which browsers block from `file://` origins for security reasons.

## Dependencies

d3 7.9.0, d3-sankey 0.12.3, and SortableJS 1.15.7 are real npm dependencies,
bundled by `bun build`. Open Props 1.7.14 is still vendored as standalone CSS
in `vendor/`; see [`vendor/README.md`](vendor/README.md) for its source and
update instructions.

## Verification

[`VERIFICATION.md`](VERIFICATION.md) has a manual acceptance checklist to run
through in a real browser after any change.

## Development

Developing the app needs [bun](https://bun.sh) — that's the only required
tool. Install dependencies once with `bun install`. Tooling runs on Node 24
(managed via nvm / `.nvmrc`) and Bun 1.3.14 (already pinned in CI).

The app is written in TypeScript under `src/`, entered via `src/main.ts` and
loaded straight from `index.html` as an ES module — there's no committed
bundle. `make dev` runs Bun's own dev server (HMR, on-the-fly TS/bundling)
for local work. `make build` produces the canonical, clean production build:
a hashed, minified JS/CSS bundle plus `THIRD_PARTY_LICENSES.md` in `dist/`,
ready to host statically.

Available `make` targets:

| Target | Description |
| --- | --- |
| `dev` | Serve the app locally with Bun's dev server |
| `build` | Canonical production build — emits `dist/` |
| `lint` | Check formatting and lint rules (no fixes) |
| `format` | Fix formatting and lint issues |
| `typecheck` | Type-check with `tsc --noEmit` |
| `check` | Typecheck (alias, for CI parity) |
| `test` | Run all tests, including the dist build/boot smoke test |
| `test-unit` | Run tests except the dist smoke test — fast local loop |
| `test-dist` | Run only the dist smoke test (builds `dist/` from scratch, then boots it) |

Most tests in `tests/` import `src/` directly. `tests/app.test.ts` and
`tests/lifecycle.test.ts` are broader: they boot the application through
`startApp()` (`src/app.ts`) against the real `index.html` markup with the
real d3/SortableJS. `tests/dist.test.ts` goes one step further: it runs
`make build` itself, then boots the actual emitted `dist/` bundle, asserting
its asset URLs are relative (so the site works from any subpath) and the
default diagram renders.

CI runs four jobs in parallel: lint, typecheck, tests (`make test-unit`), and
an artifact job (`make test-dist`, which builds and boots the real `dist/`
output) — split that way so `dist/` isn't built twice per run.

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
