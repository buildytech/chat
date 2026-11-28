/**
 * Ask is read-only (ADR 0071): it cannot apply a page change or a Brand Skin. These helpers read an Ask answer
 * and tell the UI when the model claimed it applied something (so the host can contradict it) and when the
 * text is a style brief the author can send to Design.
 */
export type AskAnswerActions = { claimsApplied: boolean; offersDesign: boolean };

/** A word or phrase at a Unicode letter boundary (Cyrillic included; `\b` is ASCII-only). */
const word = (pattern: string): RegExp => new RegExp(`(?<!\\p{L})${pattern}(?!\\p{L})`, "iu");

const CLAIM_APPLIED: readonly RegExp[] = [
	word("(?:changes?|updates?|edits?|theme|skin|design|palette|styles?)[^\\p{L}.\\n]{0,80}(?:have been|has been|were|was)\\s+applied"),
	word("(?:i(?:'ve| have)?|we have)\\s+applied"),
	word("applied(?: the| your| these)?(?: changes?| theme| skin| design| palette| styles?)"),
	word("(?:it's|they(?:'re| are)|everything(?:'s| is))\\s+(?:been )?applied"),
	word("изменен(?:ия|ие|ий)\\s+(?:успешно\\s+)?(?:примен|внесен|сохранен)\\p{L}*"),
	word("(?:тем[ауы]|скин|палитр[ауые]|оформлени[ея]|дизайн)\\s+(?:успешно\\s+)?примен\\p{L}*"),
	word("применил(?:а|и|о)?"),
	word("применен[аоы]"),
	word("применён[аоы]?")
];

/** Advice that Build or Design should apply it is not a claim that this turn already did. */
const POINTS_TO_MODE = /(?:build|design)\s+(?:makes|will|can|should|does)|переключ\S*\s+в\s+(?:build|design)|пусть\s+это\s+сделает\s+(?:build|design)|сделает\s+(?:build|design)|author applies|build makes it|design makes it/iu;

const STYLE_BRIEF: readonly RegExp[] = [
	word("palettes?"),
	word("(?:colour|color)s?"),
	word("(?:typography|typeface|fonts?|font-family)"),
	word("(?:brand(?:ing)? style|visual identity|mood\\s*board)"),
	/(?:theme|skin)[^\n]{0,40}(?:color|colour|font|palette|radius|type)/iu,
	/(?:color|colour|font|palette|radius|type)[^\n]{0,40}(?:theme|skin)/iu,
	/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i,
	word("оформлен\\p{L}*"),
	word("палитр\\p{L}*"),
	word("шрифт\\p{L}*"),
	word("типограф\\p{L}*"),
	word("бренд[\\s-]?стил\\p{L}*"),
	word("цвет(?:а|ов|овая|овой|овую|ом)?"),
	word("скин"),
	word("тем[аеуы]\\s+(?:сайт\\p{L}*|бренд\\p{L}*|страниц\\p{L}*)")
];

export function askClaimsApplied(text: string): boolean {
	const value = text.trim();
	if (!value) return false;
	if (!CLAIM_APPLIED.some((re) => re.test(value))) return false;
	if (POINTS_TO_MODE.test(value) && !word("(?:я|i)\\s+применил(?:а|и|о)?|(?:i(?:'ve| have)?)\\s+applied").test(value)) {
		const withoutAdvice = value.replace(/[^.!?\n]*(?:build|design)[^.!?\n]*/giu, " ");
		return CLAIM_APPLIED.some((re) => re.test(withoutAdvice));
	}
	return true;
}

export function askOffersDesign(text: string): boolean {
	return STYLE_BRIEF.some((re) => re.test(text));
}

export function askAnswerActions(text: string): AskAnswerActions {
	return { claimsApplied: askClaimsApplied(text), offersDesign: askOffersDesign(text) };
}
