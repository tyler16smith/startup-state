import Image from "next/image";

const sizeMap = {
	sm: 20,
	md: 24,
	lg: 28,
};

interface LogoProps {
	className?: string;
	showText?: boolean;
	size?: "sm" | "md" | "lg";
}

export default function Logo({
	className,
	showText = true,
	size = "md",
}: LogoProps) {
	return (
		<span
			className={`flex items-center gap-1 font-semibold ${className ?? ""}`}
			style={{ fontSize: sizeMap[size] }}
		>
			<Image
				alt="App logo"
				height={sizeMap[size]}
				src="/fin-logo.svg"
				width={sizeMap[size]}
			/>
			{showText && "App"}
		</span>
	);
}
