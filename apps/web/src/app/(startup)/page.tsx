import { redirect } from "next/navigation";
import { AudienceSelector } from "~/components/startup/audience-selector";
import { auth } from "~/server/auth";

export default async function Home() {
	const session = await auth();
	if (session?.user) redirect("/plan");
	return <AudienceSelector />;
}
