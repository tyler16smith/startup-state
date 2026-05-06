import { PrismaClient } from "../../../api/generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
	mcpPrisma?: PrismaClient;
};

export const db = globalForPrisma.mcpPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.mcpPrisma = db;
}

export type DbClient = typeof db;
