import en from "./en.json";
import ru from "./ru.json";

export type MessageKey = keyof typeof ru.messages;

const catalogs = {
	ru: ru.messages as Record<string, string>,
	en: en.messages as Record<string, string>
} as const;

export const locale = "ru" as const;

export function t(key: MessageKey | string): string {
	return catalogs.ru[key] ?? catalogs.en[key] ?? key;
}
