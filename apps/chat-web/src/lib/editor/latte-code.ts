// CodeMirror 6 extensions for Latte + HTML (StreamLanguage) and JSON.
// Colours live in src/styles/editor.css; this file emits cm-syn-* classes.
import {
	Decoration,
	EditorView,
	ViewPlugin,
	drawSelection,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	type DecorationSet,
	type ViewUpdate
} from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateEffect, type Extension } from "@codemirror/state";
import {
	LanguageSupport,
	StreamLanguage,
	indentUnit,
	syntaxHighlighting,
	type StringStream
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { tagHighlighter, tags as t } from "@lezer/highlight";

/** Lezer tag → CSS class (cm-syn-*). The class → colour-role mapping is in editor.css. */
export const latteHighlighter = tagHighlighter([
	{
		tag: [
			t.keyword,
			t.moduleKeyword,
			t.definitionKeyword,
			t.controlKeyword,
			t.operatorKeyword,
			t.modifier,
			t.definitionOperator,
			t.operator
		],
		class: "cm-syn-keyword"
	},
	{ tag: [t.brace, t.paren, t.squareBracket, t.special(t.brace)], class: "cm-syn-punct" },
	{ tag: [t.string, t.special(t.string), t.attributeValue], class: "cm-syn-string" },
	{ tag: [t.function(t.variableName), t.function(t.propertyName)], class: "cm-syn-fn" },
	{ tag: t.comment, class: "cm-syn-comment" }
]);

const MACRO =
	/^(?:\/)?(?:ifchanged|continueIf|breakIf|elseif|contentType|templatePrint|templateType|iterateWhile|ifset|isset|else|foreach|embed|define|block|snippet|capture|include|extends|layout|import|sandbox|spaceless|translate|syntax|rollback|recovery|debugbreak|default|switch|case|first|last|while|area|asset|cache|dump|status|try|var|php|sep|for|do|if|l|r)\b/;

type Mode = "html" | "tag" | "latte" | "comment" | "htmlcomment";

type LatteState = {
	mode: Mode;
	quote: string | null;
};

function tokenString(stream: StringStream, state: LatteState): string {
	const quote = state.quote!;
	while (!stream.eol()) {
		const ch = stream.next();
		if (ch === "\\" && !stream.eol()) {
			stream.next();
			continue;
		}
		if (ch === quote) {
			state.quote = null;
			break;
		}
	}
	return "string";
}

function tokenLatte(stream: StringStream, state: LatteState): string | null {
	if (state.quote) return tokenString(stream, state);
	if (stream.eat("}")) {
		state.mode = "html";
		return "punct";
	}
	if (stream.eatSpace()) return null;
	if (stream.match(MACRO)) return "keyword";
	if (stream.match(/^\$[A-Za-z_][\w]*/)) return "fn";
	if (stream.eat("|")) return "punct";
	if (stream.match(/^[A-Za-z_][\w]*/)) return "fn";
	const next = stream.peek();
	if (next === '"' || next === "'") {
		state.quote = next;
		stream.next();
		return tokenString(stream, state);
	}
	if (stream.match(/^(?:===|!==|==|!=|<=|>=|=>|&&|\|\||->)/) || stream.match(/^[<>!=?:+\-*/%.]/)) {
		return "keyword";
	}
	if (stream.eat(/[()[\],;]/)) return "punct";
	if (stream.match(/^\d+(?:\.\d+)?/)) return "fn";
	stream.next();
	return null;
}

function tokenTag(stream: StringStream, state: LatteState): string | null {
	if (state.quote) return tokenString(stream, state);
	if (stream.eatSpace()) return null;
	if (stream.match("/>") || stream.eat(">")) {
		state.mode = "html";
		return "punct";
	}
	if (stream.match("{*")) {
		state.mode = "comment";
		return "comment";
	}
	if (stream.eat("{")) {
		state.mode = "latte";
		return "punct";
	}
	if (stream.match(/^[A-Za-z_:][\w:.-]*/)) return "fn";
	if (stream.eat("=")) return "punct";
	const next = stream.peek();
	if (next === '"' || next === "'") {
		state.quote = next;
		stream.next();
		return tokenString(stream, state);
	}
	stream.next();
	return null;
}

function token(stream: StringStream, state: LatteState): string | null {
	if (state.mode === "comment") {
		if (stream.match("*}")) {
			state.mode = "html";
		} else {
			stream.next();
			while (!stream.eol() && !stream.match("*}", false)) stream.next();
		}
		return "comment";
	}
	if (state.mode === "htmlcomment") {
		if (stream.match("-->")) {
			state.mode = "html";
		} else {
			stream.next();
			while (!stream.eol() && !stream.match("-->", false)) stream.next();
		}
		return "comment";
	}
	if (state.mode === "latte") return tokenLatte(stream, state);
	if (state.mode === "tag") return tokenTag(stream, state);

	if (stream.match("{*")) {
		state.mode = "comment";
		return "comment";
	}
	if (stream.match("{{")) return null;
	if (stream.eat("{")) {
		state.mode = "latte";
		return "punct";
	}
	if (stream.match("<!--")) {
		state.mode = "htmlcomment";
		return "comment";
	}
	if (stream.match(/^<\/?[!A-Za-z][\w:-]*/)) {
		state.mode = "tag";
		return "keyword";
	}
	if (stream.match(/^[^{<]+/)) return null;
	stream.next();
	return null;
}

const latteLanguage = StreamLanguage.define<LatteState>({
	name: "latte",
	startState: (): LatteState => ({ mode: "html", quote: null }),
	token,
	tokenTable: {
		keyword: t.keyword,
		string: t.string,
		comment: t.comment,
		punct: t.brace,
		fn: t.function(t.variableName)
	}
});

/** Re-run the layout pass (e.g. after web fonts finish loading). */
export const remeasure = StateEffect.define<null>();

/**
 * Light indent guides: leading spaces become `cm-indent` marks and
 * `--depth` drives the 16px guide lines in editor.css. No Figma string-hang.
 */
const codeLayout = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = this.build(view);
		}
		update(u: ViewUpdate) {
			if (
				u.docChanged ||
				u.viewportChanged ||
				u.geometryChanged ||
				u.transactions.some((tr) => tr.effects.some((e) => e.is(remeasure)))
			) {
				this.decorations = this.build(u.view);
			}
		}
		build(view: EditorView): DecorationSet {
			const indentSpace = parseFloat(getComputedStyle(view.contentDOM).getPropertyValue("--code-indent-space")) || 8;
			const builder = new RangeSetBuilder<Decoration>();
			for (const { from, to } of view.visibleRanges) {
				for (let pos = from; pos <= to; ) {
					const line = view.state.doc.lineAt(pos);
					const lead = /^ */.exec(line.text)![0].length;
					const hang = lead * indentSpace;
					builder.add(
						line.from,
						line.from,
						Decoration.line({
							attributes: {
								class: "cm-code-line",
								style: `--depth:${Math.floor(lead / 2)};--hang:${hang.toFixed(3)}px`
							}
						})
					);
					if (lead > 0) builder.add(line.from, line.from + lead, Decoration.mark({ class: "cm-indent" }));
					pos = line.to + 1;
				}
			}
			return builder.finish();
		}
	},
	{ decorations: (v) => v.decorations }
);

export type LatteCodeOptions = {
	editable?: boolean;
	language?: "latte" | "json";
};

/** Full extension set: CodeMirror with Latte StreamLanguage (or JSON) and CSS syntax classes. */
export function latteCode({ editable = true, language = "latte" }: LatteCodeOptions = {}): Extension {
	return [
		lineNumbers(),
		highlightActiveLineGutter(),
		highlightActiveLine(),
		history(),
		drawSelection(),
		keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
		EditorView.lineWrapping,
		EditorState.tabSize.of(2),
		indentUnit.of("  "),
		language === "json" ? json() : new LanguageSupport(latteLanguage),
		syntaxHighlighting(latteHighlighter),
		codeLayout,
		EditorView.editable.of(editable),
		EditorView.contentAttributes.of({ "aria-label": "Code editor" })
	];
}
