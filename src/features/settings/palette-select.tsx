import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Palette } from "../../model/settings";
import { SwatchStrip } from "./choices";
import { PALETTE_CHOICES, SETTING_LABELS } from "./options";

export interface PaletteSelectProps {
	id: string;
	labelledBy: string;
	value: Palette;
	onSelect(value: Palette): void;
}

export function PaletteSelect({ id, labelledBy, value, onSelect }: PaletteSelectProps) {
	const root = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(value);
	const listId = `${id}-options`;

	function choose(palette: Palette): void {
		onSelect(palette);
		setOpen(false);
	}

	useLayoutEffect(() => {
		if (!open) return;
		const element = root.current;
		const doc = element?.ownerDocument;
		const dialog = element?.closest("dialog");
		function dismiss(event: Event): void {
			if (!element?.contains(event.target as Node)) setOpen(false);
		}
		function close(): void {
			setOpen(false);
		}
		doc?.addEventListener("pointerdown", dismiss);
		doc?.addEventListener("focusin", dismiss);
		dialog?.addEventListener("close", close);
		return () => {
			doc?.removeEventListener("pointerdown", dismiss);
			doc?.removeEventListener("focusin", dismiss);
			dialog?.removeEventListener("close", close);
		};
	}, [open]);

	useLayoutEffect(() => {
		if (open) root.current?.querySelector(`#${id}-${active}`)?.scrollIntoView({ block: "nearest" });
	}, [open, active, id]);

	return (
		<div class="palette-select" ref={root}>
			<button
				id={id}
				ref={trigger}
				type="button"
				class="palette-trigger"
				role="combobox"
				aria-labelledby={labelledBy}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listId}
				aria-activedescendant={open ? `${id}-${active}` : undefined}
				onClick={() => {
					setActive(value);
					setOpen(!open);
				}}
				onKeyDown={(event) => {
					const index = PALETTE_CHOICES.findIndex(
						(option) => option.value === (open ? active : value),
					);
					let next = index;
					switch (event.key) {
						case "Escape":
							if (!open) return;
							setOpen(false);
							break;
						case "Enter":
						case " ":
							if (open) choose(active);
							else {
								setActive(value);
								setOpen(true);
							}
							break;
						case "Tab":
							if (open) choose(active);
							return;
						case "ArrowDown":
							next = open ? Math.min(index + 1, PALETTE_CHOICES.length - 1) : index;
							break;
						case "ArrowUp":
							next = open ? Math.max(index - 1, 0) : index;
							break;
						case "Home":
							next = 0;
							break;
						case "End":
							next = PALETTE_CHOICES.length - 1;
							break;
						default:
							return;
					}
					event.preventDefault();
					event.stopPropagation();
					if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
						setActive(PALETTE_CHOICES[next].value);
						setOpen(true);
					}
				}}
			>
				<span class="visually-hidden">{SETTING_LABELS.palette[value]}</span>
				<SwatchStrip palette={value} />
			</button>
			<div
				id={listId}
				class="palette-options"
				role="listbox"
				aria-labelledby={labelledBy}
				hidden={!open}
			>
				{PALETTE_CHOICES.map((option) => (
					<button
						key={option.value}
						id={`${id}-${option.value}`}
						type="button"
						class="palette-option"
						role="option"
						tabIndex={-1}
						aria-label={option.label}
						aria-selected={value === option.value}
						data-active={open && active === option.value}
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => {
							choose(option.value);
							trigger.current?.focus();
						}}
					>
						<SwatchStrip palette={option.value} />
						<span class="selection-indicator" aria-hidden="true">
							{value === option.value ? "✓" : ""}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
