# Vendored dependencies

Committed here for zero runtime CDN trust. Fetched once during implementation; not managed by a
package manager. (d3, d3-sankey, and SortableJS moved to real npm dependencies, bundled by `bun
build` — see the project-root README's Development section — so only Open Props remains vendored.)

| File                 | Source                                                  | Version | License                    |
| -------------------- | -------------------------------------------------------- | ------- | --------------------------- |
| `open-props.min.css`  | https://unpkg.com/open-props@1.7.14/open-props.min.css  | 1.7.14  | MIT (`LICENSE-open-props`) |

`open-props.min.css` is standalone CSS (design tokens only); `index.html`
links it before `style.css`, which consumes its custom properties.

To update, fetch the new version from the table's source URL:

```sh
curl -o vendor/open-props.min.css https://unpkg.com/open-props@<version>/open-props.min.css
```

Then update the version number in this table and in the License section of
the project-root [README](../README.md), and refresh `LICENSE-open-props`
from the package's `LICENSE` file in case upstream terms changed.
