import { useLayoutEffect, useRef } from "preact/hooks";
import type { DiagramRenderRequest } from "./render";
import { renderDiagram } from "./render";

export interface SankeyCanvasProps {
	request: DiagramRenderRequest | null;
}

/**
 * The sole D3-owned subtree: Preact renders only this empty host div —
 * renderDiagram exclusively creates, replaces, and clears its descendants.
 * The effect is keyed on `request` identity, not on unrelated application
 * rerenders, so a redraw happens only when the controller has actually
 * replaced the last-valid diagram snapshot.
 */
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
