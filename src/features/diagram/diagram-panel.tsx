import type { RefObject } from "preact";
import type { IoNoticeActions } from "../../app/notices";
import type {
	Alignment,
	AspectRatio,
	LinkColorMode,
	Palette,
	Settings,
} from "../../model/settings";
import { ASPECT_RATIO_OPTIONS, PALETTE_ORDER } from "../../model/settings";
import type { DialogHandle } from "../../shared/use-dialog";
import { useDialog } from "../../shared/use-dialog";
import { download } from "../files/download";
import {
	ALIGNMENT_OPTIONS,
	ASPECT_RATIO_LABELS,
	LINK_COLOR_OPTIONS,
	PALETTE_LABELS,
} from "../settings/options";
import type { LinkColorOptionMeta } from "../settings/options";
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

// Runtime iteration order (source, source-target, target, static) is the
// dialog's display order, which is LINK_COLOR_OPTIONS's own declaration order.
const LINK_COLOR_ENTRIES = Object.entries(LINK_COLOR_OPTIONS) as [
	LinkColorMode,
	LinkColorOptionMeta,
][];

export interface DiagramPanelActions
	extends Pick<IoNoticeActions, "clearIoNotice" | "reportExportError"> {
	setPalette(value: Palette): void;
	setLinkColor(value: LinkColorMode): void;
	setAlignment(value: Alignment): void;
	setAspectRatio(value: AspectRatio): void;
}

