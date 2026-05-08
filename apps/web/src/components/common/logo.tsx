import Image from "next/image";

const sizeMap = {
	sm: 125,
	md: 175,
	lg: 225,
};

interface LogoProps {
	className?: string;
	size?: "sm" | "md" | "lg";
}

export default function Logo({ className, size = "md" }: LogoProps) {
	return (
		<span
			className={`flex items-center gap-1 font-semibold ${className ?? ""}`}
			style={{ fontSize: sizeMap[size] }}
		>
			<Image
				alt="Startup State Utah logo"
				height={sizeMap[size]}
				src="/startup-state-logo.svg"
				width={sizeMap[size]}
			/>
		</span>
	);
}
