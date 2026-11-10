/**
 * Agent tools of the BuildY builder, read from the one versioned definition file agent-tools.v1.json (name,
 * description, JSON Schema parameters, the chat modes that offer each tool). Hosts send only the tools of the active
 * mode: Ask is read-only, Build may propose. `x-buildy-enum` markers are filled from the pinned catalog and page
 * contract here; every `x-*` keyword is stripped before a schema leaves the host. ADR-0011.
 */
import raw from "./agent-tools.v1.json" with { type: "json" };
import { facetVocabulary } from "../catalog/search.ts";
import { blockLabelVocabulary, vocabularyValues } from "../catalog/text-search.ts";
import { contentKinds } from "../content.ts";

export const AGENT_MODES = ["ask", "build"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

export type JsonSchemaObject = Record<string, unknown>;

export type AgentToolDefinition = {
	name: string;
	modes: AgentMode[];
	description: string;
	descriptionByMode?: Partial<Record<AgentMode, string>>;
	parameters: JsonSchemaObject;
};

export type AgentToolsDocument = {
	format: "buildy-agent-tools";
	version: number;
	description: string;
	modes: Record<AgentMode, { description: string; toolChoice: "auto" }>;
	enumSources: Record<string, string>;
	tools: AgentToolDefinition[];
};

export const agentToolsDocument = raw as unknown as AgentToolsDocument;
export const AGENT_TOOLS_VERSION = `${agentToolsDocument.format}/${agentToolsDocument.version}`;

export function isAgentMode(value: unknown): value is AgentMode {
	return typeof value === "string" && (AGENT_MODES as readonly string[]).includes(value);
}

/** Value lists named by `x-buildy-enum`: generated from the pinned catalog and the page contract, never typed here. */
export function agentEnumSource(name: string): string[] {
	switch (name) {
		case "catalog.section":
			return [...facetVocabulary().section];
		case "catalog.job":
			return [...facetVocabulary().job];
		case "catalog.industry":
			return vocabularyValues("industry");
		case "catalog.blocks":
			return blockLabelVocabulary();
		case "page.contentKinds":
			return contentKinds();
		default:
			throw new Error(`agent-tools: unknown x-buildy-enum source ${name}`);
	}
}

/** Fill `x-buildy-enum` markers and drop every `x-*` keyword: a plain JSON Schema the provider accepts. */
export function resolveAgentSchema<T>(node: T): T {
	if (Array.isArray(node)) return node.map((item) => resolveAgentSchema(item)) as T;
	if (typeof node !== "object" || node === null) return node;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		if (key === "x-buildy-enum") {
			out.enum = agentEnumSource(String(value));
			continue;
		}
		if (key.startsWith("x-")) continue;
		out[key] = resolveAgentSchema(value);
	}
	return out as T;
}

export function agentTool(name: string): AgentToolDefinition | null {
	return agentToolsDocument.tools.find((tool) => tool.name === name) ?? null;
}

/** Tool names one mode offers, in file order. */
export function agentToolNames(mode: AgentMode): string[] {
	return agentToolsDocument.tools.filter((tool) => tool.modes.includes(mode)).map((tool) => tool.name);
}

export function toolOffersMode(name: string, mode: AgentMode): boolean {
	return Boolean(agentTool(name)?.modes.includes(mode));
}

/** Resolved parameters (object schema) of one tool. */
export function agentToolParameters(name: string): JsonSchemaObject {
	const tool = agentTool(name);
	if (!tool) throw new Error(`agent-tools: unknown tool ${name}`);
	return resolveAgentSchema(tool.parameters);
}

export type OpenAiFunctionTool = {
	type: "function";
	function: { name: string; description: string; parameters: JsonSchemaObject };
};

const RESOLVED = new Map<string, OpenAiFunctionTool[]>();

/** OpenAI-compatible tool list of a mode (optionally narrowed to `only`). Cached per mode and subset. */
export function agentOpenAiTools(mode: AgentMode, only?: readonly string[]): OpenAiFunctionTool[] {
	const key = `${mode}:${only ? only.join(",") : "*"}`;
	const hit = RESOLVED.get(key);
	if (hit) return hit;
	const tools = agentToolsDocument.tools
		.filter((tool) => tool.modes.includes(mode) && (!only || only.includes(tool.name)))
		.map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.descriptionByMode?.[mode] ?? tool.description,
				parameters: resolveAgentSchema(tool.parameters)
			}
		}));
	RESOLVED.set(key, tools);
	return tools;
}

function properties(name: string): Record<string, unknown> {
	return (agentToolParameters(name).properties ?? {}) as Record<string, unknown>;
}

/** search_catalog parameter properties (facet enums from the pinned catalog). */
export function catalogToolParameterSchema(): Record<string, Record<string, unknown>> {
	return properties("search_catalog") as Record<string, Record<string, unknown>>;
}

/** edit_page parameter properties (page-patch/v1 ops). */
export function editPageParameterSchema(): Record<string, unknown> {
	return properties("edit_page");
}

const PROPOSE_FRAME = new Set(["brief", "scenarioId", "screenId", "expectedRevision", "edits"]);

/** propose_layout content properties (title, locale, blocks, typed intent), without the call frame. */
export function proposeContentParameterSchema(): Record<string, unknown> {
	return Object.fromEntries(Object.entries(properties("propose_layout")).filter(([key]) => !PROPOSE_FRAME.has(key)));
}
