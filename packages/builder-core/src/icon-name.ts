import { lucideIcons } from "./catalog/props-schema.ts";

/**
 * Row icon names from the model against the contract's Lucide enum (ADR 0023): spelling variants (case, camel case,
 * spaces, underscores, an `icon` / `lucide` prefix or suffix, a plural) map to the published name, a typo maps to
 * the one published name within edit distance 1 (2 from 8 characters), anything else is dropped. Generic over the enum: no word lists.
 * The props gate never sees a name outside the enum, so no repair round is spent on icons.
 */

export type IconFix = { from: string; to: string | null };

let INDEX: { names: Set<string>; byKey: Map<string, string> } | null = null;

function key(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function index() {
	if (INDEX) return INDEX;
	const names = new Set(lucideIcons());
	const byKey = new Map<string, string>();
	for (const name of names) if (!byKey.has(key(name))) byKey.set(key(name), name);
	INDEX = { names, byKey };
	return INDEX;
}

function kebab(raw: string): string {
	return raw
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[\s_.]+/g, "-")
		.toLowerCase()
		.replace(/^(?:lucide|icon)-/, "")
		.replace(/-(?:icon)$/, "");
}

function distance(a: string, b: string, max: number): number {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i += 1) {
		const row = [i];
		let best = i;
		for (let j = 1; j <= b.length; j += 1) {
			row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
			best = Math.min(best, row[j]!);
		}
		if (best > max) return max + 1;
		prev = row;
	}
	return prev[b.length]!;
}

/** The published icon name for a model's name, or null when none is close enough. */
export function resolveIconName(raw: string): string | null {
	const { names, byKey } = index();
	if (!names.size) return raw;
	if (names.has(raw)) return raw;
	const name = kebab(raw);
	if (names.has(name)) return name;
	const hit = byKey.get(key(name)) ?? (name.endsWith("s") ? byKey.get(key(name.slice(0, -1))) : undefined);
	if (hit) return hit;
	// Typos only: one edit from 5 characters, two from 8; never a short or loose guess.
	const max = name.length >= 8 ? 2 : name.length >= 5 ? 1 : 0;
	if (!max) return null;
	const near = [...names].filter((candidate) => distance(name, candidate, max) <= max);
	return near.length === 1 ? near[0]! : null;
}

/** Published icon names closest to a name that matched nothing: substring matches first, then edit distance (for the error the agent reads). */
export function closestIconNames(raw: string, limit = 6): string[] {
	const { names } = index();
	const name = kebab(raw);
	const k = key(name);
	if (!k) return [];
	const rank = (candidate: string): number => {
		const ck = key(candidate);
		if (ck.startsWith(k) || k.startsWith(ck)) return 0;
		if (ck.includes(k) || k.includes(ck)) return 1;
		return 2 + distance(name, candidate, 6);
	};
	return [...names]
		.map((candidate) => ({ candidate, score: rank(candidate) }))
		.filter((row) => row.score <= 5)
		.sort((a, b) => a.score - b.score || a.candidate.localeCompare(b.candidate))
		.slice(0, limit)
		.map((row) => row.candidate);
}

/** Warning text for the icon fixes of one proposal (mapped and dropped). */
export function iconFixWarning(fixes: readonly IconFix[]): string | null {
	if (!fixes.length) return null;
	const mapped = fixes.filter((fix) => fix.to);
	const dropped = [...new Set(fixes.filter((fix) => !fix.to).map((fix) => fix.from))];
	const parts: string[] = [];
	if (mapped.length) parts.push(`row icons mapped to the published Lucide names: ${[...new Set(mapped.map((fix) => `${fix.from} -> ${fix.to}`))].join(", ")}`);
	if (dropped.length) parts.push(`row icons not in the published Lucide names were dropped (those rows render without an icon): ${dropped.join(", ")}`);
	const text = parts.join("; ");
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
