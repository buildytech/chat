/**
 * Agent tools of the BuildY builder, read from the one versioned definition file agent-tools.v1.json (name,
 * description, JSON Schema parameters, the chat modes that offer each tool). Hosts send only the tools of the active
 * mode: Ask is read-only, Build may propose. `x-buildy-enum` markers are filled from the pinned catalog and page
 * contract here; every `x-*` keyword is stripped before a schema leaves the host. ADR-0011.
 */
import raw from "./agent-tools.v1.json" with { type: "json" };
import { facetVocabulary } from "@buildytech/builder-core";
import { blockLabelVocabulary, vocabularyValues } from "@buildytech/builder-core";

export const AGENT_MODES = ["ask", "build"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

type JsonSchemaObject = Record<string, unknown>;

type AgentToolDefinition = {
	name: string;
	modes: AgentMode[];
	description: string;
	descriptionByMode?: Partial<Record<AgentMode, string>>;
	parameters: JsonSchemaObject;
};

type AgentToolsDocument = {
	format: "buildy-agent-tools";
	version: number;
	description: string;
	modes: Record<AgentMode, { description: string; toolChoice: "auto" | "required" }>;
	enumSources: Record<string, string>;
	tools: AgentToolDefinition[];
};

export const agentToolsDocument = raw as unknown as AgentToolsDocument;
export const AGENT_TOOLS_VERSION = `${agentToolsDocument.format}/${agentToolsDocument.version}`;

/** The versioned mode policy shared by runtime and configuration viewers. */
export function agentToolChoice(mode: AgentMode): "auto" | "required" {
 return agentToolsDocument.modes[mode].toolChoice;
}

export function isAgentMode(value: unknown): value is AgentMode {
	return typeof value === "string" && (AGENT_MODES as readonly string[]).includes(value);
}

/** Value lists named by `x-buildy-enum`: generated from the pinned catalog and the page contract, never typed here. */
function agentEnumSource(name: string): string[] {
	switch (name) {
		case "catalog.site":
			return [...facetVocabulary().site];
		case "catalog.section":
			return [...facetVocabulary().section];
		case "catalog.job":
			return [...facetVocabulary().job];
		case "catalog.industry":
			return vocabularyValues("industry");
		case "catalog.blocks":
			return blockLabelVocabulary();
		default:
			throw new Error(`agent-tools: unknown x-buildy-enum source ${name}`);
	}
}

/** Fill `x-buildy-enum` markers and drop every `x-*` keyword: a plain JSON Schema the provider accepts. */
function resolveAgentSchema<T>(node: T): T {
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

function agentTool(name: string): AgentToolDefinition | null {
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
function agentToolParameters(name: string): JsonSchemaObject {
	const tool = agentTool(name);
	if (!tool) throw new Error(`agent-tools: unknown tool ${name}`);
	return resolveAgentSchema(tool.parameters);
}

export type ResolvedAgentTool = { name: string; description: string; parameters: JsonSchemaObject };
const RESOLVED = new Map<string, ResolvedAgentTool[]>();

/** Neutral resolved tools. Definitions and schemas remain in the one versioned document. */
export function agentTools(mode: AgentMode, only?: readonly string[]): ResolvedAgentTool[] {
	const key = mode + ":" + (only ? only.join(",") : "*");
	const hit = RESOLVED.get(key);
	if (hit) return hit;
	const tools = agentToolsDocument.tools
		.filter((tool) => tool.modes.includes(mode) && (!only || only.includes(tool.name)))
		.map((tool) => ({ name: tool.name, description: tool.descriptionByMode?.[mode] ?? tool.description, parameters: resolveAgentSchema(tool.parameters) }));
	RESOLVED.set(key, tools);
	return tools;
}

/** Compatibility projection for existing callers; execution uses agentTools. */
export function agentOpenAiTools(mode: AgentMode, only?: readonly string[]) {
	return agentTools(mode, only).map((tool) => ({ type: "function" as const, function: tool }));
}

function properties(name: string): Record<string, unknown> {
	return (agentToolParameters(name).properties ?? {}) as Record<string, unknown>;
}

/** search_catalog parameter properties (facet enums from the pinned catalog). */
export function catalogToolParameterSchema(): Record<string, Record<string, unknown>> {
	return properties("search_catalog") as Record<string, Record<string, unknown>>;
}
