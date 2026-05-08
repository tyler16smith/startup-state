"use client";

import { registerUser } from "@app/client-ts";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

export default function RegisterPage() {
	return (
		<Suspense>
			<RegisterForm />
		</Suspense>
	);
}

function RegisterForm() {
	const _router = useRouter();
	const searchParams = useSearchParams();
	const referralCode = searchParams.get("ref") ?? undefined;
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const register = useMutation({
		mutationFn: async (input: {
			name: string;
			email: string;
			password: string;
			referralCode?: string;
		}) => {
			const response = await registerUser(input);
			if (response.status !== 200) {
				throw new Error("Failed to register");
			}
			return response.data.data;
		},
		onSuccess: async () => {
			await signIn("credentials", {
				email,
				password,
				callbackUrl: referralCode
					? `/onboarding?ref=${encodeURIComponent(referralCode)}`
					: "/onboarding",
			});
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Registration failed");
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		register.mutate({ name, email, password, referralCode });
	}

	async function handleGoogleSignIn() {
		await signIn("google", {
			callbackUrl: referralCode
				? `/onboarding?ref=${encodeURIComponent(referralCode)}`
				: "/onboarding",
		});
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Create an account</CardTitle>
					<CardDescription>Startup State Utah</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button
						className="w-full"
						onClick={handleGoogleSignIn}
						type="button"
						variant="outline"
					>
						<svg
							aria-hidden="true"
							className="mr-2 h-4 w-4"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								fill="#4285F4"
							/>
							<path
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								fill="#34A853"
							/>
							<path
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								fill="#FBBC05"
							/>
							<path
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								fill="#EA4335"
							/>
						</svg>
						Continue with Google
					</Button>

					<div className="flex items-center gap-3">
						<Separator className="flex-1" />
						<span className="text-muted-foreground text-xs">or</span>
						<Separator className="flex-1" />
					</div>

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="name">Full name</Label>
							<Input
								id="name"
								onChange={(e) => setName(e.target.value)}
								placeholder="Jane Smith"
								required
								value={name}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								autoComplete="email"
								id="email"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								type="email"
								value={email}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<div className="relative">
								<Input
									autoComplete="new-password"
									id="password"
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Min. 8 characters"
									required
									type={showPassword ? "text" : "password"}
									value={password}
								/>
								<button
									aria-label={showPassword ? "Hide password" : "Show password"}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowPassword((v) => !v)}
									type="button"
								>
									{showPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirm">Confirm password</Label>
							<div className="relative">
								<Input
									autoComplete="new-password"
									id="confirm"
									onChange={(e) => setConfirm(e.target.value)}
									placeholder="••••••••"
									required
									type={showConfirm ? "text" : "password"}
									value={confirm}
								/>
								<button
									aria-label={showConfirm ? "Hide password" : "Show password"}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowConfirm((v) => !v)}
									type="button"
								>
									{showConfirm ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<p className="text-[10px] text-gray-400">
							By signing up, you consent to the collection, processing, and
							storage of your financial data on our platform. This service is
							for informational purposes only and does not constitute financial,
							tax, or legal advice. We are not financial advisors. You are
							responsible for verifying the accuracy of your data and should
							consult with a qualified professional before making financial
							decisions.
						</p>

						<Button
							className="w-full"
							disabled={register.isPending}
							type="submit"
						>
							{register.isPending ? "Creating account…" : "Create account"}
						</Button>
					</form>

					<p className="text-center text-muted-foreground text-sm">
						Already have an account?{" "}
						<Link
							className="text-primary underline underline-offset-4"
							href={
								referralCode
									? `/auth/signin?ref=${encodeURIComponent(referralCode)}`
									: "/auth/signin"
							}
						>
							Sign in
						</Link>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
