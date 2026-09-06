export type NoticeKind = "graph" | "storage" | "io";
export type NoticeTone = "warning" | "error";

export interface Notice {
	readonly kind: NoticeKind;
	readonly tone: NoticeTone;
	readonly message: string;
}

/** Starting a new import or export clears the previous attempt's notice. */
export interface IoNoticeActions {
	clearIoNotice(): void;
	reportIoError(message: string): void;
}

const NOTICE_ORDER: readonly NoticeKind[] = ["graph", "storage", "io"];

const NOTICE_ID: Record<NoticeKind, string> = {
	graph: "error",
	storage: "storage-notice",
	io: "io-notice",
};

export interface NoticeRegionProps {
	notices: readonly Notice[];
}

/**
 * Every slot renders unconditionally (empty ones collapse via CSS `:empty`)
 * so each live region exists for assistive tech before it has content, and
 * the ids stay stable for tests.
 */
export function NoticeRegion({ notices }: NoticeRegionProps) {
	return (
		<div class="notice-region">
			{NOTICE_ORDER.map((kind) => {
				const notice = notices.find((candidate) => candidate.kind === kind);
				return (
					<div
						key={kind}
						id={NOTICE_ID[kind]}
						// biome-ignore lint/a11y/useSemanticElements: <output> represents the result of a form calculation, not an arbitrary status message, so role="status" on a plain <div> is the correct match here.
						role="status"
						aria-live="polite"
						class={notice ? `notice-${notice.tone}` : undefined}
					>
						{notice?.message ?? ""}
					</div>
				);
			})}
		</div>
	);
}
