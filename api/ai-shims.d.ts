/**
 * Ambient modules so Vercel typechecking of api/runtime does not fail with TS2307
 * when optional AI SDK packages are absent from this lockfile. Runtime uses
 * dynamic import; the Chat Completions tool loop does not need these packages.
 *
 * `enum` is a TypeScript keyword, so it cannot be `export function enum`.
 * Put it on a namespace object instead.
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
	type Zodish = { optional: () => Zodish };
	type ZodApi = {
		object: (shape: Record<string, unknown>) => Zodish;
		enum: (values: [string, ...string[]]) => Zodish;
		string: () => Zodish;
		number: () => Zodish;
	};
	const z: ZodApi;
	export default z;
	export = z;
}
