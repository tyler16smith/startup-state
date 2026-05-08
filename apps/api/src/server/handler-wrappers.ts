import { type ApiContext, requireAuthenticated } from "./api-context";

/**
 * Context with guaranteed userId - used by auth-required handlers.
 */
export type AuthenticatedContext = Omit<ApiContext, "userId"> & {
	userId: string;
};

/**
 * Handler that requires real authentication.
 * userId is guaranteed to be a non-null string.
 */
export type AuthHandler<TInput = unknown, TOutput = unknown> = (
	ctx: AuthenticatedContext,
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
		};

		return handler(authCtx, body);
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
