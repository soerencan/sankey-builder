import type { RefObject } from "preact";
import type {
	Alignment,
	AspectRatio,
	LinkColorMode,
	Palette,
	Settings,
} from "../../model/settings";
import { ASPECT_RATIO_OPTIONS, PALETTE_ORDER } from "../../model/settings";
import { ChoiceDialog } from "../../shared/choice-dialog";
import type { AccessibleName } from "../../shared/choice-group";
import { ChoiceGroup } from "../../shared/choice-group";
import type { IoNoticeActions } from "../../shared/notice";
import type { DialogHandle } from "../../shared/use-dialog";
import { useDialog } from "../../shared/use-dialog";
import { download } from "../files/download";
import {
	ALIGNMENT_OPTIONS,
	ASPECT_RATIO_LABELS,
	LINK_COLOR_OPTIONS,
	PALETTE_LABELS,
} from "../settings/options";
import { paletteColors } from "./colors";
import { rasterizeSvg, serializeDiagramSvg, svgViewBoxSize } from "./export";

const EXPORT_SVG_FILENAME = "sankey.svg";
const EXPORT_PNG_FILENAME = "sankey.png";
// 2x for hidpi-crisp output.
const PNG_EXPORT_SCALE = 2;

// Palettes with more colors are truncated so preview and dialog rows keep a
// consistent width.
const SWATCH_COUNT = 5;

// Object.entries order is the dialogs' display order.
const PALETTE_CHOICES = PALETTE_ORDER.map((value) => ({ value }));
const LINK_COLOR_CHOICES = Object.entries(LINK_COLOR_OPTIONS).map(([value, option]) => ({
	value: value as LinkColorMode,
	...option,
}));

/**
 * ":" is swapped for "-" because a colon in a class selector needs escaping.
 * A `Record` rather than a string-munging function so that a new
 * `AspectRatio` without a matching style.css rule is a compile error.
 */
const RATIO_PREVIEW_CLASSES: Record<AspectRatio, string> = {
	"a-series": "ratio-preview-a-series",
	"3:2": "ratio-preview-3-2",
	"16:9": "ratio-preview-16-9",
	"2:1": "ratio-preview-2-1",
	"3:1": "ratio-preview-3-1",
};

