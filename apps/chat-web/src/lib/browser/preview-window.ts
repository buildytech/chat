/**
 * Opening the standalone preview (ADR 0073). A browser opens it with window.open. A desktop webview cannot: WebView2
 * makes a popup with no asset handler for `wails.localhost` (the address fails to load) and WebKit makes none, so the
 * desktop host opens the window itself. The chat module, which talks to the runtime host, registers that opener while
 * the host is a desktop host; without it (a browser, chat off) the browser opens the address.
 */
type HostOpener = (url: string) => Promise<boolean>;

type OpenDeps = { open?: (url: string) => unknown };

let hostOpener: HostOpener | null = null;

/** The desktop host's opener (null: none). Registered by the chat module from the runtime status. */
export function setPreviewHostOpener(opener: HostOpener | null): void {
	hostOpener = opener;
}

export async function openPreviewWindow(url: string, deps: OpenDeps = {}): Promise<"host" | "browser"> {
	const open = deps.open ?? ((target: string) => window.open(target, "_blank", "noopener"));
	if (hostOpener) {
		try {
			if (await hostOpener(url)) return "host";
		} catch {
			/* the browser opens it below */
		}
	}
	open(url);
	return "browser";
}
