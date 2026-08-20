# Vendored dependencies

Committed here for `file://` support and zero runtime CDN trust. Fetched once during implementation; not
managed by a package manager.

| File                 | Source                                                          | Version | License                              |
| -------------------- | ---------------------------------------------------------------- | ------- | ------------------------------------ |
| `d3.min.js`           | https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js            | 7.9.0   | ISC (`LICENSE-d3`)                   |
| `d3-sankey.min.js`    | https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js | 0.12.3  | BSD-3-Clause (`LICENSE-d3-sankey`)   |
| `open-props.min.css`  | https://unpkg.com/open-props@1.7.14/open-props.min.css          | 1.7.14  | MIT (`LICENSE-open-props`)           |
| `sortable.min.js`     | https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js  | 1.15.7  | MIT (`LICENSE-sortablejs`)           |

`d3-sankey`'s UMD build merges into the `d3` global (`d3.sankey`,
`d3.sankeyLinkHorizontal`, `d3.sankeyLeft/Right/Center/Justify`), so both
scripts must load in this order before `app.js`.

`sortable.min.js`'s UMD build assigns a standalone `Sortable` global, consumed
by `app.js` for the editor rows' drag-to-reorder; it has no load-order
dependency on d3, but must still load before `app.js`.

`open-props.min.css` is standalone CSS (design tokens only); `index.html`
links it before `style.css`, which consumes its custom properties.

To update, fetch the new versions from the table's source URLs:

```sh
curl -o vendor/d3.min.js https://cdn.jsdelivr.net/npm/d3@<version>/dist/d3.min.js
curl -o vendor/d3-sankey.min.js https://cdn.jsdelivr.net/npm/d3-sankey@<version>/dist/d3-sankey.min.js
curl -o vendor/open-props.min.css https://unpkg.com/open-props@<version>/open-props.min.css
curl -o vendor/sortable.min.js https://cdn.jsdelivr.net/npm/sortablejs@<version>/Sortable.min.js
```

Then update the version numbers in this table and in the License section of
the project-root [README](../README.md), and refresh
`LICENSE-d3` / `LICENSE-d3-sankey` / `LICENSE-open-props` / `LICENSE-sortablejs`
from the packages' `LICENSE` files (e.g.
`https://cdn.jsdelivr.net/npm/d3@<version>/LICENSE`) in case upstream terms
changed.
