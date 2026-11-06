/**
 * Browser/admin TS client for the WordPress PagePort REST surface.
 * chat-web must depend on this contract, never on PHP.
 */
import type { Page, PageSummary } from "@buildytech/page-contract";
import type { CatalogPort, PagePort, PreviewPort, PublishPort } from "@buildytech/ports";

export type WpRestOptions = {
	baseUrl: string;
	nonce?: string;
};

async function wpFetch<T>(opts: WpRestOptions, path: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	headers.set("Accept", "application/json");
	if (opts.nonce) headers.set("X-WP-Nonce", opts.nonce);
	const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers });
	if (!res.ok) {
		throw new Error(`wordpress adapter HTTP ${res.status}`);
	}
	return (await res.json()) as T;
}

export function createWordpressPorts(opts: WpRestOptions): CatalogPort & PagePort & PublishPort & PreviewPort {
	return {
		async listPages(query) {
			const q = new URLSearchParams();
			if (query?.locale) q.set("locale", query.locale);
			if (query?.status) q.set("status", query.status);
			const suffix = q.size ? `?${q}` : "";
			return wpFetch<PageSummary[]>(opts, `/buildytech/v1/pages${suffix}`);
		},
		async getPage(id) {
			return wpFetch<Page | null>(opts, `/buildytech/v1/pages/${encodeURIComponent(id)}`);
		},
		async getPageBySlug(slug) {
			return wpFetch<Page | null>(opts, `/buildytech/v1/pages/by-slug/${encodeURIComponent(slug)}`);
		},
		async savePage(page) {
			return wpFetch<Page>(opts, `/buildytech/v1/pages/${encodeURIComponent(page.id)}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(page)
			});
		},
		async publish(id) {
			return wpFetch<Page>(opts, `/buildytech/v1/pages/${encodeURIComponent(id)}/publish`, {
				method: "POST"
			});
		},
		async unpublish(id) {
			return wpFetch<Page>(opts, `/buildytech/v1/pages/${encodeURIComponent(id)}/unpublish`, {
				method: "POST"
			});
		},
		async previewUrl(id) {
			const body = await wpFetch<{ url: string }>(opts, `/buildytech/v1/pages/${encodeURIComponent(id)}/preview`);
			return body.url;
		}
	};
}
