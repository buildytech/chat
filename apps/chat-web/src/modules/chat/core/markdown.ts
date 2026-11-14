/**
 * Minimal safe Markdown for model answers: parsed into plain tokens and rendered by Svelte components, never as HTML.
 * Supports headings, paragraphs, - / * / 1. lists, fenced code, **bold**, *italic*, `code` and http(s) links.
 */
export type MdInline =
	| { type: "text"; text: string }
	| { type: "strong"; text: string }
	| { type: "em"; text: string }
	| { type: "code"; text: string }
	| { type: "link"; text: string; href: string };

export type MdBlock =
	| { type: "heading"; level: 1 | 2 | 3; inline: MdInline[] }
	| { type: "paragraph"; inline: MdInline[] }
	| { type: "list"; ordered: boolean; items: MdInline[][] }
	| { type: "code"; text: string };

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;

function safeHref(raw: string): string | null {
	try {
		const url = new URL(raw);
		return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
	} catch {
		return null;
	}
}

export function parseInline(text: string): MdInline[] {
	const out: MdInline[] = [];
	let last = 0;
	for (const match of text.matchAll(INLINE)) {
		const at = match.index ?? 0;
		if (at > last) out.push({ type: "text", text: text.slice(last, at) });
		const token = match[0];
		if (token.startsWith("**") || token.startsWith("__")) out.push({ type: "strong", text: token.slice(2, -2) });
		else if (token.startsWith("`")) out.push({ type: "code", text: token.slice(1, -1) });
		else if (token.startsWith("[")) {
			const close = token.indexOf("](");
			const label = token.slice(1, close);
			const href = safeHref(token.slice(close + 2, -1));
			out.push(href ? { type: "link", text: label, href } : { type: "text", text: label });
		} else out.push({ type: "em", text: token.slice(1, -1) });
		last = at + token.length;
	}
	if (last < text.length) out.push({ type: "text", text: text.slice(last) });
	return out;
}

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export function parseMarkdown(source: string): MdBlock[] {
	const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
	const blocks: MdBlock[] = [];
	let paragraph: string[] = [];
	let list: { ordered: boolean; items: string[] } | null = null;
	const flushParagraph = () => {
		if (paragraph.length) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
		paragraph = [];
	};
	const flushList = () => {
		if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
		list = null;
	};
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!;
		if (line.trim().startsWith("```")) {
			flushParagraph();
			flushList();
			const body: string[] = [];
			i += 1;
			while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
				body.push(lines[i]!);
				i += 1;
			}
			blocks.push({ type: "code", text: body.join("\n") });
			continue;
		}
		if (!line.trim()) {
			flushParagraph();
			flushList();
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading) {
			flushParagraph();
			flushList();
			const level = Math.min(3, heading[1]!.length) as 1 | 2 | 3;
			blocks.push({ type: "heading", level, inline: parseInline(heading[2]!.trim()) });
			continue;
		}
		const bullet = BULLET.exec(line);
		const numbered = bullet ? null : NUMBERED.exec(line);
		if (bullet || numbered) {
			flushParagraph();
			const ordered = Boolean(numbered);
			if (list && list.ordered !== ordered) flushList();
			list ??= { ordered, items: [] };
			list.items.push((bullet ?? numbered)![1]!.trim());
			continue;
		}
		if (list && /^\s{2,}\S/.test(line)) {
			list.items[list.items.length - 1] += ` ${line.trim()}`;
			continue;
		}
		flushList();
		paragraph.push(line.trim());
	}
	flushParagraph();
	flushList();
	return blocks;
}
