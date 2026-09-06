import { useLayoutEffect, useRef } from "preact/hooks";
import type { DiagramRenderRequest } from "./render";
import { renderDiagram } from "./render";

export interface SankeyCanvasProps {
	request: DiagramRenderRequest | null;
}

/** The only D3-owned subtree: Preact renders the empty host, renderDiagram owns its descendants. */
export function SankeyCanvas({ request }: SankeyCanvasProps) {
	const hostRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		if (request) renderDiagram(host, request.state);
		else host.replaceChildren();
		return () => host.replaceChildren();
	}, [request]);

	return <div class="sankey-canvas" ref={hostRef} />;
}
