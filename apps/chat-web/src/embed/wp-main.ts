/**
 * WordPress admin embed entry.
 * Mounts Creator ChatApp into #buildytech-si-chat-root without SvelteKit client router.
 * Kit router must not own /wp-admin/admin.php?page=… (reported reload loop, t144u).
 */
import { mount, unmount } from "svelte";
import ChatApp from "../lib/screens/ChatApp.svelte";
import "../app.css";

export type WpEmbedHandle = { unmount: () => void };

function mark(status: string, isError = false): void {
	const el = document.getElementById("buildytech-si-chat-mount-status");
	if (!el) return;
	el.textContent = status;
	el.hidden = false;
	if (isError) el.setAttribute("data-error", "1");
}

function boot(): WpEmbedHandle | null {
	const root = document.getElementById("buildytech-si-chat-root");
	if (!root) {
		mark("Mount root #buildytech-si-chat-root missing.", true);
		return null;
	}
	try {
		mark("Loading Creator…");
		const app = mount(ChatApp, { target: root });
		const handle: WpEmbedHandle = {
			unmount: () => {
				unmount(app);
			}
		};
		(
			window as unknown as { __BUILDYTECH_SI_CHAT_EMBED__?: WpEmbedHandle }
		).__BUILDYTECH_SI_CHAT_EMBED__ = handle;
		const status = document.getElementById("buildytech-si-chat-mount-status");
		if (status) status.remove();
		root.setAttribute("data-embed", "wp-svelte-mount");
		root.removeAttribute("data-mount-error");
		return handle;
	} catch (err) {
		console.error("buildytech-si-chat embed mount failed", err);
		mark(
			"Creator failed to load: " + (err instanceof Error ? err.message : String(err)),
			true
		);
		root.setAttribute("data-mount-error", "1");
		return null;
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
} else {
	boot();
}
