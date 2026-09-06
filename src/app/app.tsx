import { useRef } from "preact/hooks";
import type { DiagramPanelActions } from "../features/diagram/diagram-panel";
import { DiagramPanel } from "../features/diagram/diagram-panel";
import { PreviewResizer } from "../features/diagram/preview-resizer";
import { SankeySvg } from "../features/diagram/sankey-svg";
import type { DataPanelActions } from "../features/editor/data-panel";
import { DataPanel } from "../features/editor/data-panel";
import type { LinkEditorActions } from "../features/editor/link-editor";
import type { NodeEditorActions, NodeView } from "../features/editor/node-editor";
import type { ThemeControlActions } from "../features/settings/theme-control";
import { ThemeControl } from "../features/settings/theme-control";
import type { Diagram, State } from "../model/graph";
import { aspectRatioOption } from "../model/settings";
import type { Notice, NoticeKind } from "../shared/notice";
import { NoticeRegion } from "../shared/notice";

export interface AppProps {
	state: State;
	nodes: readonly NodeView[];
	notices: Partial<Record<NoticeKind, Notice>>;
	lastValidDiagram: Diagram | null;
	themeActions: ThemeControlActions;
	diagramActions: DiagramPanelActions;
	nodeActions: NodeEditorActions;
	linkActions: LinkEditorActions;
	dataActions: DataPanelActions;
	/** Aborted on destroy; async work that completes afterwards must check it. */
	signal: AbortSignal;
}

/**
 * `diagramRef` lives here rather than in a child because DiagramPanel,
 * SankeySvg's host, and PreviewResizer are siblings that all read or write
 * the #diagram element.
 */
export function App({
	state,
	nodes,
	notices,
	lastValidDiagram,
	themeActions,
	diagramActions,
	nodeActions,
	linkActions,
	dataActions,
	signal,
}: AppProps) {
	const diagramRef = useRef<HTMLDivElement>(null);

	// These size only the preview box; the svg's own viewBox comes from
	// SankeySvg. Safe as a style prop even though PreviewResizer writes
	// --diagram-preview-height to the same element imperatively: Preact's
	// style diff touches only the keys present in the vnode's style object.
	const aspectRatio = aspectRatioOption(state.settings.aspectRatio);
	const diagramStyle = {
		"--diagram-aspect-ratio": `${aspectRatio.width} / ${aspectRatio.height}`,
		"--diagram-aspect-number": String(aspectRatio.width / aspectRatio.height),
	};

	return (
		<>
			<header class="app-header">
				<h1>Sankey Builder</h1>
				<ThemeControl theme={state.settings.theme} actions={themeActions} />
			</header>

			<NoticeRegion notices={notices} />

			<main class="app-layout">
				<section class="diagram-panel" aria-labelledby="diagram-heading">
					<DiagramPanel
						diagramRef={diagramRef}
						settings={state.settings}
						actions={diagramActions}
						signal={signal}
					/>
					<div id="diagram" ref={diagramRef} style={diagramStyle}>
						<div class="sankey-canvas">
							<SankeySvg diagram={lastValidDiagram} />
						</div>
					</div>
					<div
						id="preview-resizer"
						class="preview-resizer"
						aria-label="Diagram preview size controls"
					>
						<PreviewResizer diagramRef={diagramRef} />
					</div>
				</section>

				<section id="data-panel" class="data-card" aria-labelledby="data-heading">
					<DataPanel
						state={state}
						nodes={nodes}
						nodeActions={nodeActions}
						linkActions={linkActions}
						actions={dataActions}
						signal={signal}
					/>
				</section>
			</main>
		</>
	);
}
