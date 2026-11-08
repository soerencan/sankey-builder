/** Exactly one of aria-label or aria-labelledby. */
export type AccessibleName =
	| { label: string; labelledBy?: undefined }
	| { label?: undefined; labelledBy: string };
