import type { CreatorPage } from "./page";

/** Current landing page fixture. Replace with PagePort when the store is live. */
export const mockLandingPage: CreatorPage = {
	id: "page-home",
	slug: "home",
	status: "draft",
	title: "Home",
	layout: {
		version: 1,
		blocks: [
			{
				id: "block-hero",
				kind: "hero",
				title: "Hero",
				summary: "Headline and a short promise. No fabricated promo."
			},
			{
				id: "block-features",
				kind: "features",
				title: "Features",
				summary: "Three ordinary points. No checkout, no stock numbers."
			},
			{
				id: "block-cta",
				kind: "cta",
				title: "Call to action",
				summary: "A single button that does not start payment."
			},
			{
				id: "block-footer",
				kind: "footer",
				title: "Footer",
				summary: "Contact line and copyright."
			}
		]
	},
	seo: {
		title: "Home",
		description: "Ordinary landing page with a unique slug."
	},
	locale: "en",
	createdAt: "2026-11-06T00:00:00.000Z",
	updatedAt: "2026-11-06T00:00:00.000Z"
};

let currentPage = $state<CreatorPage>(mockLandingPage);

/** Pure read — do not mutate inside $derived. */
export function getCurrentPage(): CreatorPage {
	return currentPage;
}
