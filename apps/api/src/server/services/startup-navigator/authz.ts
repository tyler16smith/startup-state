import type { ApiContext } from "~/server/api-context";
import { createApiError } from "~/server/api-context";

export async function getCurrentUser(ctx: ApiContext) {
	if (!ctx.userId) return null;

	return ctx.db.user.findUnique({
		where: { id: ctx.userId },
		select: { id: true, email: true, name: true, role: true },
	});
}

export async function requireAdmin(ctx: ApiContext) {
	const user = await getCurrentUser(ctx);
	if (!user || user.role !== "ADMIN") {
		throw createApiError("Admin access required", 403);
	}

	return user;
}

export async function requireCompanyEditor(ctx: ApiContext, companyId: string) {
	const user = await getCurrentUser(ctx);
	if (!user) throw createApiError("Unauthorized", 401);
	if (user.role === "ADMIN") return user;

	const ownership = await ctx.db.companyOwner.findUnique({
		where: { companyId_userId: { companyId, userId: user.id } },
		select: { id: true },
	});

	if (!ownership) throw createApiError("Company owner access required", 403);
	return user;
}
