import {
	ChevronLeft,
	ChevronRight,
	Contrast,
	Download,
	Minus,
	Moon,
	Plus,
	RotateCcw,
	Settings,
	Sun,
	Upload,
	X,
} from "lucide-preact";

// Explicit imports keep the rest of Lucide's catalog out of the bundle.
const ICONS = {
	"icon-chevron-left": ChevronLeft,
	"icon-chevron-right": ChevronRight,
	"icon-theme-system": Contrast,
	"icon-theme-light": Sun,
	"icon-theme-dark": Moon,
	"icon-import": Upload,
	"icon-export": Download,
	"icon-appearance": Settings,
	"icon-minus": Minus,
	"icon-plus": Plus,
	"icon-close": X,
	"icon-reset": RotateCcw,
} as const;

export type IconId = keyof typeof ICONS;

export function Icon({ id }: { id: IconId }) {
	const IconComponent = ICONS[id];
	return (
		<IconComponent
			class={`icon ${id}`}
			size={24}
			strokeWidth={2}
			aria-hidden="true"
			focusable="false"
		/>
	);
}
