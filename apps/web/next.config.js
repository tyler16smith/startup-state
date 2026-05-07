/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	async rewrites() {
		// In development, proxy /api/v1/* to localhost:3001 to avoid CORS
		// In production, client uses absolute URLs (NEXT_PUBLIC_API_URL)
		if (process.env.NODE_ENV === "development") {
			return [
				{
					source: "/api/v1/:path*",
					destination: "http://localhost:3001/api/v1/:path*",
				},
				{
					source: "/api/resources/:path*",
					destination: "http://localhost:3001/api/resources/:path*",
				},
				{
					source: "/api/companies/:path*",
					destination: "http://localhost:3001/api/companies/:path*",
				},
				{
					source: "/api/admin/:path*",
					destination: "http://localhost:3001/api/admin/:path*",
				},
			];
		}
		return [];
	},
};

export default config;
