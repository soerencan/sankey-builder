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

d3-selection 3.0.0, d3-scale 4.0.2, d3-scale-chromatic 3.1.0, d3-sankey
0.12.3, Preact 10.29.8, and SortableJS 1.15.7 are real npm dependencies,
bundled by `bun build`. `style.css` also defines a handful of design-token
custom properties whose values are copied from Open Props 1.7.14; the
package itself isn't vendored or shipped.

## Architecture

Preact owns the whole application UI: composition, controls, dialogs, and
editor markup all render as components under one root (`src/app/app.tsx`,
mounted by `src/app/start-app.tsx`). The one exception is the rendered Sankey
`<svg>`: `SankeyCanvas` (`src/features/diagram/sankey-canvas.tsx`) renders
only an empty host `<div>`, and D3 (`renderDiagram`,
`src/features/diagram/render.ts`) exclusively creates, replaces, and clears
that host's descendants. Preact never renders children inside it, and D3
never touches anything outside it — keeping one DOM owner per subtree.

## Verification

[`VERIFICATION.md`](VERIFICATION.md) has a manual acceptance checklist to run
through in a real browser after any change.

## Development

Developing the app needs [bun](https://bun.sh) — that's the only required
tool. Install dependencies once with `bun install`. Tooling runs on Node 24
(managed via nvm / `.nvmrc`) and Bun 1.3.14 (already pinned in CI); linting
and formatting run on Biome, and tests run on Vitest against happy-dom.

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
| `test` | Run all tests, including the dist build/boot smoke test |
| `test-unit` | Run tests except the dist smoke test — fast local loop |
| `test-dist` | Run only the dist smoke test (builds `dist/` from scratch, then boots it) |

Unit tests live next to the module they cover, in `src/` (model, codec,
validation, link-value, colors, export, hooks). `tests/integration/` suites
are broader: they boot the application through `startApp()`
(`src/app/start-app.tsx`) against the real `index.html` markup with the real
d3/SortableJS. `tests/build/dist.test.ts` goes one step further: it runs the
build script (`bun run build`) itself, then boots the actual emitted `dist/`
bundle, asserting its asset URLs are relative (so the site works from any
subpath) and the default diagram renders.

One workflow, `.github/workflows/ci.yml`, runs four jobs in parallel on every
PR and push to `main`: lint, typecheck, tests (`make test-unit`), and an
artifact job (`make test-dist`, which builds and boots the real `dist/`
output, then uploads it as a Pages artifact) — split that way so `dist/`
isn't built twice per run. A fifth job, `deploy`, needs all four; it runs on
a push to `main` or a manually triggered `workflow_dispatch` run (still
gated to `main` and to every check job passing), publishing the artifact
job's `dist/` to GitHub Pages via `actions/deploy-pages`, so a commit whose
checks fail can't reach Pages and nothing rebuilds what the artifact job
already boot-tested. This
requires the repository's Pages source to be set to "GitHub Actions" once
(Settings → Pages) — after that, pushes to `main` deploy automatically.

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
bundled site (`d3-sankey`, `d3-scale`, `d3-scale-chromatic`, `d3-selection`,
Preact, and SortableJS), plus Open Props, whose license is retained because
`style.css` derives a handful of design-token values from it. None of these
are relicensed under the MIT License above.