export interface DiagramPanelProps {
	doc: Document;
	win: Window;
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
 * A realm-safe stand-in for `instanceof SVGSVGElement`. Only the root `<svg>`
 * element has this exact tag name; nothing downstream needs an SVG-specific
 * API (serializeDiagramSvg/svgViewBoxSize only call generic Element/Node
 * methods), so tagName alone is enough to duck-type it.
 */
function isSvgSvgElement(target: Element | null): target is SVGSVGElement {
	return !!target && target.tagName === "svg";
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
	win: Window,
	actions: DiagramPanelActions,
): { svg: SVGSVGElement; xml: string } | null {
	const svgEl = diagramEl.querySelector("svg");
	if (!isSvgSvgElement(svgEl)) {
		actions.reportExportError("Nothing to export — the diagram is empty.");
		return null;
	}
	// Read resolved colors from the live page (theme-aware): currentColor's
	// on-screen resolution for labels, and the diagram container's own
	// background — both would otherwise default to black/transparent once
	// the svg is detached from the page. svgEl.parentElement is the
	// SankeyCanvas host (.sankey-canvas, nested inside diagramEl), since
	// renderDiagram appends the svg directly into it.
	const labelColor = win.getComputedStyle(svgEl).color;
	const background = win.getComputedStyle(svgEl.parentElement as Element).backgroundColor;
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
export function DiagramPanel({
	doc,
	win,
	diagramRef,
	settings,
	actions,
	signal,
}: DiagramPanelProps) {
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
		const result = serializeVisibleDiagram(diagramEl, win, actions);
		if (result) {
			download(doc, win, new Blob([result.xml], { type: "image/svg+xml" }), EXPORT_SVG_FILENAME);
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
		const result = serializeVisibleDiagram(diagramEl, win, actions);
		if (result) {
			const { width, height } = svgViewBoxSize(result.svg);
			rasterizeSvg(doc, win, result.xml, width, height, PNG_EXPORT_SCALE, signal)
				.then((blob) => {
					// A stale completion (this app instance destroyed while rasterizing)
					// must do nothing user-visible. rasterizeSvg itself already rejects
					// on abort, so this only guards a resolve that raced destroy() in
					// the same tick.
					if (signal.aborted) return;
					download(doc, win, blob, EXPORT_PNG_FILENAME);
				})
				.catch((err) => {
					if (signal.aborted) return;
					// The notice stays generic; log the specific cause so a field report
					// ("PNG export failed") is diagnosable from the console.
					console.error(err);
					actions.reportExportError("PNG export failed. Try the SVG export instead.");
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
					data-action="palette-prev"
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
					data-action="open-palette-dialog"
					aria-haspopup="dialog"
					aria-label={`Palette: ${PALETTE_LABELS[settings.palette]}`}
					onClick={(event) => paletteDialog.open(event.currentTarget)}
				>
					<SwatchStrip palette={settings.palette} />
				</button>
				<button
					type="button"
					class="toolbar-button"
					data-action="palette-next"
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
						data-action="open-links-dialog"
						aria-haspopup="dialog"
						aria-label={`Links: ${LINK_COLOR_OPTIONS[settings.linkColor].label}`}
						onClick={(event) => linksDialog.open(event.currentTarget)}
					>
						Links
						<svg class="icon" aria-hidden="true" focusable="false">
							<use href={`#${LINK_COLOR_OPTIONS[settings.linkColor].iconId}`} />
						</svg>
					</button>
					<div
						// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
						role="group"
						aria-label="Alignment"
						class="align-group"
					>
						{ALIGNMENT_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								class="align-option"
								data-action="set-alignment"
								data-value={option.value}
								aria-pressed={settings.alignment === option.value}
								aria-label={option.label}
								onClick={() => actions.setAlignment(option.value)}
							>
								<svg class="icon" aria-hidden="true" focusable="false">
									<use href={`#${option.iconId}`} />
								</svg>
							</button>
						))}
					</div>
					<button
						type="button"
						id="aspect-ratio-button"
						class="toolbar-button"
						data-action="open-aspect-ratio-dialog"
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
						data-action="open-diagram-export-dialog"
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
					data-action="open-display-dialog"
					aria-haspopup="dialog"
					onClick={(event) => displayDialog.open(event.currentTarget)}
				>
					<svg class="icon" aria-hidden="true" focusable="false">
						<use href="#icon-display" />
					</svg>
					Diagram
				</button>
			</header>

			<dialog id="palette-dialog" ref={paletteDialog.ref} aria-labelledby="palette-dialog-heading">
				<h3 id="palette-dialog-heading">Palette</h3>
				<div
					class="palette-options"
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-label="Palette"
				>
					{PALETTE_ORDER.map((value) => (
						<button
							key={value}
							type="button"
							class="palette-option"
							data-action="set-palette"
							data-value={value}
							aria-pressed={settings.palette === value}
							onClick={() => {
								actions.setPalette(value);
								paletteDialog.close();
							}}
						>
							<span class="palette-option-label">{PALETTE_LABELS[value]}</span>
							<SwatchStrip palette={value} />
						</button>
					))}
				</div>
				<button type="button" class="dialog-close" data-action="close-dialog">
					Close
				</button>
			</dialog>

			<dialog id="links-dialog" ref={linksDialog.ref} aria-labelledby="links-dialog-heading">
				<h3 id="links-dialog-heading">Link colors</h3>
				<div
					class="choice-options"
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-label="Link colors"
				>
					{LINK_COLOR_ENTRIES.map(([value, option]) => (
						<button
							key={value}
							type="button"
							class="choice-option"
							data-action="set-link-color"
							data-value={value}
							aria-pressed={settings.linkColor === value}
							onClick={() => {
								actions.setLinkColor(value);
								linksDialog.close();
							}}
						>
							<svg class="icon" aria-hidden="true" focusable="false">
								<use href={`#${option.iconId}`} />
							</svg>
							<span class="choice-option-label">{option.label}</span>
						</button>
					))}
				</div>
				<button type="button" class="dialog-close" data-action="close-dialog">
					Close
				</button>
			</dialog>

			<dialog
				id="aspect-ratio-dialog"
				ref={aspectRatioDialog.ref}
				aria-labelledby="aspect-ratio-dialog-heading"
			>
				<h3 id="aspect-ratio-dialog-heading">Aspect ratio</h3>
				<div
					class="choice-options aspect-ratio-options"
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-label="Aspect ratio"
				>
					{ASPECT_RATIO_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							class="choice-option"
							data-action="set-aspect-ratio"
							data-value={option.value}
							aria-pressed={settings.aspectRatio === option.value}
							onClick={() => {
								actions.setAspectRatio(option.value);
								aspectRatioDialog.close();
							}}
						>
							<span class="ratio-preview" aria-hidden="true" />
							<span class="choice-option-label">{ASPECT_RATIO_LABELS[option.value]}</span>
						</button>
					))}
				</div>
				<button type="button" class="dialog-close" data-action="close-dialog">
					Close
				</button>
			</dialog>

			<dialog
				id="diagram-export-dialog"
				ref={diagramExportDialog.ref}
				aria-labelledby="diagram-export-dialog-heading"
			>
				<h3 id="diagram-export-dialog-heading">Export diagram</h3>
				<div
					class="export-options"
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-label="Export diagram format"
				>
					<button
						type="button"
						id="export-svg-button"
						data-action="export-svg"
						onClick={() => exportSvg(diagramExportDialog)}
					>
						SVG
					</button>
					<button
						type="button"
						id="export-png-button"
						data-action="export-png"
						onClick={() => exportPng(diagramExportDialog)}
					>
						PNG
					</button>
				</div>
				<button type="button" class="dialog-close" data-action="close-dialog">
					Close
				</button>
			</dialog>

			{/* Narrow-toolbar equivalent of the wide Links button + .align-group
			    above: same data-actions (COPIES, not new ids on the options), so
			    the same `actions` callbacks cover both. Unlike the other dialogs,
			    choosing a link-color/alignment/aspect-ratio option here does NOT
			    close the dialog — the diagram updates live behind it and the user
			    dismisses it explicitly (Close, backdrop, Escape). Its SVG/PNG
			    export buttons are the exception: they DO close it, matching the
			    wide export dialog above. */}
			<dialog id="display-dialog" ref={displayDialog.ref} aria-labelledby="display-dialog-heading">
				<h3 id="display-dialog-heading">Diagram</h3>
				<div
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-labelledby="display-link-colors-heading"
				>
					<h4 id="display-link-colors-heading">Link colors</h4>
					<div class="choice-options">
						{LINK_COLOR_ENTRIES.map(([value, option]) => (
							<button
								key={value}
								type="button"
								class="choice-option"
								data-action="set-link-color"
								data-value={value}
								aria-pressed={settings.linkColor === value}
								onClick={() => actions.setLinkColor(value)}
							>
								<svg class="icon" aria-hidden="true" focusable="false">
									<use href={`#${option.iconId}`} />
								</svg>
								<span class="choice-option-label">{option.shortLabel}</span>
							</button>
						))}
					</div>
				</div>
				<div
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-labelledby="display-alignment-heading"
				>
					<h4 id="display-alignment-heading">Alignment</h4>
					<div class="choice-options">
						{ALIGNMENT_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								class="choice-option"
								data-action="set-alignment"
								data-value={option.value}
								aria-pressed={settings.alignment === option.value}
								onClick={() => actions.setAlignment(option.value)}
							>
								<svg class="icon" aria-hidden="true" focusable="false">
									<use href={`#${option.iconId}`} />
								</svg>
								<span class="choice-option-label">{option.label}</span>
							</button>
						))}
					</div>
				</div>
				<div
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-labelledby="display-aspect-ratio-heading"
				>
					<h4 id="display-aspect-ratio-heading">Aspect ratio</h4>
					<div
						class="choice-options aspect-ratio-options"
						// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
						role="group"
						aria-labelledby="display-aspect-ratio-heading"
					>
						{ASPECT_RATIO_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								class="choice-option"
								data-action="set-aspect-ratio"
								data-value={option.value}
								aria-pressed={settings.aspectRatio === option.value}
								onClick={() => actions.setAspectRatio(option.value)}
							>
								<span class="ratio-preview" aria-hidden="true" />
								<span class="choice-option-label">{ASPECT_RATIO_LABELS[option.value]}</span>
							</button>
						))}
					</div>
				</div>
				<div
					// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-labelledby="display-export-heading"
				>
					<h4 id="display-export-heading">Export diagram</h4>
					<div class="export-options">
						<button type="button" data-action="export-svg" onClick={() => exportSvg(displayDialog)}>
							SVG
						</button>
						<button type="button" data-action="export-png" onClick={() => exportPng(displayDialog)}>
							PNG
						</button>
					</div>
				</div>
				<button type="button" class="dialog-close" data-action="close-dialog">
					Close
				</button>
			</dialog>
		</>
	);
}
