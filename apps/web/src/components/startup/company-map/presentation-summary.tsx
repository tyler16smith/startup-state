type PresentationSummaryProps = {
	startupCount: number;
};

const numberFormatter = new Intl.NumberFormat("en-US");

export function PresentationSummary({
	startupCount,
}: PresentationSummaryProps) {
	return (
		<section className="absolute top-4 left-4 z-40 max-w-[calc(100vw-2rem)] px-5 py-4 text-slate-950 sm:px-6">
			<h2 className="max-w-xl text-balance font-semibold text-2xl leading-tight sm:text-3xl">
				Utah: The Startup Capital of the World
			</h2>
			<div className="mt-3 space-y-1 font-medium text-lg text-slate-700 sm:text-xl">
				<p>
					<span className="font-semibold text-slate-950">
						{numberFormatter.format(startupCount)}
					</span>{" "}
					startups
				</p>
				<p><b>$9.4B</b> in funding</p>
			</div>
		</section>
	);
}
