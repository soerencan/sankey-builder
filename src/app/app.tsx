import { useRef } from "preact/hooks";
import type { DiagramPanelActions } from "../features/diagram/diagram-panel";
import { DiagramPanel } from "../features/diagram/diagram-panel";
import { PreviewResizer } from "../features/diagram/preview-resizer";
import type { DiagramRenderRequest } from "../features/diagram/render";
import { SankeyCanvas } from "../features/diagram/sankey-canvas";
import type { DataPanelActions } from "../features/editor/data-panel";
import { DataPanel } from "../features/editor/data-panel";
import type { LinkEditorActions } from "../features/editor/link-editor";
import type { NodeEditorActions } from "../features/editor/node-editor";
import type { ThemeControlActions } from "../features/settings/theme-control";
import { ThemeControl } from "../features/settings/theme-control";
import type { Link, State } from "../model/graph";
import { aspectRatioOption } from "../model/settings";
import type { Settings, Theme } from "../model/settings";
import type { Notice } from "../shared/notice";
import { NoticeRegion } from "../shared/notice";
import type { NodeView } from "./view";

export interface AppProps {
	doc: Document;
	win: Window;
	/** The live domain state — handed straight through to DataPanel for JSON export. */
	state: State;
	theme: Theme;
	nodes: readonly NodeView[];
	links: readonly Readonly<Link>[];
	settings: Readonly<Settings>;
	/** At most one per NoticeKind, in the display order NoticeRegion itself fixes. */
	notices: readonly Notice[];
	lastValidRequest: DiagramRenderRequest | null;
	themeActions: ThemeControlActions;
	diagramActions: DiagramPanelActions;
	nodeActions: NodeEditorActions;
	linkActions: LinkEditorActions;
	dataActions: DataPanelActions;
	/** The owning app instance's AbortSignal — threaded through to every effect/async call that must ignore a stale generation. */
	signal: AbortSignal;
}

/**
 * The single Preact application root. Composes the header/theme control, the
 * consolidated notice region, the diagram panel (toolbar, D3-owned canvas,
 * and preview resizer), and the data panel — one DOM owner per subtree, D3
 * confined to SankeyCanvas's own host div. `diagramRef` is owned here (not by
 * any single child) because DiagramPanel, SankeyCanvas's host, and
 * PreviewResizer are siblings in this same tree that all read or write the
 * #diagram element.
 */
export function App({
	doc,
	win,
	state,
	theme,
	nodes,
	links,
	settings,
	notices,
	lastValidRequest,
	themeActions,
	diagramActions,
	nodeActions,
	linkActions,
	dataActions,
	signal,
}: AppProps) {
	const diagramRef = useRef<HTMLDivElement>(null);

	// The renderer's own viewBox (render.ts) is driven directly by
	// settings.aspectRatio; these custom properties only size the *preview*
	// box around that svg. Declared as an ordinary style prop rather than
	// written imperatively:
	// Preact's style diff only touches the keys present in the vnode's own
	// style object across renders, so it never reads or clears
	// --diagram-preview-height, which PreviewResizer writes straight to the
	// DOM below.
	const aspectRatio = aspectRatioOption(settings.aspectRatio);
	const diagramStyle = {
		"--diagram-aspect-ratio": `${aspectRatio.width} / ${aspectRatio.height}`,
		"--diagram-aspect-number": String(aspectRatio.width / aspectRatio.height),
	};

	return (
		<>
			<header class="app-header">
				<h1>Sankey Builder</h1>
				<ThemeControl theme={theme} actions={themeActions} />
			</header>

			<NoticeRegion notices={notices} />

			<main class="app-layout">
				<section class="diagram-panel" aria-labelledby="diagram-heading">
					<DiagramPanel
						doc={doc}
						win={win}
						diagramRef={diagramRef}
						settings={settings}
						actions={diagramActions}
						signal={signal}
					/>
					<div id="diagram" ref={diagramRef} style={diagramStyle} aria-label="Sankey diagram">
						<SankeyCanvas request={lastValidRequest} />
					</div>
					<div
						id="preview-resizer"
						class="preview-resizer"
						aria-label="Diagram preview size controls"
					>
						<PreviewResizer diagramRef={diagramRef} win={win} />
					</div>
				</section>

				<section id="data-panel" class="data-card" aria-labelledby="data-heading">
					<DataPanel
						doc={doc}
						win={win}
						state={state}
						nodes={nodes}
						links={links}
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
