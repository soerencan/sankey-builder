import { useLayoutEffect, useRef } from "preact/hooks";

type RowField = HTMLInputElement | HTMLSelectElement;

export function useRowFocus(rows: readonly { id: string }[], selectNewText = false) {
	const fields = useRef(new Map<string, RowField>());
	const addedAfter = useRef<Set<string> | null>(null);

	useLayoutEffect(() => {
		const previousIds = addedAfter.current;
		addedAfter.current = null;
		if (!previousIds) return;
		const added = rows.find((row) => !previousIds.has(row.id));
		const field = added && fields.current.get(added.id);
		field?.focus();
		if (selectNewText && field instanceof HTMLInputElement) field.select();
	});

	return {
		fieldRef: (id: string) => (field: RowField | null) => {
			if (field) fields.current.set(id, field);
			else fields.current.delete(id);
		},
		addRow(add: () => void) {
			addedAfter.current = new Set(rows.map((row) => row.id));
			add();
		},
	};
}
