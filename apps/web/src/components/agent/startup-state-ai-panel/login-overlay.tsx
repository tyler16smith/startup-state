import { LockKeyhole, LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";

export function LoginOverlay() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const callbackParams = new URLSearchParams(searchParams.toString());
	callbackParams.set("agent", "open");
	const callbackUrl = `${pathname}${callbackParams.toString() ? `?${callbackParams.toString()}` : ""}`;
	const signinHref = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

	return (
		<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 px-6 backdrop-blur-[2px]">
			<div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-md border bg-background p-5 text-center shadow-lg">
				<div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
					<LockKeyhole className="size-5" />
				</div>
				<div className="space-y-1.5">
					<h3 className="font-semibold text-base">Sign in to chat</h3>
					<p className="text-muted-foreground text-sm leading-5">
						Your Agent conversations are saved to your account.
					</p>
				</div>
				<Button asChild className="w-full">
					<Link href={signinHref}>
						<LogIn className="size-4" /> Sign in
					</Link>
				</Button>
			</div>
		</div>
	);
}
