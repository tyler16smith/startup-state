import type { AgentReference } from "@app/mcp-contracts";
import type { LucideIcon } from "lucide-react";
import {
	Building2,
	CheckCircle2,
	Compass,
	ExternalLink,
	LayoutDashboard,
	LineChart,
	Loader2,
	Map as MapIcon,
	Receipt,
	Search,
	Sparkles,
	TrendingUp,
	XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useFinAiPanel } from "~/components/agent/fin-ai-context";
import {
	ActionResultBlock,
	type FinWidget,
	FinWidgetRenderer,
} from "~/components/agent/fin-ai-widgets";
import { Button } from "~/components/ui/button";
import { useDemoMode } from "~/context/demo-mode-context";
import { trackFinAi } from "~/lib/agent-analytics";
import { cn } from "~/lib/utils";

export type FinAiTimelineBlock =
	| {
			id: string;
			type: "markdown";
			role: "user" | "assistant";
			content: string;
			tone?: "default" | "error";
			runId?: string;
			stepId?: string;
	  }
	| {
			id: string;
			type: "widget";
			role: "assistant";
			widget: FinWidget;
			runId?: string;
			stepId?: string;
	  }
	| {
			id: string;
			type: "action_result";
			role: "assistant";
			actionType: string;
			summary: string;
			result?: unknown;
			runId?: string;
			stepId?: string;
	  }
	| {
			id: string;
			type: "references";
			role: "assistant";
			referenceBlockId: string;
			title?: string;
			toolCallId?: string;
			toolName?: string;
			references: AgentReference[];
			runId?: string;
			stepId?: string;
	  }
	| {
			id: string;
			type: "run_step";
			role: "assistant";
			stepType: "model_response" | "tool_execution" | "user_input_required";
			stepIndex: number;
			status: "running" | "completed";
			runId?: string;
			stepId?: string;
	  }
	| {
			id: string;
			type: "tool_call";
			role: "assistant";
			toolCallId: string;
			toolName: string;
			displayName?: string;
			status: "running" | "completed";
			summary?: string;
			runId?: string;
			stepId?: string;
	  };

type ToolDisplayConfig = {
	label: string;
	runningLabel: string;
	icon: LucideIcon;
};

const TOOL_CALL_DISPLAY_MAP: Record<string, ToolDisplayConfig> = {
	render_widget: {
		label: "Created widget",
		runningLabel: "Creating widget",
		icon: LayoutDashboard,
	},
	get_transactions: {
		label: "Reviewed transactions",
		runningLabel: "Reviewing transactions",
		icon: Receipt,
	},
	get_net_worth: {
		label: "Checked net worth",
		runningLabel: "Checking net worth",
		icon: TrendingUp,
	},
	get_net_worth_forecast: {
		label: "Forecasted net worth",
		runningLabel: "Forecasting net worth",
		icon: LineChart,
	},
	get_investments: {
		label: "Reviewed investments",
		runningLabel: "Reviewing investments",
		icon: TrendingUp,
	},
	search_resources: {
		label: "Searched resources",
		runningLabel: "Searching resources",
		icon: Sparkles,
	},
	get_resource: {
		label: "Reviewed resource",
		runningLabel: "Reviewing resource",
		icon: Sparkles,
	},
	recommend_founder_resources: {
		label: "Recommended resources",
		runningLabel: "Recommending resources",
		icon: Compass,
	},
	search_companies: {
		label: "Searched companies",
		runningLabel: "Searching companies",
		icon: Building2,
	},
	get_company: {
		label: "Reviewed company",
		runningLabel: "Reviewing company",
		icon: Building2,
	},
};

export function FinAiTimelineBlockRenderer({
	block,
}: {
	block: FinAiTimelineBlock;
}) {
	if (block.type === "widget") {
		return (
			<div className="min-w-0 max-w-[92%] flex-1">
				<FinWidgetRenderer widget={block.widget} />
			</div>
		);
	}

	if (block.type === "action_result") {
		return (
			<div className="min-w-0 max-w-[92%] flex-1">
				<ActionResultBlock summary={block.summary} />
			</div>
		);
	}

	if (block.type === "run_step") {
		return <RunStepBlock block={block} />;
	}

	if (block.type === "tool_call") {
		return <ToolCallBlock block={block} />;
	}

	if (block.type === "references") {
		return <ReferenceBlock block={block} />;
	}

	return <MarkdownBlock block={block} />;
}

function referenceIcon(kind: AgentReference["kind"]): LucideIcon {
	switch (kind) {
		case "resource":
			return Sparkles;
		case "company":
			return Building2;
		case "map_search":
			return MapIcon;
		case "resource_search":
			return Search;
		case "founder_intake":
		case "founder_results":
			return Compass;
	}
}

