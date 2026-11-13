/** Chat UI language. Absent or unknown stored values stay English. Not the page's own locale. */
export const UI_LOCALES = ["en", "ru"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export function parseLocale(raw: unknown): UiLocale {
	return raw === "ru" ? "ru" : "en";
}
