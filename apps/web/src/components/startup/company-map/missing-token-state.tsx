import { MapPinned } from "lucide-react";
import { EmptyState } from "~/components/startup/empty-state";

export function MissingTokenState() {
	return (
		<div className="flex h-full min-h-0 items-center justify-center p-6">
			<EmptyState
				description="Map view needs a Mapbox token before companies can be shown on the map."
				icon={MapPinned}
				title="Mapbox token missing"
			/>
		</div>
	);
}
