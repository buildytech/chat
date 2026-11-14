import en from "./en.json";
import ru from "./ru.json";
import { uiLocale } from "./locale.svelte.ts";

export type MessageKey = keyof typeof en.messages;

const catalogs = {
	en: { ...en.messages } as Record<string, string>,
	ru: { ...ru.messages } as Record<string, string>
};

export type MessageSet = { en: Record<string, string>; ru: Record<string, string> };

/**
 * A module adds its own messages (keys it owns, never a core key) and may word core keys its own way (`overrides`: the
 * core says "New project", the chat says "New chat"). Registered before the first render that shows them.
 */
export function registerMessages(messages: MessageSet, overrides?: MessageSet): void {
	Object.assign(catalogs.en, messages.en, overrides?.en);
	Object.assign(catalogs.ru, messages.ru, overrides?.ru);
}

export function t(key: MessageKey | string): string {
	const lang = uiLocale.current;
	return catalogs[lang][key] ?? catalogs.en[key] ?? key;
}
