/**
 * Field-level selection (ADR 0021): builder-core `view-map.ts` resolves a block's generated viewMap against a rendered
 * block — a prop pointer to its element and an element back to its pointer. It runs on any minimal tree, so these tests
 * build one by hand (no DOM) and check it against the real team-simple viewMap pinned in props.json.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	fieldAtElement,
	listRows,
	locateField,
	mapKey,
	mappedPointers,
	valueAt,
	viewMapOf,
	type ViewElement
} from "../../packages/builder-core/src/index.ts";

/** A minimal element: enough for view-map.ts (element children, attributes, text in document order). */
class El implements ViewElement {
	children: El[] = [];
	nodes: Array<El | string> = [];
	tag: string;
	attrs: Record<string, string>;
	constructor(tag: string, attrs: Record<string, string> = {}) {
		this.tag = tag;
		this.attrs = attrs;
	}
	getAttribute(name: string): string | null {
		return this.attrs[name] ?? null;
	}
	get textContent(): string {
		return this.nodes.map((n) => (typeof n === "string" ? n : n.textContent)).join(" ");
	}
	add(...kids: Array<El | string>): this {
		for (const k of kids) {
			this.nodes.push(k);
			if (typeof k !== "string") this.children.push(k);
		}
		return this;
	}
}

const props = {
	landmarkLabel: "The studio",
	title: "The people",
	description: "Three people, one flat at a time.",
	members: [
		{ id: "anna", title: "Anna Petrova", description: "Lead designer" },
		{ id: "ilya", title: "Ilya Sorokin", description: "Plans and drawings" }
	]
};

/** A cards-variant team-simple render: a heading and a paragraph, then a member row per person (the row is the card surface itself) with the name and the line. */
function render() {
	const root = new El("section", { "data-slot": "team-simple", "aria-label": "The studio" });
	const h2 = new El("h2").add("The people");
	const lead = new El("p").add("Three people, one flat at a time.");
	root.add(h2, lead);
	const rows: El[] = [];
	for (const m of props.members) {
		const row = new El("li", { "data-slot": "member" });
		row.add(new El("h3").add(m.title), new El("p").add(m.description));
		root.add(row);
		rows.push(row);
	}
	return { root, h2, lead, rows };
}

test("view map: mapKey turns indices into [] and records the list rows", () => {
	assert.deepEqual(mapKey("/members/2/title"), { key: "/members/[]/title", rows: [{ list: "/members", index: 2 }] });
	assert.deepEqual(mapKey("/title"), { key: "/title", rows: [] });
});

test("view map: valueAt reads a leaf and nothing for a missing or compound path", () => {
	assert.equal(valueAt(props, "/title"), "The people");
	assert.equal(valueAt(props, "/members/1/title"), "Ilya Sorokin");
	assert.equal(valueAt(props, "/members"), undefined);
	assert.equal(valueAt(props, "/missing"), undefined);
});

test("view map: mappedPointers expands list keys over the lists actually present", () => {
	const map = viewMapOf("team-simple");
	assert.ok(map, "team-simple has a view map");
	const pointers = mappedPointers(map!, props);
	assert.ok(pointers.includes("/title"));
	assert.ok(pointers.includes("/members/0/title"));
	assert.ok(pointers.includes("/members/1/description"));
	assert.ok(!pointers.includes("/members/2/title"));
});

test("view map: a pointer resolves to the element that shows it", () => {
	const map = viewMapOf("team-simple")!;
	const { root, h2, lead, rows } = render();
	// team-simple's view map names no slot for its heading and paragraph: they pin the section itself
	assert.equal(locateField(root, map, props, "/title"), root);
	assert.equal(locateField(root, map, props, "/description"), root);
	assert.equal(locateField(root, map, props, "/landmarkLabel"), root);
	void h2;
	void lead;
	// a member field pins the member row that holds it (the row is the card surface: no card inside it)
	assert.equal(locateField(root, map, props, "/members/0/title"), rows[0]);
	assert.equal(locateField(root, map, props, "/members/1/description"), rows[1]);
	// a row index past the list has no element
	assert.equal(locateField(root, map, props, "/members/5/title"), null);
});

test("view map: an element resolves back to its pointer (fields before the row that holds them)", () => {
	const map = viewMapOf("team-simple")!;
	const { root, h2, rows } = render();
	assert.equal(fieldAtElement(root, map, props, h2), "/title");
	const name1 = rows[1]!.children[0]!;
	assert.equal(fieldAtElement(root, map, props, name1), "/members/1/title");
	const line0 = rows[0]!.children[1]!;
	// the row shows the name and the line; a click in it selects the first field the view map lists for it
	assert.equal(fieldAtElement(root, map, props, line0), "/members/0/title");
	// on the section itself the first text field wins over the landmark attribute
	assert.equal(fieldAtElement(root, map, props, root), "/title");
});

test("view map: listRows returns the rows of a list in order", () => {
	const map = viewMapOf("team-simple")!;
	const { root, rows } = render();
	assert.deepEqual(listRows(root, map, "/members"), rows);
});
