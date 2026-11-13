import en from "./en.json";
import ru from "./ru.json";
import { uiLocale } from "./locale.svelte.ts";

export type MessageKey = keyof typeof en.messages;

const catalogs = {
	en: en.messages as Record<string, string>,
	ru: ru.messages as Record<string, string>
} as const;

export function t(key: MessageKey | string): string {
	const lang = uiLocale.current;
	return catalogs[lang][key] ?? catalogs.en[key] ?? key;
}
