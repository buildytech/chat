/**
 * Sign in with OpenRouter (ADR 0067, contract cases/openrouter-auth.json): only a host whose status lists
 * `capabilities.signIn: ["openrouter"]` (the desktop app) offers it; the web hosts never do. The host opens the system
 * browser and keeps the key; this file only asks it to start or to sign out, and reads the outcome from the status
 * (`provider.signedIn`, `provider.pending`). No key, code or verifier ever reaches the webview. Plain TS (node tests
 * import it); the component subscribes with `onSignInChange`.
 */
export type SignInState = { offered: boolean; signedIn: boolean; pending: boolean; failed: boolean };

let state: SignInState = { offered: false, signedIn: false, pending: false, failed: false };
const listeners = new Set<(next: SignInState) => void>();

function set(next: SignInState): void {
	state = next;
	for (const listener of listeners) listener(state);
}

export function signInState(): SignInState {
	return state;
}

export function onSignInChange(listener: (next: SignInState) => void): () => void {
	listeners.add(listener);
	listener(state);
	return () => listeners.delete(listener);
}

/** What the last status said: offered only when the host lists the OpenRouter sign-in. */
export function noteRuntimeSignIn(signIn: unknown, provider: { signedIn?: unknown; pending?: unknown } | undefined): void {
	const offered = Array.isArray(signIn) && signIn.includes("openrouter");
	set({ offered, signedIn: offered && provider?.signedIn === true, pending: offered && provider?.pending === true, failed: state.failed && offered && provider?.pending !== true && provider?.signedIn !== true });
}

const POLL_EVERY_MS = 2000;
/** The host's callback waits at most 10 minutes (constants.openrouter.callback.ttlSeconds). */
const GIVE_UP_MS = 600_000;

async function post(path: string): Promise<boolean> {
	const res = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", accept: "application/json" }, body: "{}" }).catch(() => null);
	return Boolean(res?.ok);
}

/**
 * Ask the host to start the sign-in (it opens the browser), then read the status until it is signed in or the sign-in
 * ended. `refresh` reads the status (and notes it here, via fetchXaiStatus); it resolves when the sign-in is over.
 */
export async function startSignIn(refresh: () => Promise<unknown>, sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<boolean> {
	set({ ...state, pending: true, failed: false });
	if (!(await post("/runtime/v1/auth/openrouter/start"))) {
		set({ ...state, pending: false, failed: true });
		return false;
	}
	const started = Date.now();
	while (Date.now() - started < GIVE_UP_MS) {
		await sleep(POLL_EVERY_MS);
		await refresh();
		if (state.signedIn) return true;
		if (!state.pending) break;
	}
	set({ ...state, pending: false, failed: !state.signedIn });
	return state.signedIn;
}

/** Ask the host to delete the OpenRouter key, then read the status (the app falls back to the xAI key, if any). */
export async function signOut(refresh: () => Promise<unknown>): Promise<void> {
	await post("/runtime/v1/auth/openrouter/signout");
	await refresh();
}
