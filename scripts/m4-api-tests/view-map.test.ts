/**
 * Field-level selection (ADR 0021): builder-core `view-map.ts` resolves a block's generated viewMap against a rendered
 * block — a prop pointer to its element and an element back to its pointer. It runs on any minimal tree, so these tests
 * build one by hand (no DOM) and check it against the real feature-grid viewMap pinned in props.json.
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
	landmarkLabel: "Our features",
	title: "Why teams choose us",
	features: [
		{ icon: "zap", title: "Fast", text: "Blazing speed" },
		{ icon: "shield", title: "Secure", text: "Safe by default" }
	]
};

/** A card-variant feature-grid render: a section header, then a card per feature holding an icon, a title and a text. */
function render() {
	const root = new El("section", { "data-slot": "feature-grid", "aria-label": "Our features" });
	const header = new El("div", { "data-slot": "section-header" });
	header.add(new El("h2").add("Why teams choose us"));
	root.add(header);
	const rows: El[] = [];
	for (const f of props.features) {
		const card = new El("div", { "data-slot": "card" });
		const fc = new El("div", { "data-slot": "feature-card" });
		const icon = new El("svg", { "data-slot": "icon", class: `lucide lucide-${f.icon}` });
		const h3 = new El("h3").add(f.title);
		const p = new El("p").add(f.text);
		fc.add(icon, h3, p);
		card.add(fc);
		root.add(card);
		rows.push(card);
	}
	return { root, header, rows };
}

test("view map: mapKey turns indices into [] and records the list rows", () => {
	assert.deepEqual(mapKey("/features/2/title"), { key: "/features/[]/title", rows: [{ list: "/features", index: 2 }] });
	assert.deepEqual(mapKey("/title"), { key: "/title", rows: [] });
});

test("view map: valueAt reads a leaf and nothing for a missing or compound path", () => {
	assert.equal(valueAt(props, "/title"), "Why teams choose us");
	assert.equal(valueAt(props, "/features/1/title"), "Secure");
	assert.equal(valueAt(props, "/features"), undefined);
	assert.equal(valueAt(props, "/missing"), undefined);
});

test("view map: mappedPointers expands list keys over the lists actually present", () => {
	const map = viewMapOf("feature-grid");
	assert.ok(map, "feature-grid has a view map");
	const pointers = mappedPointers(map!, props);
	assert.ok(pointers.includes("/title"));
	assert.ok(pointers.includes("/features/0/title"));
	assert.ok(pointers.includes("/features/1/text"));
	assert.ok(!pointers.includes("/features/2/title"));
});

test("view map: a pointer resolves to the element that shows it", () => {
	const map = viewMapOf("feature-grid")!;
	const { root, header, rows } = render();
	assert.equal(locateField(root, map, props, "/title"), header);
	assert.equal(locateField(root, map, props, "/landmarkLabel"), root);
	assert.equal(locateField(root, map, props, "/features/0/title"), rows[0]);
	assert.equal(locateField(root, map, props, "/features/1/title"), rows[1]);
	// an icon field pins the icon element; a row index past the list has no element
	const icon0 = rows[0].children[0].children[0];
	assert.equal(locateField(root, map, props, "/features/0/icon"), icon0);
	assert.equal(locateField(root, map, props, "/features/5/title"), null);
});

test("view map: an element resolves back to its pointer (fields before the row that holds them)", () => {
	const map = viewMapOf("feature-grid")!;
	const { root, header, rows } = render();
	const h2 = header.children[0];
	assert.equal(fieldAtElement(root, map, props, h2), "/title");
	const icon1 = rows[1].children[0].children[0];
	assert.equal(fieldAtElement(root, map, props, icon1), "/features/1/icon");
	const h3 = rows[0].children[0].children[1];
	assert.equal(fieldAtElement(root, map, props, h3), "/features/0/title");
	// a click on the section root with no mapped field under it is still the block's landmark attribute at most
	assert.equal(fieldAtElement(root, map, props, root), "/landmarkLabel");
});

test("view map: listRows returns the rows of a list in order", () => {
	const map = viewMapOf("feature-grid")!;
	const { root, rows } = render();
	assert.deepEqual(listRows(root, map, "/features"), rows);
});
