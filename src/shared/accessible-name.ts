export type AccessibleName =
	| { label: string; labelledBy?: undefined }
	| { label?: undefined; labelledBy: string };
