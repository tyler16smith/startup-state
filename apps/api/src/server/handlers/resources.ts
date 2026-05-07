import { z } from "zod";
import { createApiError } from "~/server/api-context";
import {
	type AuthenticatedContext,
	type PublicHandler,
	withAuth,
	withPublic,
} from "../handler-wrappers";
import { requireAdmin } from "../services/startup-navigator/authz";
import {
	archiveResource,
	createResource,
	getResourceById,
	importResourcesFromCsv,
	recommendResourcesForFounderProfile,
	saveResource,
	searchResources,
	unsaveResource,
	updateResource,
} from "../services/startup-navigator/resources";
import {
	idInputSchema,
	savedResourceInputSchema,
} from "../services/startup-navigator/schemas";

function resourceIdentifier(body: unknown) {
	const input = idInputSchema.parse(body);
	return input.id ?? input.resourceId;
}

export const resources = {
	list: withPublic(async (ctx, body) => {
		return searchResources(ctx.db, body, { userId: ctx.userId });
	}) satisfies PublicHandler,

	adminList: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		return searchResources(ctx.db, body, { admin: true, userId: ctx.userId });
	}),

	adminGet: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const input = idInputSchema.parse(body);
		return getResourceById(
			ctx.db,
			{ id: input.id ?? input.resourceId, slug: input.slug },
			{ admin: true, userId: ctx.userId },
		);
	}),

	get: withPublic(async (ctx, body) => {
		const input = idInputSchema.parse(body);
		return getResourceById(
			ctx.db,
			{ id: input.id ?? input.resourceId, slug: input.slug },
			{ userId: ctx.userId },
		);
	}) satisfies PublicHandler,

	recommend: withPublic(async (ctx, body) => {
		return recommendResourcesForFounderProfile(ctx.db, body, {
			userId: ctx.userId,
			persistProfile: Boolean(ctx.userId),
		});
	}) satisfies PublicHandler,

	save: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = savedResourceInputSchema.parse(body);
		return saveResource(ctx.db, ctx.userId, input.resourceId);
	}),

	unsave: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const resourceId = resourceIdentifier(body);
		if (!resourceId) throw createApiError("Resource id required", 400);
		return unsaveResource(ctx.db, ctx.userId, resourceId);
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		return createResource(ctx.db, body);
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const resourceId = resourceIdentifier(body);
		if (!resourceId) throw createApiError("Resource id required", 400);
		return updateResource(ctx.db, resourceId, body);
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const resourceId = resourceIdentifier(body);
		if (!resourceId) throw createApiError("Resource id required", 400);
		return archiveResource(ctx.db, resourceId);
	}),

	import: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		return importResourcesFromCsv(ctx.db, body);
	}),

	reindex: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const input = z.object({ id: z.string().optional() }).parse(body);
		return { success: true, resourceId: input.id ?? null };
	}),
};
