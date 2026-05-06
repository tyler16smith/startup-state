import { Prisma } from "../../../../generated/prisma";
import { db } from "../../db";
import { findDemoSession } from "./demo-session.service";

interface UiState {
	noticeDismissed?: boolean;
}

export async function resetDemoOverlay(sessionKey: string) {
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { uiStateJson: Prisma.DbNull },
	});
}

export async function getUiState(sessionKey: string): Promise<UiState> {
	const session = await findDemoSession(sessionKey);
	if (!session) return {};
	return (session.uiStateJson as UiState | null) ?? {};
}

export async function updateUiState(
	sessionKey: string,
	patch: Partial<UiState>,
) {
	const current = await getUiState(sessionKey);
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { uiStateJson: { ...current, ...patch } as object },
	});
}

export async function hasUnsavedChanges(_sessionKey: string): Promise<boolean> {
	return false;
}