function isCustomerHref(href: string) {
	if (!href.startsWith("/")) return false;
	return (
		href === "/" ||
		href.startsWith("/founder") ||
		href.startsWith("/resources") ||
		href.startsWith("/map") ||
		href.startsWith("/companies")
	);
}

function useNavigateReference() {
	const router = useRouter();
	const { close } = useFinAiPanel();
	const { isDemoMode } = useDemoMode();

	return (reference: AgentReference) => {
		if (!isCustomerHref(reference.href)) return;
		trackFinAi("agent_reference_clicked", {
			demoUser: isDemoMode,
			kind: reference.kind,
			toolName: reference.toolName,
			hasSection: Boolean(reference.section),
		});
		router.push(reference.href);
		if (window.matchMedia("(max-width: 767px)").matches) close();
	};
}

function ReferenceBlock({
	block,
}: {
	block: Extract<FinAiTimelineBlock, { type: "references" }>;
}) {
	const navigateReference = useNavigateReference();
	return (
		<div className="flex justify-start">
			<div className="grid max-w-[92%] flex-1 gap-2">
				<p className="px-1 font-medium text-muted-foreground text-xs">
					{block.title ?? "References"}
				</p>
				<div className="grid gap-2">
					{block.references.slice(0, 6).map((reference) => {
						const Icon = referenceIcon(reference.kind);
						const canNavigate = isCustomerHref(reference.href);
						return (
							<button
								className="rounded-md border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
								disabled={!canNavigate}
								key={reference.id}
								onClick={() => navigateReference(reference)}
								type="button"
							>
								<div className="flex items-start gap-2">
									<div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
										<Icon className="size-4" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-start justify-between gap-2">
											<p className="font-medium text-sm leading-5">
												{reference.title}
											</p>
											<ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
										</div>
										{reference.subtitle ? (
											<p className="mt-0.5 text-muted-foreground text-xs">
												{reference.subtitle}
											</p>
										) : null}
										{reference.excerpt ? (
											<p className="mt-2 line-clamp-2 text-muted-foreground text-xs leading-5">
												{reference.excerpt}
											</p>
										) : null}
										{reference.reasons?.length ? (
											<p className="mt-2 text-emerald-700 text-xs">
												{reference.reasons[0]}
											</p>
										) : null}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function RunStepBlock(_props: {
	block: Extract<FinAiTimelineBlock, { type: "run_step" }>;
}) {
	return null;
}

function ToolCallBlock({
	block,
}: {
	block: Extract<FinAiTimelineBlock, { type: "tool_call" }>;
}) {
	const isRunning = block.status === "running";
	const isFailed = block.summary?.startsWith("status=error") ?? false;
	const config = TOOL_CALL_DISPLAY_MAP[block.toolName];
	const label = isRunning
		? (config?.runningLabel ?? block.displayName ?? block.toolName)
		: (config?.label ?? block.displayName ?? block.toolName);
	const Icon = config?.icon;

	return (
		<div className="flex justify-start">
			<div className="inline-flex max-w-[92%] items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-xs">
				{isRunning ? (
					<Loader2 className="size-3 animate-spin text-muted-foreground" />
				) : Icon ? (
					<Icon className="size-3 text-muted-foreground" />
				) : (
					<CheckCircle2 className="size-3 text-muted-foreground" />
				)}
				<span className="font-medium">{label}</span>
				{!isRunning && isFailed ? (
					<span className="inline-flex items-center gap-1 text-destructive">
						<XCircle className="size-3" />
						<span>failed</span>
					</span>
				) : null}
			</div>
		</div>
	);
}

function MarkdownBlock({
	block,
}: {
	block: Extract<FinAiTimelineBlock, { type: "markdown" }>;
}) {
	const isUser = block.role === "user";
	const isError = block.tone === "error";
	const router = useRouter();

	return (
		<div className={cn("flex", isUser && "flex-row-reverse")}>
			<div
				className={cn(
					"max-w-[82%] rounded-md px-3 py-2 text-sm leading-6",
					isUser
						? "bg-primary/80 text-primary-foreground"
						: "bg-card text-card-foreground",
					isError && "border-destructive/30 bg-destructive/10 text-destructive",
				)}
			>
				{isUser || isError ? (
					<div className="whitespace-pre-wrap break-words">{block.content}</div>
				) : (
					<div className="fin-ai-markdown break-words text-sm leading-6">
						<ReactMarkdown
							components={{
								a: ({ children, href }) => {
									if (href && isCustomerHref(href)) {
										return (
											<Button
												className="h-auto p-0 align-baseline text-emerald-700 underline"
												onClick={() => router.push(href)}
												type="button"
												variant="link"
											>
												{children}
											</Button>
										);
									}
									return (
										<a href={href} rel="noreferrer" target="_blank">
											{children}
										</a>
									);
								},
							}}
							remarkPlugins={[remarkGfm]}
						>
							{block.content}
						</ReactMarkdown>
					</div>
				)}
			</div>
		</div>
	);
}
