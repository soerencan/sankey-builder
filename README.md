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

The runtime dependencies are D3 (`d3-selection`, `d3-scale`,
`d3-scale-chromatic`, `d3-sankey`), Preact, and SortableJS, all bundled by
`bun build`. `package.json` and `bun.lock` are the source of truth for
versions.

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

Bun 1.3.14 (pinned in `.bun-version`) runs the dev server and the
production build. Vitest and `tsc` run on Node 24, managed via nvm
(`.nvmrc`). Install dependencies once with `bun install`. Linting and
formatting run on Biome, and tests run on Vitest against happy-dom.

The app is written in TypeScript under `src/`, entered via `src/main.ts` and
loaded straight from `index.html` as an ES module — there's no committed
bundle. `make dev` runs Bun's own dev server (HMR, on-the-fly TS/bundling)
for local work. `make build` produces the canonical, clean production build:
a hashed, minified JS/CSS bundle plus a generated `third-party-licenses.html`
in `dist/`, ready to host statically. The footer's "Third-party licenses"
link only resolves against a build, not under `make dev`.

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

Unit tests live next to the module they cover (`src/`, `scripts/`). `tests/integration/`
suites are broader: they boot the application through `startApp()`
(`src/app/start-app.tsx`) against the real `index.html` markup with the real
d3/SortableJS. `tests/build/dist.test.ts` goes one step further: it runs the
build script (`bun run build`) itself, then boots the actual emitted `dist/`
bundle, asserting its asset URLs are relative (so the site works from any
subpath) and the default diagram renders.

One workflow, `.github/workflows/ci.yml`, runs four jobs in parallel on every
PR and push to `main`: lint, typecheck, tests (`make test-unit`), and an
artifact job (`make test-dist`, which builds and boots the real `dist/`
output, then uploads it as a Pages artifact) — split that way so `dist/`
isn't built twice per run. A fifth job, `deploy`, needs all four and runs
only on a push to `main`, publishing the artifact job's `dist/` to GitHub
Pages via `actions/deploy-pages`, so a commit whose checks fail can't reach
Pages and nothing rebuilds what the artifact job already boot-tested. This
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

Except for its third-party dependencies, this project is licensed under the
[MIT License](LICENSE).

The bundle strips the dependencies' license comments, so `make build`
generates `dist/third-party-licenses.html` (`scripts/third-party-licenses.ts`)
from the installed production dependency closure and the page footer links to
it. None of those packages are relicensed under the MIT License above.
