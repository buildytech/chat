import en from "./en.json";
import ru from "./ru.json";

export type MessageKey = keyof typeof en.messages;

const catalogs = {
	en: en.messages as Record<string, string>,
	ru: ru.messages as Record<string, string>
} as const;

export const locale = "en" as const;

export function t(key: MessageKey | string): string {
	return catalogs.en[key] ?? catalogs.ru[key] ?? key;
}
