import type { PageV2 } from "@buildytech/page-contract";

/** A new empty page-spec/v2 page: no blocks; the author adds them from the Blocks feed or Build writes them. */
export function emptyPage(input: { title: string; locale?: string | null; now?: Date | string; id?: string }): PageV2 {
	const stamp = (input.now ? new Date(input.now) : new Date()).toISOString();
	const title = input.title.trim().slice(0, 160) || "New page";
	return {
		version: 2,
		id: input.id ?? "page-draft",
		slug: "home",
		status: "draft",
		title,
		locale: input.locale && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.locale) ? input.locale : "en",
		seo: { title: title.slice(0, 200), description: "" },
		createdAt: stamp,
		updatedAt: stamp,
		blocks: []
	};
}
