import { type PublicHandler, withPublic } from "../handler-wrappers";
import { summarizeLandingPage } from "../services/startup-navigator/landing-page-summary";

export const landingPages = {
	summarize: withPublic(async (_ctx, body) => {
		return summarizeLandingPage(body);
	}) satisfies PublicHandler,
};
