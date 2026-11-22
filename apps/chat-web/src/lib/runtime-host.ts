/**
 * The host this app runs in (ADR 0065, status `host`): the desktop host names itself, its version and platform in GET
 * /runtime/v1/status; the web hosts send no `host`, so the app is in a browser. The session export stamps `app.host`
 * from it (a failed status read falls back to the browser: never trust a stored value).
 */
type RuntimeHost = { kind: "browser" | "desktop"; version?: string; os?: string; arch?: string };

/** The desktop host's status `host` (contract constants.host): its kind, the version of a build without one, the version shape. */
export const DESKTOP_HOST = { kind: "desktop", devVersion: "dev", version: /^(?:dev|[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)$/ } as const;

const BROWSER: RuntimeHost = { kind: "browser" };
let current: RuntimeHost = BROWSER;

const word = (value: unknown): string | undefined => (typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(value) ? value : undefined);

/** What the last status read said (`body.host`); anything but a desktop host document is the browser. */
export function noteRuntimeHost(host: unknown): void {
	if (!host || typeof host !== "object" || Reflect.get(host, "kind") !== "desktop") {
		current = BROWSER;
		return;
	}
	const raw = Reflect.get(host, "version");
	const version = typeof raw === "string" && DESKTOP_HOST.version.test(raw) ? raw : undefined;
	const os = word(Reflect.get(host, "os"));
	const arch = word(Reflect.get(host, "arch"));
	current = { kind: "desktop", ...(version ? { version } : {}), ...(os ? { os } : {}), ...(arch ? { arch } : {}) };
}

export function runtimeHost(): RuntimeHost {
	return current;
}
