# Vendored dependencies

Committed here for `file://` support and zero runtime CDN trust (see the
design discussion, question 3). Fetched once during implementation; not
managed by a package manager.

| File                 | Source                                                          | Version |
| -------------------- | ---------------------------------------------------------------- | ------- |
| `d3.min.js`           | https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js            | 7.9.0   |
| `d3-sankey.min.js`    | https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js | 0.12.3  |

`d3-sankey`'s UMD build merges into the `d3` global (`d3.sankey`,
`d3.sankeyLinkHorizontal`, `d3.sankeyLeft/Right/Center/Justify`), so both
scripts must load in this order before `app.js`.

To update: re-run the two `curl` commands above with the new version numbers
and update this table.
