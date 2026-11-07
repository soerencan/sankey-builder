import type { RefObject } from "preact";
import type { DiagramSettingKey, Settings } from "../../model/settings";
import { SETTING_DOMAINS } from "../../model/settings";
import { ChoiceDialog } from "../../shared/choice-dialog";
import type { AccessibleName } from "../../shared/choice-group";
import { Icon } from "../../shared/icon";
import type { IoNoticeActions } from "../../shared/notice";
import { useDialog } from "../../shared/use-dialog";
import { download } from "../files/download";
import { PaletteChoices, SwatchStrip } from "../settings/choices";
import { SETTING_LABELS } from "../settings/options";
import { createPngBlob, createSvgBlob } from "./export";

const EXPORT_SVG_FILENAME = "sankey.svg";
const EXPORT_PNG_FILENAME = "sankey.png";

export interface DiagramPanelActions extends IoNoticeActions {
	setDiagramSetting<K extends DiagramSettingKey>(key: K, value: Settings[K]): void;
}

export interface DiagramPanelProps {
	/** A ref, not the element: #diagram is a sibling in App's tree, so it exists only after commit. Read it from event handlers, never during render. */
	diagramRef: RefObject<HTMLElement>;
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

export function DiagramPanel({ diagramRef, settings, actions, signal }: DiagramPanelProps) {
	const paletteDialog = useDialog();
	const diagramExportDialog = useDialog();
	const displayDialog = useDialog();

	function cyclePalette(step: 1 | -1): void {
		const palettes = SETTING_DOMAINS.palette;
		const current = palettes.indexOf(settings.palette);
		const next = (current + step + palettes.length) % palettes.length;
		actions.setDiagramSetting("palette", palettes[next]);
	}

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
		<>
			<header class="diagram-toolbar">
				<h2 id="diagram-heading" class="visually-hidden">
					Diagram
				</h2>
				<button
					type="button"
					class="toolbar-button"
					aria-label="Previous palette"
					onClick={() => cyclePalette(-1)}
				>
					<Icon id="icon-chevron-left" />
				</button>
				<button
					type="button"
					id="palette-preview"
					class="toolbar-button"
					aria-haspopup="dialog"
					aria-label={`Palette: ${SETTING_LABELS.palette[settings.palette]}`}
					onClick={(event) => paletteDialog.open(event.currentTarget)}
				>
					<SwatchStrip palette={settings.palette} />
				</button>
				<button
					type="button"
					class="toolbar-button"
					aria-label="Next palette"
					onClick={() => cyclePalette(1)}
				>
					<Icon id="icon-chevron-right" />
				</button>
				<div class="diagram-actions">
					<button
						type="button"
						id="display-button"
						aria-label="Appearance"
						title="Appearance"
						class="action-button"
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
						class="action-button"
						aria-haspopup="dialog"
						onClick={(event) => diagramExportDialog.open(event.currentTarget)}
					>
						<Icon id="icon-export" />
					</button>
				</div>
			</header>

			<ChoiceDialog id="palette-dialog" heading="Palette" handle={paletteDialog}>
				<PaletteChoices
					value={settings.palette}
					label="Palette"
					onSelect={(value) => {
						actions.setDiagramSetting("palette", value);
						paletteDialog.close();
					}}
				/>
			</ChoiceDialog>

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
				{(
					[
						["alignment", "Node alignment"],
						["aspectRatio", "Aspect ratio"],
						["linkColor", "Link colors"],
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
		</>
	);
}
