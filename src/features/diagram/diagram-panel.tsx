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
// Hidpi-crisp output (1920x960 at the diagram's 960x480 base size) without
// making the caller reason about canvas pixel math.
const PNG_EXPORT_SCALE = 2;

// Number of swatches shown per strip — matches the five named palettes'
// meaningful prefix; palettes with more entries (e.g. category10's 10) are
// truncated to keep the preview/dialog rows a consistent width.
const SWATCH_COUNT = 5;

// ChoiceGroup option lists, one per closed setting domain. Runtime iteration
// order (source, source-target, target, static for link color) is the
// dialogs' display order, which is each metadata table's own declaration
// order in options.ts/settings.ts.
const PALETTE_CHOICES = PALETTE_ORDER.map((value) => ({ value }));
const LINK_COLOR_CHOICES = Object.entries(LINK_COLOR_OPTIONS).map(([value, option]) => ({
	value: value as LinkColorMode,
	...option,
}));

/**
 * A CSS-safe modifier class per aspect ratio — style.css sets each preset's
 * own aspect-ratio on it. A colon is valid in a class selector only when
 * escaped, so each class swaps ":" for "-" rather than relying on that
 * escaping. A `Record`, not a string-munging function, so adding an
 * `AspectRatio` value without a matching entry here is a compile error.
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
	/**
	 * The #diagram host: SankeyCanvas's mount point and the SVG/PNG export
	 * source. A ref, not the element directly: App renders #diagram and this
	 * component as siblings in one tree, so the element only exists once the
	 * whole tree has committed — read only from the export handlers below,
	 * never during render.
	 */
	diagramRef: RefObject<HTMLElement>;
	settings: Readonly<Settings>;
	actions: DiagramPanelActions;
	/** The owning app instance's AbortSignal — guards PNG rasterization. */
	signal: AbortSignal;
}

/** An accessible name comes from a visible label (aria-label) or a heading elsewhere in the DOM (aria-labelledby) — never both, never neither. Mirrors ChoiceGroup's own label/labelledBy split. */
type ExportOptionsAccessibleName =
	| { label: string; labelledBy?: undefined }
	| { label?: undefined; labelledBy: string };

type ExportOptionsProps = {
	onExportSvg(): void;
	onExportPng(): void;
	svgButtonId?: string;
	pngButtonId?: string;
} & ExportOptionsAccessibleName;

/**
 * The SVG/PNG export pair, shared by the wide export dialog and the narrow
 * display sheet's copy. Not a ChoiceGroup: these are one-shot actions, not a
 * persisted choice, so there is no aria-pressed/current value — just the two
 * buttons under one accessible group name, owning this file's other
 * role="group" suppression.
 */
function ExportOptions({
	onExportSvg,
	onExportPng,
	svgButtonId,
	pngButtonId,
	label,
	labelledBy,
}: ExportOptionsProps) {
	return (
		<div
			class="export-options"
			// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — a labelled pair of one-shot export actions, not a submittable form control.
			role="group"
			aria-label={label}
			aria-labelledby={labelledBy}
		>
			<button type="button" id={svgButtonId} onClick={onExportSvg}>
				SVG
			</button>
			<button type="button" id={pngButtonId} onClick={onExportPng}>
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
				.map((color, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length decorative strip, never reordered or edited in place.
					<span key={index} class="swatch" style={{ backgroundColor: color }} />
				))}
		</span>
	);
}

/**
 * Grabs the on-screen diagram svg and serializes it (see serializeDiagramSvg
 * for why: explicit dimensions, resolved colors, opaque background), shared
 * by both the SVG and PNG export handlers below. Exports whatever is on
 * screen: when state is topologically invalid, the controller keeps the
 * last-valid diagram visible — exporting that stale render is deliberate
 * ("export what you see"), not an oversight. Returns the live svg alongside
 * its serialized xml (exportPng needs the former's viewBox, the latter to
 * rasterize) so callers never re-query or re-cast it. Returns null (after
 * reporting the error) when there's nothing to export.
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
	// Read resolved colors from the live page (theme-aware): currentColor's
	// on-screen resolution for labels, and the diagram container's own
	// background — both would otherwise default to black/transparent once
	// the svg is detached from the page. svgEl.parentElement is the
	// SankeyCanvas host (.sankey-canvas, nested inside diagramEl), since
	// renderDiagram appends the svg directly into it.
	const labelColor = getComputedStyle(svgEl).color;
	const background = getComputedStyle(svgEl.parentElement as Element).backgroundColor;
	return { svg: svgEl, xml: serializeDiagramSvg(svgEl, { labelColor, background }) };
}

/**
 * The whole diagram panel's toolbar/dialogs — palette carousel, link-color
 * and alignment controls, aspect ratio, and SVG/PNG export — generated from
 * settings.ts/options.ts metadata rather than duplicated per-option markup.
 * `SankeyCanvas` and `PreviewResizer` are App's own siblings of this
 * component, all sharing the `diagramRef` App owns (see app.tsx): this
 * component owns only the controls/dialogs portion of the panel.
 */
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
					// A stale completion (this app instance destroyed while rasterizing)
					// must do nothing user-visible. rasterizeSvg itself already rejects
					// on abort, so this only guards a resolve that raced destroy() in
					// the same tick.
					if (signal.aborted) return;
					download(diagramEl.ownerDocument, blob, EXPORT_PNG_FILENAME);
				})
				.catch((err) => {
					if (signal.aborted) return;
					// The notice stays generic; log the specific cause so a field report
					// ("PNG export failed") is diagnosable from the console.
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
					svgButtonId="export-svg-button"
					pngButtonId="export-png-button"
					onExportSvg={() => exportSvg(diagramExportDialog)}
					onExportPng={() => exportPng(diagramExportDialog)}
				/>
			</ChoiceDialog>

			{/* Narrow-toolbar equivalent of the wide Links button + align-group
			    above: COPIES of the same options, not new ids on them, so the
			    same `actions` callbacks cover both. Unlike the other dialogs,
			    choosing a link-color/alignment/aspect-ratio option here does NOT
			    close the dialog — the diagram updates live behind it and the user
			    dismisses it explicitly (Close, backdrop, Escape). Its SVG/PNG
			    export buttons are the exception: they DO close it, matching the
			    wide export dialog above. */}
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
