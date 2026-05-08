"use client";

import { Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function EditPencilLink({
	href,
	label,
}: {
	href: string;
	label: string;
}) {
	const [loading, setLoading] = useState(false);

	return (
		<Link
			aria-label={label}
			className="ml-3 shrink-0 text-muted-foreground hover:text-foreground"
			href={href}
			onClick={() => setLoading(true)}
		>
			{loading ? (
				<Loader2 className="size-4 animate-spin" />
			) : (
				<Pencil className="size-4" />
			)}
		</Link>
	);
}
