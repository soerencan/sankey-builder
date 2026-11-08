import {
	Contrast,
	Download,
	GripHorizontal,
	GripVertical,
	Minus,
	Moon,
	Plus,
	Settings,
	Sun,
	Trash2,
	Upload,
	X,
} from "lucide-preact";

// Explicit imports keep the rest of Lucide's catalog out of the bundle.
const ICONS = {
	"icon-theme-system": Contrast,
	"icon-theme-light": Sun,
	"icon-theme-dark": Moon,
	"icon-import": Upload,
	"icon-export": Download,
	"icon-appearance": Settings,
	"icon-minus": Minus,
	"icon-plus": Plus,
	"icon-close": X,
	"icon-delete": Trash2,
	"icon-grip-horizontal": GripHorizontal,
	"icon-grip-vertical": GripVertical,
} as const;

export type IconId = keyof typeof ICONS;

export function Icon({ id }: { id: IconId }) {
	const IconComponent = ICONS[id];
	return (
		<IconComponent
			class={`icon ${id}`}
			size={20}
			strokeWidth={2}
			aria-hidden="true"
			focusable="false"
		/>
	);
}
