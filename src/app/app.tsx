import type { DiagramPanelActions } from "../features/diagram/diagram-panel";
import { DiagramPanel } from "../features/diagram/diagram-panel";
import type { DataPanelActions } from "../features/editor/data-panel";
import { DataPanel } from "../features/editor/data-panel";
import type { LinkEditorActions } from "../features/editor/link-editor";
import type { NodeEditorActions, NodeView } from "../features/editor/node-editor";
import type { ThemeControlActions } from "../features/settings/theme-control";
import { ThemeControl } from "../features/settings/theme-control";
import type { Diagram, State } from "../model/graph";
import type { Notice, NoticeKind } from "../shared/notice";
import { NoticeRegion } from "../shared/notice";

export interface AppProps {
	state: State;
	nodes: readonly NodeView[];
	notices: Partial<Record<NoticeKind, Notice>>;
	dismissIoNotice(): void;
	lastValidDiagram: Diagram | null;
	themeActions: ThemeControlActions;
	diagramActions: DiagramPanelActions;
	nodeActions: NodeEditorActions;
	linkActions: LinkEditorActions;
	dataActions: DataPanelActions;
	/** Aborted on destroy; async work that completes afterwards must check it. */
	signal: AbortSignal;
}

export function App({
	state,
	nodes,
	notices,
	dismissIoNotice,
	lastValidDiagram,
	themeActions,
	diagramActions,
	nodeActions,
	linkActions,
	dataActions,
	signal,
}: AppProps) {
	return (
		<>
			<header class="app-header">
				<h1>Sankey Builder</h1>
				<ThemeControl theme={state.settings.theme} actions={themeActions} />
			</header>

			<NoticeRegion notices={notices} dismissIo={dismissIoNotice} />

			<main class="app-layout">
				<DiagramPanel
					diagram={lastValidDiagram}
					settings={state.settings}
					actions={diagramActions}
					signal={signal}
				/>

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
