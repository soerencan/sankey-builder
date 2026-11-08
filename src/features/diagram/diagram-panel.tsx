import { useRef } from "preact/hooks";
import type { Diagram } from "../../model/graph";
import type { DiagramSettingKey, Settings } from "../../model/settings";
import { aspectRatioOption, SETTING_DOMAINS } from "../../model/settings";
import type { AccessibleName } from "../../shared/accessible-name";
import { ChoiceDialog } from "../../shared/choice-dialog";
import { Icon } from "../../shared/icon";
import type { IoNoticeActions } from "../../shared/notice";
import { useDialog } from "../../shared/use-dialog";
import { download } from "../files/download";
import { SETTING_LABELS } from "../settings/options";
import { PaletteSelect } from "../settings/palette-select";
import { createPngBlob, createSvgBlob } from "./export";
import { PreviewResizer } from "./preview-resizer";
import { SankeySvg } from "./sankey-svg";

const EXPORT_SVG_FILENAME = "sankey.svg";
const EXPORT_PNG_FILENAME = "sankey.png";

export interface DiagramPanelActions extends IoNoticeActions {
	setDiagramSetting<K extends DiagramSettingKey>(key: K, value: Settings[K]): void;
}

export interface DiagramPanelProps {
	/** Last valid snapshot; settings may already reflect edits to an invalid graph. */
	diagram: Diagram | null;
	settings: Readonly<Settings>;
	actions: DiagramPanelActions;
	signal: AbortSignal;
}

type ExportOptionsProps = {
	onExportSvg(): void;
	onExportPng(): void;
} & AccessibleName;

/** Not a choice component: these are one-shot actions with no current value to mark. */
function ExportOptions({ onExportSvg, onExportPng, label, labelledBy }: ExportOptionsProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: These are export actions, not form controls requiring a fieldset.
		<div class="export-options" role="group" aria-label={label} aria-labelledby={labelledBy}>
			<button type="button" class="choice-option" onClick={onExportSvg}>
				SVG
			</button>
			<button type="button" class="choice-option" onClick={onExportPng}>
				PNG
			</button>
		</div>
	);
}

export function DiagramPanel({ diagram, settings, actions, signal }: DiagramPanelProps) {
	const diagramRef = useRef<HTMLDivElement>(null);

	// These size only the preview box; the svg's own viewBox comes from
	// SankeySvg. Safe as a style prop even though PreviewResizer writes
	// --diagram-preview-height to the same element imperatively: Preact's
	// style diff touches only the keys present in the vnode's style object.
	const aspectRatio = aspectRatioOption(settings.aspectRatio);
	const diagramStyle = {
		"--diagram-aspect-ratio": `${aspectRatio.width} / ${aspectRatio.height}`,
		"--diagram-aspect-number": String(aspectRatio.width / aspectRatio.height),
	};

	const diagramExportDialog = useDialog();
	const displayDialog = useDialog();

	/** Exports the visible last-valid diagram; the dialog closes even when empty. */
	function withVisibleDiagram(fn: (svg: SVGSVGElement) => void): void {
		actions.clearIoNotice();
		const diagramEl = diagramRef.current;
		if (diagramEl) {
			const svg = diagramEl.querySelector("svg");
			if (svg) fn(svg);
			else actions.reportIoError("Nothing to export — the diagram is empty.");
		}
		diagramExportDialog.close();
	}

	function exportSvg(): void {
		withVisibleDiagram((svg) => {
			download(svg.ownerDocument, createSvgBlob(svg), EXPORT_SVG_FILENAME);
		});
	}

	function exportPng(): void {
		withVisibleDiagram((svg) => {
			createPngBlob(svg, signal)
				.then((blob) => {
					// Conversion rejects on abort; this guards a resolve that raced
					// destroy() in the same tick.
					if (signal.aborted) return;
					download(svg.ownerDocument, blob, EXPORT_PNG_FILENAME);
				})
				.catch((err) => {
					if (signal.aborted) return;
					// The notice stays generic; the console carries the cause.
					console.error(err);
					actions.reportIoError("PNG export failed. Try the SVG export instead.");
				});
		});
	}

	return (
		<section class="diagram-panel" aria-labelledby="diagram-heading">
			<header class="diagram-toolbar">
				<h2 id="diagram-heading" class="visually-hidden">
					Diagram
				</h2>
				<div class="diagram-actions">
					<button
						type="button"
						id="display-button"
						aria-label="Appearance"
						title="Appearance"
						class="icon-button"
						aria-haspopup="dialog"
						onClick={(event) => displayDialog.open(event.currentTarget)}
					>
						<Icon id="icon-appearance" />
					</button>
					<button
						type="button"
						id="diagram-export-button"
						aria-label="Export diagram"
						title="Export diagram"
						class="icon-button"
						aria-haspopup="dialog"
						onClick={(event) => diagramExportDialog.open(event.currentTarget)}
					>
						<Icon id="icon-export" />
					</button>
				</div>
			</header>

			<ChoiceDialog
				id="diagram-export-dialog"
				heading="Export diagram"
				handle={diagramExportDialog}
			>
				<ExportOptions
					label="Export diagram format"
					onExportSvg={exportSvg}
					onExportPng={exportPng}
				/>
			</ChoiceDialog>

			<ChoiceDialog id="display-dialog" heading="Appearance" handle={displayDialog}>
				<div class="setting-field">
					<span id="setting-palette-label">Color saturation</span>
					<PaletteSelect
						id="setting-palette"
						value={settings.palette}
						labelledBy="setting-palette-label"
						onSelect={(value) => actions.setDiagramSetting("palette", value)}
					/>
				</div>
				{(
					[
						["linkColor", "Link colors"],
						["alignment", "Node alignment"],
						["aspectRatio", "Aspect ratio"],
					] as const
				).map(([key, label]) => (
					<label class="setting-field" key={key}>
						<span id={`setting-${key}-label`}>{label}</span>
						<select
							aria-labelledby={`setting-${key}-label`}
							value={settings[key]}
							onChange={(event) => {
								const value = event.currentTarget.value;
								// Validate the native control's string against its setting domain.
								const option = SETTING_DOMAINS[key].find((option) => option === value);
								if (option) actions.setDiagramSetting(key, option);
							}}
						>
							{SETTING_DOMAINS[key].map((value) => (
								<option key={value} value={value}>
									{(SETTING_LABELS[key] as Record<string, string>)[value]}
								</option>
							))}
						</select>
					</label>
				))}
			</ChoiceDialog>

			<div id="diagram" ref={diagramRef} style={diagramStyle}>
				<div class="sankey-canvas">
					<SankeySvg diagram={diagram} />
				</div>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: These controls resize the viewport, not a form field. */}
			<div
				id="preview-resizer"
				class="preview-resizer"
				role="group"
				aria-label="Diagram preview size controls"
			>
				<PreviewResizer
					diagramRef={diagramRef}
					aspectRatio={aspectRatio.width / aspectRatio.height}
				/>
			</div>
		</section>
	);
}
