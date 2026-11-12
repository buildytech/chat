import { error } from "@sveltejs/kit";
export function load({ url }: { url: URL }) {
	if (!url.searchParams.has("preview") || !url.searchParams.get("session")) error(404, "Preview session required");
	return {};
}
