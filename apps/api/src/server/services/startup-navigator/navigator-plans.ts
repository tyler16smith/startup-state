import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import { saveNavigatorPlanInputSchema } from "./schemas";

type Db = PrismaClient;

function toInputJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function saveNavigatorPlan(
	db: Db,
	userId: string,
	input: unknown,
) {
	const data = saveNavigatorPlanInputSchema.parse(input);
	const title =
		data.title ??
		(data.kind === "FOUNDER" ? "Founder action plan" : "Investor shortlist");

	return db.navigatorPlan.create({
		data: {
			userId,
			kind: data.kind,
			title,
			input: toInputJson(data.input),
			result: toInputJson(data.result),
		},
	});
}

export async function getLatestNavigatorPlan(db: Db, userId: string) {
	return db.navigatorPlan.findFirst({
		where: { userId },
		orderBy: { updatedAt: "desc" },
	});
}

export async function listNavigatorPlans(db: Db, userId: string) {
	return db.navigatorPlan.findMany({
		where: { userId },
		orderBy: { updatedAt: "desc" },
	});
}
