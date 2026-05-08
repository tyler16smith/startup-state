export const USER_ROLE = {
	USER: "USER",
	ADMIN: "ADMIN",
	COMPANY_OWNER: "COMPANY_OWNER",
	PENDING_COMPANY_OWNER: "PENDING_COMPANY_OWNER",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