export interface DiagramPanelActions extends IoNoticeActions {
	setPalette(value: Palette): void;
	setLinkColor(value: LinkColorMode): void;
	setAlignment(value: Alignment): void;
	setAspectRatio(value: AspectRatio): void;
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

/** Not a ChoiceGroup: these are one-shot actions with no current value to mark. */
function ExportOptions({ onExportSvg, onExportPng, label, labelledBy }: ExportOptionsProps) {
	return (
		<div
			class="export-options"
			// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — a labelled pair of one-shot export actions, not a submittable form control.
			role="group"
			aria-label={label}
			aria-labelledby={labelledBy}
		>
			<button type="button" onClick={onExportSvg}>
				SVG
			</button>
			<button type="button" onClick={onExportPng}>
				PNG
			</button>
		</div>
	);
}

function SwatchStrip({ palette }: { palette: Palette }) {
	return (
		<span class="swatch-strip">
			{paletteColors(palette)
				.slice(0, SWATCH_COUNT)
				.map((color) => (
					<span key={color} class="swatch" style={{ backgroundColor: color }} />
				))}
		</span>
	);
}

/**
 * Exports what is on screen: while the state is invalid the controller keeps
 * the last-valid diagram visible, and exporting that is deliberate.
 */
function serializeVisibleDiagram(
	diagramEl: HTMLElement,
	actions: DiagramPanelActions,
): { svg: SVGSVGElement; xml: string } | null {
	const svgEl = diagramEl.querySelector("svg");
	if (!svgEl) {
		actions.reportIoError("Nothing to export — the diagram is empty.");
		return null;
	}
	// Detached from the page, currentColor and the background would resolve
	// to black and transparent; the SankeyCanvas host carries the theme's
	// background.
	const labelColor = getComputedStyle(svgEl).color;
	const background = getComputedStyle(svgEl.parentElement as Element).backgroundColor;
	return { svg: svgEl, xml: serializeDiagramSvg(svgEl, { labelColor, background }) };
}

export function DiagramPanel({ diagramRef, settings, actions, signal }: DiagramPanelProps) {
	const paletteDialog = useDialog();
	const linksDialog = useDialog();
	const aspectRatioDialog = useDialog();
	const diagramExportDialog = useDialog();
	const displayDialog = useDialog();

	function cyclePalette(step: 1 | -1): void {
		const current = PALETTE_ORDER.indexOf(settings.palette);
		const next = (current + step + PALETTE_ORDER.length) % PALETTE_ORDER.length;
		actions.setPalette(PALETTE_ORDER[next]);
	}

	function exportSvg(dialog: DialogHandle): void {
		actions.clearIoNotice();
		const diagramEl = diagramRef.current;
		if (!diagramEl) {
			dialog.close();
			return;
		}
		const result = serializeVisibleDiagram(diagramEl, actions);
		if (result) {
			download(
				diagramEl.ownerDocument,
				new Blob([result.xml], { type: "image/svg+xml" }),
				EXPORT_SVG_FILENAME,
			);
		}
		dialog.close();
	}

	function exportPng(dialog: DialogHandle): void {
		actions.clearIoNotice();
		const diagramEl = diagramRef.current;
		if (!diagramEl) {
			dialog.close();
			return;
		}
		const result = serializeVisibleDiagram(diagramEl, actions);
		if (result) {
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
		}
		dialog.close();
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
					<svg class="icon" aria-hidden="true" focusable="false">
						<use href="#icon-chevron-left" />
					</svg>
				</button>
				<button
					type="button"
					id="palette-preview"
					class="toolbar-button"
					aria-haspopup="dialog"
					aria-label={`Palette: ${PALETTE_LABELS[settings.palette]}`}
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
					<svg class="icon" aria-hidden="true" focusable="false">
						<use href="#icon-chevron-right" />
					</svg>
				</button>
				<div class="toolbar-wide">
					<button
						type="button"
						id="links-button"
						class="toolbar-button"
						aria-haspopup="dialog"
						aria-label={`Links: ${LINK_COLOR_OPTIONS[settings.linkColor].label}`}
						onClick={(event) => linksDialog.open(event.currentTarget)}
					>
						Links
						<svg class="icon" aria-hidden="true" focusable="false">
							<use href={`#${LINK_COLOR_OPTIONS[settings.linkColor].iconId}`} />
						</svg>
					</button>
					<ChoiceGroup
						options={ALIGNMENT_OPTIONS}
						value={settings.alignment}
						label="Alignment"
						class="align-group"
						optionClass="align-option"
						ariaLabel={(option) => option.label}
						onSelect={(value) => actions.setAlignment(value)}
						renderLabel={(option) => (
							<svg class="icon" aria-hidden="true" focusable="false">
								<use href={`#${option.iconId}`} />
							</svg>
						)}
					/>
					<button
						type="button"
						id="aspect-ratio-button"
						class="toolbar-button"
						aria-haspopup="dialog"
						aria-label={`Aspect ratio: ${ASPECT_RATIO_LABELS[settings.aspectRatio]}`}
						onClick={(event) => aspectRatioDialog.open(event.currentTarget)}
					>
						<span class="aspect-ratio-current">{`Aspect ${ASPECT_RATIO_LABELS[settings.aspectRatio]}`}</span>
					</button>
					<button
						type="button"
						id="diagram-export-button"
						class="toolbar-button"
						aria-haspopup="dialog"
						onClick={(event) => diagramExportDialog.open(event.currentTarget)}
					>
						<svg class="icon" aria-hidden="true" focusable="false">
							<use href="#icon-download" />
						</svg>
						Export
					</button>
				</div>
				<button
					type="button"
					id="display-button"
					class="toolbar-button toolbar-narrow"
					aria-haspopup="dialog"
					onClick={(event) => displayDialog.open(event.currentTarget)}
				>
					<svg class="icon" aria-hidden="true" focusable="false">
						<use href="#icon-display" />
					</svg>
					Diagram
				</button>
			</header>

			<ChoiceDialog id="palette-dialog" heading="Palette" handle={paletteDialog}>
				<ChoiceGroup
					options={PALETTE_CHOICES}
					value={settings.palette}
					label="Palette"
					class="palette-options"
					optionClass="palette-option"
					onSelect={(value) => {
						actions.setPalette(value);
						paletteDialog.close();
					}}
					renderLabel={(option) => (
						<>
							<span class="palette-option-label">{PALETTE_LABELS[option.value]}</span>
							<SwatchStrip palette={option.value} />
						</>
					)}
				/>
			</ChoiceDialog>

			<ChoiceDialog id="links-dialog" heading="Link colors" handle={linksDialog}>
				<ChoiceGroup
					options={LINK_COLOR_CHOICES}
					value={settings.linkColor}
					label="Link colors"
					class="choice-options"
					optionClass="choice-option"
					onSelect={(value) => {
						actions.setLinkColor(value);
						linksDialog.close();
					}}
					renderLabel={(option) => (
						<>
							<svg class="icon" aria-hidden="true" focusable="false">
								<use href={`#${option.iconId}`} />
							</svg>
							<span class="choice-option-label">{option.label}</span>
						</>
					)}
				/>
			</ChoiceDialog>

			<ChoiceDialog id="aspect-ratio-dialog" heading="Aspect ratio" handle={aspectRatioDialog}>
				<ChoiceGroup
					options={ASPECT_RATIO_OPTIONS}
					value={settings.aspectRatio}
					label="Aspect ratio"
					class="choice-options aspect-ratio-options"
					optionClass="choice-option"
					onSelect={(value) => {
						actions.setAspectRatio(value);
						aspectRatioDialog.close();
					}}
					renderLabel={(option) => (
						<>
							<span
								class={`ratio-preview ${RATIO_PREVIEW_CLASSES[option.value]}`}
								aria-hidden="true"
							/>
							<span class="choice-option-label">{ASPECT_RATIO_LABELS[option.value]}</span>
						</>
					)}
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

			{/* Narrow-toolbar copy of the wide controls. Unlike the dialogs above,
			    picking an option here keeps the sheet open so several settings can
			    be adjusted while the diagram updates live behind it; only the
			    export buttons close it. */}
			<ChoiceDialog id="display-dialog" heading="Diagram" handle={displayDialog}>
				<div class="dialog-section">
					<h4 id="display-link-colors-heading">Link colors</h4>
					<ChoiceGroup
						options={LINK_COLOR_CHOICES}
						value={settings.linkColor}
						labelledBy="display-link-colors-heading"
						class="choice-options"
						optionClass="choice-option"
						onSelect={(value) => actions.setLinkColor(value)}
						renderLabel={(option) => (
							<>
								<svg class="icon" aria-hidden="true" focusable="false">
									<use href={`#${option.iconId}`} />
								</svg>
								<span class="choice-option-label">{option.shortLabel}</span>
							</>
						)}
					/>
				</div>

				<div class="dialog-section">
					<h4 id="display-alignment-heading">Alignment</h4>
					<ChoiceGroup
						options={ALIGNMENT_OPTIONS}
						value={settings.alignment}
						labelledBy="display-alignment-heading"
						class="choice-options"
						optionClass="choice-option"
						onSelect={(value) => actions.setAlignment(value)}
						renderLabel={(option) => (
							<>
								<svg class="icon" aria-hidden="true" focusable="false">
									<use href={`#${option.iconId}`} />
								</svg>
								<span class="choice-option-label">{option.label}</span>
							</>
						)}
					/>
				</div>

				<div class="dialog-section">
					<h4 id="display-aspect-ratio-heading">Aspect ratio</h4>
					<ChoiceGroup
						options={ASPECT_RATIO_OPTIONS}
						value={settings.aspectRatio}
						labelledBy="display-aspect-ratio-heading"
						class="choice-options aspect-ratio-options"
						optionClass="choice-option"
						onSelect={(value) => actions.setAspectRatio(value)}
						renderLabel={(option) => (
							<>
								<span
									class={`ratio-preview ${RATIO_PREVIEW_CLASSES[option.value]}`}
									aria-hidden="true"
								/>
								<span class="choice-option-label">{ASPECT_RATIO_LABELS[option.value]}</span>
							</>
						)}
					/>
				</div>

				<div class="dialog-section">
					<h4 id="display-export-heading">Export diagram</h4>
					<ExportOptions
						labelledBy="display-export-heading"
						onExportSvg={() => exportSvg(displayDialog)}
						onExportPng={() => exportPng(displayDialog)}
					/>
				</div>
			</ChoiceDialog>
		</>
	);
}
