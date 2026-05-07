const path = require("node:path");

const webSrcDir = path.resolve(__dirname, "../web/src");

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		typedRoutes: true,
		// Allow importing TypeScript from outside the app directory
		externalDir: true,
	},
	async rewrites() {
		return [
			{
				source: "/api/resources",
				destination: "/api/v1/resources/list",
			},
			{
				source: "/api/resources/search",
				destination: "/api/v1/resources/list",
			},
			{
				source: "/api/resources/recommend",
				destination: "/api/v1/resources/recommend",
			},
			{
				source: "/api/resources/save",
				destination: "/api/v1/resources/save",
			},
			{
				source: "/api/resources/save/:resourceId",
				destination: "/api/v1/resources/unsave?resourceId=:resourceId",
			},
			{
				source: "/api/resources/:id",
				destination: "/api/v1/resources/get?id=:id",
			},
			{
				source: "/api/admin/resources",
				destination: "/api/v1/resources/list?status=:status",
			},
			{
				source: "/api/admin/resources/import",
				destination: "/api/v1/resources/import",
			},
			{
				source: "/api/admin/resources/reindex",
				destination: "/api/v1/resources/reindex",
			},
			{
				source: "/api/admin/resources/:id/reindex",
				destination: "/api/v1/resources/reindex?id=:id",
			},
			{
				source: "/api/admin/resources/:id",
				destination: "/api/v1/resources/update?id=:id",
			},
			{
				source: "/api/companies",
				destination: "/api/v1/companies/list",
			},
			{
				source: "/api/companies/search",
				destination: "/api/v1/companies/list",
			},
			{
				source: "/api/companies/:id/claim",
				destination: "/api/v1/companies/claim?companyId=:id",
			},
			{
				source: "/api/companies/:id",
				destination: "/api/v1/companies/get?id=:id",
			},
			{
				source: "/api/admin/companies",
				destination: "/api/v1/companies/adminList",
			},
			{
				source: "/api/admin/companies/import",
				destination: "/api/v1/companies/import",
			},
			{
				source: "/api/admin/companies/:id",
				destination: "/api/v1/companies/adminUpdate?id=:id",
			},
			{
				source: "/api/admin/claims",
				destination: "/api/v1/companies/claims",
			},
			{
				source: "/api/admin/claims/:id/approve",
				destination: "/api/v1/companies/approveClaim?claimId=:id",
			},
			{
				source: "/api/admin/claims/:id/reject",
				destination: "/api/v1/companies/rejectClaim?claimId=:id",
			},
			{
				source: "/api/v1/household",
				destination: "/api/v1/household/get",
			},
			{
				source: "/api/v1/household/invites/:inviteId/resend",
				destination: "/api/v1/household/resend?inviteId=:inviteId",
			},
			{
				source: "/api/v1/household/invites/:inviteId/revoke",
				destination: "/api/v1/household/revoke?inviteId=:inviteId",
			},
			{
				source: "/api/v1/household/invites/accept",
				destination: "/api/v1/household/accept",
			},
		];
	},
	webpack: (config) => {
		// Add apps/web/src to the module resolution
		config.resolve.alias = {
			...config.resolve.alias,
			"~": webSrcDir,
		};

		// Allow webpack to process TypeScript files from apps/web/src
		const babelRule = config.module.rules.find((rule) =>
			rule.test?.test?.(".tsx"),
		);
		config.module.rules.push({
			test: /\.(tsx?|jsx?)$/,
			include: [webSrcDir],
			use: babelRule?.use,
		});

		return config;
	},
};

module.exports = nextConfig;
