"use client";

import { type Dispatch, type SetStateAction, useEffect } from "react";

export function useFullscreenLock(
	isFullscreen: boolean,
	setIsFullscreen: Dispatch<SetStateAction<boolean>>,
) {
	useEffect(() => {
		if (!isFullscreen) return;

		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		function handleKeyDown(event: globalThis.KeyboardEvent) {
			if (event.key === "Escape") setIsFullscreen(false);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = originalOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isFullscreen, setIsFullscreen]);
}
