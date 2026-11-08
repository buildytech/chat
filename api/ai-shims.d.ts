/**
 * Ambient modules so Vercel typechecking of api/runtime does not fail with TS2307
 * when optional AI SDK packages are absent from this lockfile. Runtime uses
 * dynamic import; the Chat Completions tool loop does not need these packages.
 */
declare module "@ai-sdk/openai" {
	export function createOpenAI(opts: Record<string, unknown>): { chat: (id: string) => unknown };
}

declare module "ai" {
	export function streamText(opts: Record<string, unknown>): Promise<{ text: Promise<string> }>;
	export function tool(opts: Record<string, unknown>): unknown;
	export function stepCountIs(n: number): unknown;
}

declare module "zod" {
	export function object(shape: Record<string, unknown>): unknown;
	export function enum(values: [string, ...string[]]): { optional: () => unknown };
	export function string(): { optional: () => unknown };
	export function number(): { optional: () => unknown };
}
