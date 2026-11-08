import { useLayoutEffect, useRef } from "preact/hooks";

type RowField = HTMLInputElement | HTMLSelectElement;
type FocusIntent = { kind: "add"; previousIds: Set<string> } | { kind: "delete"; id?: string };

export function useRowFocus(rows: readonly { id: string }[], selectNewText = false) {
	const fields = useRef(new Map<string, RowField>());
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const pendingFocus = useRef<FocusIntent | null>(null);

	useLayoutEffect(() => {
		const intent = pendingFocus.current;
		pendingFocus.current = null;
		if (!intent) return;
		const id =
			intent.kind === "add" ? rows.find((row) => !intent.previousIds.has(row.id))?.id : intent.id;
		const field = id ? fields.current.get(id) : undefined;
		(field ?? addButtonRef.current)?.focus();
		if (intent.kind === "add" && selectNewText && field instanceof HTMLInputElement) field.select();
	});

	return {
		addButtonRef,
		fieldRef: (id: string) => (field: RowField | null) => {
			if (field) fields.current.set(id, field);
			else fields.current.delete(id);
		},
		addRow(add: () => void) {
			pendingFocus.current = { kind: "add", previousIds: new Set(rows.map((row) => row.id)) };
			add();
		},
		deleteRow(id: string, remove: () => void) {
			const index = rows.findIndex((row) => row.id === id);
			pendingFocus.current = { kind: "delete", id: (rows[index + 1] ?? rows[index - 1])?.id };
			remove();
		},
	};
}
