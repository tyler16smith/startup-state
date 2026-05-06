export type AuthState = {
	appUserId: string;
	email: string | null;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: string;
} | null;

export type HelloWorldResult = {
	message: "hello_world";
	source: string;
	user: {
		id: string;
		email: string | null;
		name: string | null;
	};
	receivedAt: string;
};

export type ExtensionState = {
	auth: AuthState;
	lastHelloWorld: HelloWorldResult | null;
};

export type ExtensionMessage =
	| { type: "HELLO_WORLD" }
	| { type: "AUTH_UPDATED" }
	| { type: "STATE_UPDATED" };
