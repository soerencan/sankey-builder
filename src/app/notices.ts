/**
 * PLAN.md's "Notice policy" shape — the eventual `NoticeRegion`'s prop type.
 * The controller derives at most one `Notice` per `kind` and, until the
 * consolidated region lands, projects each one as plain text into its own
 * legacy `#error`/`#storage-notice`/`#io-notice` container.
 */
export type NoticeKind = "graph" | "storage" | "io";
export type NoticeTone = "info" | "warning" | "error";

export interface Notice {
	readonly kind: NoticeKind;
	readonly tone: NoticeTone;
	readonly message: string;
}
