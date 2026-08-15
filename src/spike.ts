// Pre-port compile spike (PLAN.md "Pre-port spike: d3 global types"). Proves
// `typeof import("d3") & typeof import("d3-sankey")` composes under strict for
// the exact call shapes app.js uses, before any module is ported. Compile-only —
// never imported, never bundled. Remove once render.ts covers these surfaces.

interface SpikeNode {
	id: string;
	name: string;
}

// No link fields beyond the ones d3-sankey's own SankeyLinkMinimal already
// declares (source/target/value) — the second type param exists for extras.
// Record<string, never> would pin every key to `never` and break assignability
// of the real link literal below, so a structurally-empty `{}` is required here.
// biome-ignore lint/complexity/noBannedTypes: see comment above
type NoExtraLinkFields = {};

// Mirrors app.js's alignFn: a name-keyed lookup falling back to justify.
const align =
	{ left: d3.sankeyLeft, right: d3.sankeyRight, center: d3.sankeyCenter }.left ?? d3.sankeyJustify;

const layout = d3
	.sankey<SpikeNode, NoExtraLinkFields>()
	.nodeId((d) => d.id)
	.nodeWidth(15)
	.nodePadding(10)
	.nodeAlign(align)
	.extent([
		[1, 5],
		[959, 475],
	]);

const graph = layout({
	nodes: [{ id: "n1", name: "Coal" }],
	links: [{ source: "n1", target: "n1", value: 10 }],
});

const linkPath = d3.sankeyLinkHorizontal()(graph.links[0]);

const color = d3.scaleOrdinal(
	graph.nodes.map((n) => n.id),
	d3.schemeObservable10,
);

d3.select("#diagram").append("svg").attr("viewBox", "0 0 960 480").text(color(graph.nodes[0].id));

export { graph, linkPath };
