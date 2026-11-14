/** Browser-safe env bag. Do not use NodeJS.ProcessEnv in this package. */
export type EnvMap = Record<string, string | undefined>;

export function readEnv(env?: EnvMap): EnvMap {
	if (env) return env;
	const g = globalThis as typeof globalThis & { process?: { env?: EnvMap } };
	return g.process?.env ?? {};
}
