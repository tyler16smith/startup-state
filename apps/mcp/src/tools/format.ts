export function schemaEnvelope<TData extends Record<string, unknown>>(
	kind: string,
	data: TData,
): { schemaVersion: string; kind: string } & TData {
	return {
		schemaVersion: "2026-05-04",
		kind,
		...data,
	};
}
