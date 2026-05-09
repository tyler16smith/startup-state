import Firecrawl from "@mendable/firecrawl-js";
import OpenAI from "openai";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";

const MAX_MARKDOWN_CHARS = 30_000;

const landingPageSummaryInputSchema = z.object({
	url: z.preprocess((value) => {
		if (typeof value !== "string") return value;
		const trimmed = value.trim();
		if (!trimmed) return trimmed;
		return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	}, z.string().url().max(2048)),
});

const landingPageSummarySchema = z.object({
	description: z.string().min(40).max(900),
});

let firecrawlClient: Firecrawl | undefined;
let openaiClient: OpenAI | undefined;

function getFirecrawlClient() {
	if (firecrawlClient) return firecrawlClient;
	const apiKey = process.env.FIRECRAWL_API_KEY;
	if (!apiKey) return undefined;
	firecrawlClient = new Firecrawl({ apiKey, timeoutMs: 60_000 });
	return firecrawlClient;
}

function getOpenAIClient() {
	if (openaiClient) return openaiClient;
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return undefined;
	openaiClient = new OpenAI({ apiKey });
	return openaiClient;
}

function assertHttpUrl(url: string) {
	const parsedUrl = new URL(url);
	if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
		throw createApiError("URL must use http or https", 400);
	}
	return parsedUrl;
}

async function scrapeMarkdown(url: string) {
	const client = getFirecrawlClient();
	if (!client) {
		throw createApiError("FIRECRAWL_API_KEY is required", 501);
	}

	const document = await client.scrape(url, {
		formats: ["markdown"],
		onlyMainContent: true,
		removeBase64Images: true,
		timeout: 45_000,
	});
	const markdown = document.markdown?.trim();
	if (!markdown) throw createApiError("No page content found", 502);
	return markdown.slice(0, MAX_MARKDOWN_CHARS);
}

async function summarizeMarkdown(markdown: string) {
	const client = getOpenAIClient();
	if (!client) {
		throw createApiError("OPENAI_API_KEY is required", 501);
	}

	const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
	const response = await client.chat.completions.create({
		model,
		messages: [
			{
				role: "system",
				content: [
					"You summarize company landing pages for startup onboarding.",
					"Return only JSON with a description field.",
					"The description must be 3 to 4 sentences and explain what the company does, its mission, sector, audience, and useful context for recommendations.",
					"Do not include unsupported claims, markdown, bullets, or promotional filler.",
				].join(" "),
			},
			{
				role: "user",
				content: JSON.stringify({ markdown }),
			},
		],
		response_format: { type: "json_object" },
		temperature: 0.2,
	});

	const content = response.choices.at(0)?.message.content;
	if (!content) throw createApiError("AI summary returned no content", 502);
	const parsed = landingPageSummarySchema.safeParse(JSON.parse(content));
	if (!parsed.success) {
		logger.warn("Landing page summary validation failed", {
			feature: "startup-navigator",
			operation: "landingPageSummary",
			errorMessage: parsed.error.message,
		});
		throw createApiError("AI summary could not be validated", 502);
	}
	return parsed.data.description;
}

export async function summarizeLandingPage(input: unknown) {
	const { url } = landingPageSummaryInputSchema.parse(input);
	const parsedUrl = assertHttpUrl(url);

	try {
		const markdown = await scrapeMarkdown(url);
		const description = await summarizeMarkdown(markdown);
		return {
			description,
			markdownLength: markdown.length,
			url,
		};
	} catch (error) {
		logger.logError("Landing page summary failed", error, {
			feature: "startup-navigator",
			operation: "landingPageSummary",
			hostname: parsedUrl.hostname,
		});
		throw error;
	}
}
