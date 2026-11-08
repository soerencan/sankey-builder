import { Icon } from "./icon";

export type NoticeKind = "graph" | "storage" | "io";
export type NoticeTone = "warning" | "error";

export interface Notice {
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
	notices: Partial<Record<NoticeKind, Notice>>;
	/** Only the I/O notice is dismissable: the other two describe a condition that is still true. */
	dismissIo(): void;
}

/**
 * Every slot renders unconditionally (empty ones collapse via CSS `:empty`)
 * so each live region exists for assistive tech before it has content, and
 * the ids stay stable for tests.
 */
export function NoticeRegion({ notices, dismissIo }: NoticeRegionProps) {
	return (
		<div class="notice-region">
			{NOTICE_ORDER.map((kind) => {
				const notice = notices[kind];
				return (
					// A status message is not a form calculation result, so output would give it the wrong meaning.
					<div
						key={kind}
						id={NOTICE_ID[kind]}
						role="status"
						aria-live="polite"
						class={notice ? `notice-${notice.tone}` : undefined}
					>
						{notice?.message ?? ""}
						{kind === "io" && notice && (
							<button
								type="button"
								class="icon-button notice-dismiss"
								aria-label="Dismiss"
								onClick={dismissIo}
							>
								<Icon id="icon-close" />
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}
