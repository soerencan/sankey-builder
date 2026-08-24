/**
 * `NoticeRegion`'s prop element type (see shared/notice.tsx). The controller
 * (start-app.tsx) derives at most one `Notice` per `kind` and hands the
 * active set to `App` on every render.
 */
export type NoticeKind = "graph" | "storage" | "io";
export type NoticeTone = "info" | "warning" | "error";

export interface Notice {
	readonly kind: NoticeKind;
	readonly tone: NoticeTone;
	readonly message: string;
}

/**
 * The shared io-notice contract behind DataPanelActions and
 * DiagramPanelActions: starting a new import or export attempt clears any
 * notice left by a previous one, and each panel reports failures in its own
 * shape of operation. One controller object (start-app.tsx's
 * ioNoticeActions) implements every member; each panel's action object picks
 * only the ones its own controls call.
 */
export interface IoNoticeActions {
	clearIoNotice(): void;
	reportImportError(message: string): void;
	reportExportError(message: string): void;
}
