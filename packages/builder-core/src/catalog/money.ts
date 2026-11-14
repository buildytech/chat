/**
 * Money props of the registry blocks. Codex v0.4: a money prop is an integer in minor units (`fmtMoney(minor, currency)` divides by
 * 10 ** the digits of the currency: 65000 RUB shows as 650), written beside a `currency` prop of the same object. Which names are
 * money is read from the registry's own sources (scripts/lib/registry-derive.mjs -> money.json), never listed by hand here.
 * The document stores minor units; the author (Inspector) and the model only ever see and write major units (650), converted by
 * toMajor / toMinor at the boundary (page-doc/money-view.ts). No prompt text about minor units: the model never meets them.
 */
import raw from "./money.json" with { type: "json" };

const NAMES = new Set<string>(raw.names);

/** A number prop with this name beside a `currency` prop of its object is money in minor units. */
export const isMoneyName = (name: string): boolean => NAMES.has(name);

/** Digits of the minor unit (ISO 4217), as the registry's format.ts has them: cents for most, none for JPY and KRW. */
export function minorDigits(currency: string): number {
	return currency === "JPY" || currency === "KRW" ? 0 : 2;
}

/** What a new money prop starts from in a sample: 10 whole units (1000 minor units; "$10"). */
export const SAMPLE_MINOR = 1000;

/** Minor units -> the number an author reads (65000 RUB -> 650, 1250 USD -> 12.5). */
export function toMajor(minor: number, currency: string): number {
	const digits = minorDigits(currency);
	return Math.round(minor) / 10 ** digits;
}

/** The number an author typed -> minor units (650 RUB -> 65000, 12.5 USD -> 1250), rounded to whole minor units. */
export function toMinor(major: number, currency: string): number {
	return Math.round(major * 10 ** minorDigits(currency));
}
