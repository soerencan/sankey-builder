import type { RefObject } from "preact";
import type { DiagramSettingKey, Settings } from "../../model/settings";
import { SETTING_DOMAINS } from "../../model/settings";
import { ChoiceDialog } from "../../shared/choice-dialog";
import type { AccessibleName } from "../../shared/choice-group";
import { Icon } from "../../shared/icon";
import type { IoNoticeActions } from "../../shared/notice";
import type { DialogHandle } from "../../shared/use-dialog";
import { useDialog } from "../../shared/use-dialog";
import { download } from "../files/download";
import { PaletteChoices, SwatchStrip } from "../settings/choices";
import { SETTING_LABELS } from "../settings/options";
import { rasterizeSvg, serializeDiagramSvg, svgViewBoxSize } from "./export";

const EXPORT_SVG_FILENAME = "sankey.svg";
const EXPORT_PNG_FILENAME = "sankey.png";
// 2x for hidpi-crisp output.
const PNG_EXPORT_SCALE = 2;

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
		<div
			class="export-options"
			// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — a labelled pair of one-shot export actions, not a submittable form control.
			role="group"
			aria-label={label}
			aria-labelledby={labelledBy}
		>
			<button type="button" class="choice-option" onClick={onExportSvg}>
				SVG — Scalable vector
			</button>
			<button type="button" class="choice-option" onClick={onExportPng}>
				PNG — High-resolution image
			</button>
		</div>
	);
}

type SerializedDiagram = { svg: SVGSVGElement; xml: string };

/**
 * Exports what is on screen: while the state is invalid the controller keeps
 * the last-valid diagram visible, and exporting that is deliberate.
 */
function serializeVisibleDiagram(
	diagramEl: HTMLElement,
	actions: DiagramPanelActions,
): SerializedDiagram | null {
	const svgEl = diagramEl.querySelector("svg");
	if (!svgEl) {
		actions.reportIoError("Nothing to export — the diagram is empty.");
		return null;
	}
	// Detached from the page, currentColor and the background would resolve
	// to black and transparent; the .sankey-canvas host carries the theme's
	// background.
	const labelColor = getComputedStyle(svgEl).color;
	const background = getComputedStyle(svgEl.parentElement as Element).backgroundColor;
	return { svg: svgEl, xml: serializeDiagramSvg(svgEl, { labelColor, background }) };
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

	/** `fn` runs only when there is something to export; the dialog closes either way. */
	function withVisibleDiagram(
		dialog: DialogHandle,
		fn: (diagramEl: HTMLElement, result: SerializedDiagram) => void,
	): void {
		actions.clearIoNotice();
		const diagramEl = diagramRef.current;
		if (diagramEl) {
			const result = serializeVisibleDiagram(diagramEl, actions);
			if (result) fn(diagramEl, result);
		}
		dialog.close();
	}

	function exportSvg(dialog: DialogHandle): void {
		withVisibleDiagram(dialog, (diagramEl, result) => {
			download(
				diagramEl.ownerDocument,
				new Blob([result.xml], { type: "image/svg+xml" }),
				EXPORT_SVG_FILENAME,
			);
		});
	}

	function exportPng(dialog: DialogHandle): void {
		withVisibleDiagram(dialog, (diagramEl, result) => {
			const { width, height } = svgViewBoxSize(result.svg);
			rasterizeSvg(result.xml, width, height, PNG_EXPORT_SCALE, signal)
				.then((blob) => {
					// rasterizeSvg rejects on abort; this guards a resolve that raced
					// destroy() in the same tick.
					if (signal.aborted) return;
					download(diagramEl.ownerDocument, blob, EXPORT_PNG_FILENAME);
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
						class="action-button"
						aria-haspopup="dialog"
						onClick={(event) => displayDialog.open(event.currentTarget)}
					>
						Appearance
					</button>
					<button
						type="button"
						id="diagram-export-button"
						class="action-button"
						aria-haspopup="dialog"
						onClick={(event) => diagramExportDialog.open(event.currentTarget)}
					>
						<Icon id="icon-download" />
						Export
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
					onExportSvg={() => exportSvg(diagramExportDialog)}
					onExportPng={() => exportPng(diagramExportDialog)}
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
