import {
	type ApiContext,
	requireAuthenticated,
	requireDemoOrAuthenticated,
} from "./api-context";

/**
 * Context with guaranteed userId - used by auth-required handlers.
 * isDemoMode is always false.
 */
export type AuthenticatedContext = Omit<ApiContext, "userId"> & {
	userId: string;
	isDemoMode: false;
};

/**
 * Context for demo-or-auth handlers - userId is always resolved (never null).
 * isDemoMode reflects whether the request is in demo mode.
 */
export type DemoOrAuthContext = Omit<ApiContext, "userId"> & {
	userId: string;
	isDemoMode: boolean;
};

/**
 * Handler that requires real authentication (no demo mode).
 * userId is guaranteed to be a non-null string. isDemoMode is always false.
 */
export type AuthHandler<TInput = unknown, TOutput = unknown> = (
	ctx: AuthenticatedContext,
	input: TInput,
) => Promise<TOutput>;

/**
 * Handler that works in demo mode or with real auth.
 * userId is always resolved (demo user ID or session user ID).
 */
export type DemoOrAuthHandler<TInput = unknown, TOutput = unknown> = (
	ctx: DemoOrAuthContext,
	input: TInput,
) => Promise<TOutput>;

/**
 * Public handler (no auth required).
 */
export type PublicHandler<TInput = unknown, TOutput = unknown> = (
	ctx: ApiContext,
	input: TInput,
) => Promise<TOutput>;

/**
 * Wraps a handler that requires real authentication.
 * - Calls requireAuthenticated (throws 401 if not authenticated)
 * - Guarantees userId is a string (not null)
 * - isDemoMode is always false
 *
 * Use this for handlers that mutate user data or require real identity.
 */
export function withAuth<TInput, TOutput>(
	handler: AuthHandler<TInput, TOutput>,
): (ctx: ApiContext, body: TInput) => Promise<TOutput> {
	return async (ctx: ApiContext, body: TInput) => {
		requireAuthenticated(ctx);
		const userId = ctx.userId;
		if (!userId) throw new Error("Unauthorized");

		const authCtx: AuthenticatedContext = {
			...ctx,
			userId,
			isDemoMode: false,
		};

		return handler(authCtx, body);
	};
}

/**
 * Wraps a handler that works in demo mode OR with real auth.
 * - Calls requireDemoOrAuthenticated (throws 401 if neither)
 * - Resolves userId from demo user or session
 * - Guarantees userId is a string (not null)
 *
 * Use this for read-heavy handlers that should work in demo mode.
 */
export function withDemoOrAuth<TInput, TOutput>(
	handler: DemoOrAuthHandler<TInput, TOutput>,
): (ctx: ApiContext, body: TInput) => Promise<TOutput> {
	return async (ctx: ApiContext, body: TInput) => {
		requireDemoOrAuthenticated(ctx);

		const userId = ctx.userId

		if (!userId) throw new Error("Unauthorized");

		const resolvedCtx: DemoOrAuthContext = {
			...ctx,
			userId,
			isDemoMode: ctx.isDemoMode,
		};

		return handler(resolvedCtx, body);
	};
}

/**
 * Wraps a public handler (no auth required).
 * Passes through with no modifications — exists for consistency and typing.
 */
export function withPublic<TInput, TOutput>(
	handler: PublicHandler<TInput, TOutput>,
): (ctx: ApiContext, body: TInput) => Promise<TOutput> {
	return handler;
}
