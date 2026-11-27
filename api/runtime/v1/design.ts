// @ts-nocheck
/* Bundled Vercel Function entry. Do not import workspace .ts at runtime. */
import __ext_ajv2020 from "ajv/dist/2020.js";
// The render probe's compiled registry blocks (scripts/build-render-bundle.mjs): a sibling file the function traces.
globalThis.__buildyRenderLoader = () => import("../_render/blocks.mjs");
const __mods = Object.create(null);
function __def(id, factory) {
	__mods[id] = { factory, exports: undefined };
}
function __req(id) {
	const rec = __mods[id];
	if (!rec) throw new Error("missing bundled module " + id);
	if (rec.exports) return rec.exports;
	const exports = {};
	rec.exports = exports;
	rec.factory(exports);
	return exports;
}

__def("apps/xai-runtime/src/config.ts", function (exports) {

const runtimeEnv = (): EnvMap => process.env;

type ServerConfig = { bind: string; port: number };

/** Where the local Node server listens; loopback unless BUILDY_RUNTIME_BIND says otherwise (then Basic Auth is required). */
function readServerConfig(env: EnvMap): ServerConfig {
	const port = Number(env.BUILDY_RUNTIME_PORT || 18100);
	return { bind: env.BUILDY_RUNTIME_BIND?.trim() || "127.0.0.1", port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 18100 };
}

exports["runtimeEnv"] = runtimeEnv;
exports["readServerConfig"] = readServerConfig;

});

__def("packages/builder-core/src/copy.ts", function (exports) {

const SCENARIO_IDS = ["dashboard", "landing", "website"] as const;
const PLACEHOLDER_MODES = ["default", "dashboard", "landing", "website"] as const;
const SCENARIO_PROMPTS: Record<
	ScenarioId,
	{ id: ScenarioId; version: string; label: string; text: string }
> = {
	dashboard: {
		id: "dashboard",
		version: "1",
		label: "Dashboard",
		text: "Create a responsive dashboard using UI8Kit rules and contracts. Use only blocks and variants that are actually available and compatible with the current catalog. Start with a clear navigation structure, a concise overview, useful metrics, and an appropriate data section. Ask me about the audience, data, and primary tasks when needed. Inspect block details before proposing a layout, and wait for me to apply the proposal."
	},
	landing: {
		id: "landing",
		version: "1",
		label: "Landing",
		text: "Create a responsive landing page using UI8Kit rules and contracts. Use only blocks and variants that are actually available and compatible with the current catalog. Organize the page around a clear value proposition, relevant benefits, trustworthy evidence, and one primary call to action. Ask me for the offer, audience, and real business facts instead of inventing claims. Inspect block details before proposing a layout, and wait for me to apply the proposal."
	},
	website: {
		id: "website",
		version: "1",
		label: "Website",
		text: "Create a responsive website using UI8Kit rules and contracts. Use only blocks and variants that are actually available and compatible with the current catalog. Begin with a coherent home page, useful navigation, and sections that explain the business and guide visitors to the next step. Ask me which additional pages and verified content are needed; do not invent working services or integrations. Inspect block details before proposing a layout, and wait for me to apply the proposal."
	}
};

const PLACEHOLDERS: Record<PlaceholderMode, string[]> = {
	default: [
		"Ask BuildY to create an app using UI8Kit rules and contracts.",
		"Ask BuildY to create a website using UI8Kit rules and contracts.",
		"Ask BuildY to create a dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a CRM interface using UI8Kit rules and contracts.",
		"Ask BuildY to create an e-commerce storefront using UI8Kit rules and contracts."
	],
	dashboard: [
		"Ask BuildY to create a personal dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a CMS admin dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create an analytics dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a sales dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a project management dashboard using UI8Kit rules and contracts."
	],
	landing: [
		"Ask BuildY to create a SaaS landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create a product launch landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create a service landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create an event landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create a newsletter signup landing page using UI8Kit rules and contracts."
	],
	website: [
		"Ask BuildY to create a small business website using UI8Kit rules and contracts.",
		"Ask BuildY to create a portfolio website using UI8Kit rules and contracts.",
		"Ask BuildY to create a restaurant website using UI8Kit rules and contracts.",
		"Ask BuildY to create an agency website using UI8Kit rules and contracts.",
		"Ask BuildY to create an educational website using UI8Kit rules and contracts."
	]
};

const PLACEHOLDER_ROTATION_MS = 6000;

const OWNER_FILTERS = {
	blank: { type: "screen" as const },
	dashboard: { type: "screen" as const, section: "dashboard" },
	landing: { type: "screen" as const, site: "landing" },
	website: { type: "screen" as const, site: "website" }
} as const;

exports["SCENARIO_IDS"] = SCENARIO_IDS;
exports["PLACEHOLDER_MODES"] = PLACEHOLDER_MODES;
exports["SCENARIO_PROMPTS"] = SCENARIO_PROMPTS;
exports["PLACEHOLDERS"] = PLACEHOLDERS;
exports["PLACEHOLDER_ROTATION_MS"] = PLACEHOLDER_ROTATION_MS;
exports["OWNER_FILTERS"] = OWNER_FILTERS;

});

__def("packages/builder-core/src/catalog/sources.json", function (exports) {
  exports.default = {
	"format": "buildy-catalog-sources",
	"version": 3,
	"registry": "https://registry.buildy.tw/svelte",
	"cli": "ui8kit@3.5.0",
	"lockDigest": "sha256:6039c50d32dbe0ae2a1da10a600a1efa96714213110724b08815212c1fa5b227",
	"variants": {
		"url": "https://registry.buildy.tw/variants/v0.json",
		"sha256": "1f134afb31893ab74650e2f80083a3bdb592359d55f0d14ee2108bca24bde02b",
		"digest": "sha256:9e70b8612956517e1c7644d94657be0a75f61b1a96d400a70e37ab4893b2422a"
	},
	"props": {
		"url": "https://registry.buildy.tw/props/v0.json",
		"sha256": "856ff7aa2b2c0ef21a8b7fea3c30c07aa576c6a6fc97f630841b5a2e1870c18c",
		"digest": "sha256:6b23550c053ab0735abb93c87808380962555f589ac9dc2cf71a5e11e11e3a2f"
	},
	"initItems": [
		"presets",
		"recipes",
		"utils"
	],
	"npmDependencies": [
		"clsx",
		"lucide",
		"tailwind-merge"
	],
	"items": {
		"alert": {
			"type": "registry:ui",
			"title": "Alert",
			"description": "Alert primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Alert.svelte"
			]
		},
		"amenities-simple": {
			"type": "registry:block",
			"title": "Amenities Simple",
			"description": "The heading, one paragraph and the amenities of a stay or a venue as short names: muted rows in three or two columns, or outlined pills in a wrapping row.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/amenities-simple.svelte",
				"src/blocks/amenities-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/amenities-simple/1.json",
				"group": "features",
				"kind": "block",
				"model": "amenities@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"article-lead": {
			"type": "registry:block",
			"title": "Article Lead",
			"description": "The head of an article: the heading, the lead paragraph and the byline (the portrait, the author, the date) under a wide cover, or beside it.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"group",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/article-lead.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/article-lead/1.json",
				"group": "story",
				"kind": "block",
				"model": "article-lead@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"article-simple": {
			"type": "registry:block",
			"title": "Article Simple",
			"description": "The heading, one paragraph and the sections of a text (a subheading and its paragraph): one reading column, or two columns under a centred head.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/article-simple.svelte",
				"src/blocks/article-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/article-simple/1.json",
				"group": "story",
				"kind": "block",
				"model": "article@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"badge": {
			"type": "registry:ui",
			"title": "Badge",
			"description": "Badge primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Badge.svelte"
			]
		},
		"block": {
			"type": "registry:ui",
			"title": "Block",
			"description": "Block primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Block.svelte"
			]
		},
		"box": {
			"type": "registry:ui",
			"title": "Box",
			"description": "Box primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Box.svelte"
			]
		},
		"breadcrumb": {
			"type": "registry:ui",
			"title": "Breadcrumb",
			"description": "Breadcrumb primitive",
			"registryDependencies": [
				"kit-box",
				"kit-link",
				"kit-text",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Breadcrumb.svelte"
			]
		},
		"button": {
			"type": "registry:ui",
			"title": "Button",
			"description": "Button primitive",
			"registryDependencies": [
				"kit-button",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Button.svelte"
			]
		},
		"button-plain": {
			"type": "registry:ui",
			"title": "Button Plain",
			"description": "Button Plain primitive",
			"registryDependencies": [
				"kit-button",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/ButtonPlain.svelte"
			]
		},
		"card": {
			"type": "registry:ui",
			"title": "Card",
			"description": "Card primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Card.svelte"
			]
		},
		"card-content": {
			"type": "registry:ui",
			"title": "Card Content",
			"description": "Card Content primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/CardContent.svelte"
			]
		},
		"card-description": {
			"type": "registry:ui",
			"title": "Card Description",
			"description": "Card Description primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/CardDescription.svelte"
			]
		},
		"card-footer": {
			"type": "registry:ui",
			"title": "Card Footer",
			"description": "Card Footer primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/CardFooter.svelte"
			]
		},
		"card-header": {
			"type": "registry:ui",
			"title": "Card Header",
			"description": "Card Header primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/CardHeader.svelte"
			]
		},
		"card-title": {
			"type": "registry:ui",
			"title": "Card Title",
			"description": "Card Title primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/CardTitle.svelte"
			]
		},
		"cases-simple": {
			"type": "registry:block",
			"title": "Cases Simple",
			"description": "The heading, one paragraph and the case studies (a picture, the client, the title as a link, the result in one line): on cards in three or two columns, or rows with the picture at the start.",
			"registryDependencies": [
				"block",
				"container",
				"link-plain",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/cases-simple.svelte",
				"src/blocks/cases-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/cases-simple/1.json",
				"group": "proof",
				"kind": "block",
				"model": "cases@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"chapters-simple": {
			"type": "registry:block",
			"title": "Chapters Simple",
			"description": "The heading, one paragraph and the chapters (a picture, a label, the title, a paragraph): rows with the picture at the side, or a pair with the picture under the copy.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/chapters-simple.svelte",
				"src/blocks/chapters-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/chapters-simple/1.json",
				"group": "story",
				"kind": "block",
				"model": "chapters@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"checkbox": {
			"type": "registry:ui",
			"title": "Checkbox",
			"description": "Checkbox primitive",
			"registryDependencies": [
				"kit-checkbox",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Checkbox.svelte"
			]
		},
		"choice-links": {
			"type": "registry:block",
			"title": "Choice Links",
			"description": "The heading, one paragraph and the options (sizes, versions) as outline links: a wrapping row, or a grid of four.",
			"registryDependencies": [
				"block",
				"container",
				"link-button",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/choice-links.svelte",
				"src/blocks/choice-links.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/choice-links/1.json",
				"group": "product",
				"kind": "block",
				"model": "choices@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"collections-simple": {
			"type": "registry:block",
			"title": "Collections Simple",
			"description": "The heading, one paragraph and the collections (a picture and the name as one link) in four or two columns.",
			"registryDependencies": [
				"block",
				"container",
				"link-plain",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/collections-simple.svelte",
				"src/blocks/collections-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/collections-simple/1.json",
				"group": "catalog",
				"kind": "block",
				"model": "collections@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"compare-simple": {
			"type": "registry:block",
			"title": "Compare Simple",
			"description": "The heading, one paragraph and two options side by side: their names in a header row, then a row per feature with the value of each.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/compare-simple.svelte",
				"src/blocks/compare-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/compare-simple/1.json",
				"group": "product",
				"kind": "block",
				"model": "compare@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"compose": {
			"type": "registry:ui",
			"title": "Compose",
			"description": "Barrel of the composed primitives (compose/index), imported by components and blocks",
			"registryDependencies": [
				"alert",
				"badge",
				"block",
				"box",
				"breadcrumb",
				"button",
				"button-plain",
				"card",
				"card-content",
				"card-description",
				"card-footer",
				"card-header",
				"card-title",
				"checkbox",
				"container",
				"dialog",
				"disclosure",
				"fieldset",
				"form",
				"form-description",
				"form-item",
				"form-message",
				"grid",
				"grid-col",
				"group",
				"icon",
				"icon-badge",
				"image",
				"inline",
				"input",
				"label",
				"legend",
				"link",
				"link-button",
				"link-plain",
				"list",
				"list-item",
				"lucide-icon",
				"meter",
				"opt-group",
				"progress",
				"prose",
				"radio",
				"range",
				"recipes",
				"select",
				"select-option",
				"separator",
				"sheet",
				"sheet-close",
				"sheet-trigger",
				"skeleton",
				"stack",
				"summary",
				"switch",
				"table",
				"table-body",
				"table-caption",
				"table-cell",
				"table-col",
				"table-col-group",
				"table-foot",
				"table-head",
				"table-head-cell",
				"table-row",
				"text",
				"textarea",
				"theme-toggle",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/index.ts"
			]
		},
		"contacts-simple": {
			"type": "registry:block",
			"title": "Contacts Simple",
			"description": "The heading, one paragraph and the teams to reach on cards (an icon, the name, a line, an action): in three or two columns, or rows with the icon at the side.",
			"registryDependencies": [
				"block",
				"container",
				"link-button",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/contacts-simple.svelte",
				"src/blocks/contacts-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/contacts-simple/1.json",
				"group": "contact",
				"kind": "block",
				"model": "contacts@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"container": {
			"type": "registry:ui",
			"title": "Container",
			"description": "Container primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Container.svelte"
			]
		},
		"course-outline": {
			"type": "registry:block",
			"title": "Course Outline",
			"description": "The heading, one paragraph and the modules in order (a label, the title, a line, the length): rows in a narrow column, or two columns of cards.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/course-outline.svelte",
				"src/blocks/course-outline.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/course-outline/1.json",
				"group": "how-it-works",
				"kind": "block",
				"model": "curriculum@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"cta-simple": {
			"type": "registry:block",
			"title": "Cta Simple",
			"description": "One band: a badge when set, the heading, one paragraph and up to two buttons; centred or at the start, or the buttons at the end; on a muted or an outlined surface.",
			"registryDependencies": [
				"badge",
				"block",
				"box",
				"container",
				"group",
				"link-button",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/cta-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/cta-simple/1.json",
				"group": "cta",
				"kind": "block",
				"model": "cta@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"delivery-simple": {
			"type": "registry:block",
			"title": "Delivery Simple",
			"description": "The heading, one paragraph and the delivery zones (the area, the time, the minimum order, the price): card rows with the price at the end, or cards in three columns.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/delivery-simple.svelte",
				"src/blocks/delivery-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/delivery-simple/1.json",
				"group": "delivery",
				"kind": "block",
				"model": "delivery@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"dialog": {
			"type": "registry:ui",
			"title": "Dialog",
			"description": "Dialog primitive",
			"registryDependencies": [
				"kit-dialog",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Dialog.svelte"
			]
		},
		"digital-simple": {
			"type": "registry:block",
			"title": "Digital Simple",
			"description": "The heading, one paragraph and the digital goods (the format as a pill, the name as a link, a line, the price): on cards in three columns, or rows with the price at the end.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"link-plain",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/digital-simple.svelte",
				"src/blocks/digital-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/digital-simple/1.json",
				"group": "product",
				"kind": "block",
				"model": "digital@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"disclosure": {
			"type": "registry:ui",
			"title": "Disclosure",
			"description": "Disclosure primitive",
			"registryDependencies": [
				"kit-disclosure",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Disclosure.svelte"
			]
		},
		"error-simple": {
			"type": "registry:block",
			"title": "Error Simple",
			"description": "A page for something that went wrong: the code, the heading, one paragraph and one action back; centred or at the start.",
			"registryDependencies": [
				"block",
				"container",
				"link-button",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/error-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/error-simple/1.json",
				"group": "states",
				"kind": "block",
				"model": "error@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"event-intro": {
			"type": "registry:block",
			"title": "Event Intro",
			"description": "The first screen of an event: a badge, the name as a large heading, one paragraph, the date and the place, and one action; centred or at the start.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"link-button",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/event-intro.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/event-intro/1.json",
				"group": "hero",
				"kind": "block",
				"model": "event@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"faq-simple": {
			"type": "registry:block",
			"title": "Faq Simple",
			"description": "The heading, one paragraph and the questions with their answers as a list, each under a rule, in two columns or one.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/faq-simple.svelte",
				"src/blocks/faq-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/faq-simple/1.json",
				"group": "faq",
				"kind": "block",
				"model": "faq@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"feature-showcase-simple": {
			"type": "registry:block",
			"title": "Feature Showcase Simple",
			"description": "The heading, one paragraph and the key points as a list beside one picture (at the end or the start), or the head over a wide picture with the points in three columns under it.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/feature-showcase-simple.svelte",
				"src/blocks/feature-showcase-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/feature-showcase-simple/1.json",
				"group": "features",
				"kind": "block",
				"model": "feature-showcase@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"features-simple": {
			"type": "registry:block",
			"title": "Features Simple",
			"description": "The heading, one paragraph and the features as a list (an icon disc, a title, a line): in columns under the heading or beside it, the icon on top or at the side.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/features-simple.svelte",
				"src/blocks/features-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/features-simple/1.json",
				"group": "features",
				"kind": "block",
				"model": "features@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"field": {
			"type": "registry:component",
			"title": "Field",
			"description": "Field component",
			"registryDependencies": [
				"box",
				"label",
				"text",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/components/field.svelte"
			]
		},
		"fieldset": {
			"type": "registry:ui",
			"title": "Fieldset",
			"description": "Fieldset primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Fieldset.svelte"
			]
		},
		"figure-simple": {
			"type": "registry:block",
			"title": "Figure Simple",
			"description": "One large picture with its caption (a title, a line, the credit): wide with the caption under it, or the caption at the side.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"media-frame",
				"stack",
				"text",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/figure-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/figure-simple/1.json",
				"group": "story",
				"kind": "block",
				"model": "figure@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"footer-simple": {
			"type": "registry:block",
			"title": "Footer Simple",
			"description": "The brand and one line beside the links (a row or a grid of columns), or everything centred; the copyright line under them.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"link-plain",
				"list",
				"list-item",
				"stack",
				"text",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/footer-simple.svelte",
				"src/blocks/footer-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/footer-simple/1.json",
				"group": "navigation",
				"kind": "block",
				"model": "footer@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"form": {
			"type": "registry:ui",
			"title": "Form",
			"description": "Form primitive",
			"registryDependencies": [
				"kit-form",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Form.svelte"
			]
		},
		"form-description": {
			"type": "registry:ui",
			"title": "Form Description",
			"description": "Form Description primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/FormDescription.svelte"
			]
		},
		"form-item": {
			"type": "registry:ui",
			"title": "Form Item",
			"description": "Form Item primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/FormItem.svelte"
			]
		},
		"form-message": {
			"type": "registry:ui",
			"title": "Form Message",
			"description": "Form Message primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/FormMessage.svelte"
			]
		},
		"gallery-hero": {
			"type": "registry:block",
			"title": "Gallery Hero",
			"description": "The heading, one paragraph and up to two links as the actions beside three or four photos: at the end, at the start, or in a row under the copy.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"group",
				"link-button",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/gallery-hero.svelte",
				"src/blocks/gallery-hero.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/gallery-hero/1.json",
				"group": "hero",
				"kind": "block",
				"model": "gallery@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"grid": {
			"type": "registry:ui",
			"title": "Grid",
			"description": "Grid primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Grid.svelte"
			]
		},
		"grid-col": {
			"type": "registry:ui",
			"title": "Grid Col",
			"description": "Grid Col primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/GridCol.svelte"
			]
		},
		"group": {
			"type": "registry:ui",
			"title": "Group",
			"description": "Group primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Group.svelte"
			]
		},
		"guarantees-simple": {
			"type": "registry:block",
			"title": "Guarantees Simple",
			"description": "The heading, one paragraph and the promises (delivery, quality, returns), each a short title and a line: side by side on one muted band, or on cards, in four or three columns.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/guarantees-simple.svelte",
				"src/blocks/guarantees-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/guarantees-simple/1.json",
				"group": "features",
				"kind": "block",
				"model": "guarantees@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"header-simple": {
			"type": "registry:block",
			"title": "Header Simple",
			"description": "The brand as the link home, the navigation links and one action in a bar: the links in the middle, at the end beside the action, or centred under the brand. No menu button: the links wrap on a narrow screen.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"group",
				"link-button",
				"link-plain",
				"list",
				"list-item",
				"text",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/header-simple.svelte",
				"src/blocks/header-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/header-simple/1.json",
				"group": "navigation",
				"kind": "block",
				"model": "header@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"hero-simple": {
			"type": "registry:block",
			"title": "Hero Simple",
			"description": "A badge, the heading, one paragraph and up to two links as the actions (primary, then secondary), with one picture at the end, at the start (landscape or portrait), on top or at the bottom.",
			"registryDependencies": [
				"badge",
				"block",
				"box",
				"container",
				"group",
				"link-button",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/hero-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/hero-simple/1.json",
				"group": "hero",
				"kind": "block",
				"model": "hero@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"hours-simple": {
			"type": "registry:block",
			"title": "Hours Simple",
			"description": "The heading, one paragraph, the address (a link to the map), the phone and the opening hours by day: side by side or in one narrow column, plain or on cards.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"link-plain",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/hours-simple.svelte",
				"src/blocks/hours-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/hours-simple/1.json",
				"group": "contact",
				"kind": "block",
				"model": "hours@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"icon": {
			"type": "registry:ui",
			"title": "Icon",
			"description": "Icon primitive",
			"registryDependencies": [
				"kit-icon",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Icon.svelte"
			]
		},
		"icon-badge": {
			"type": "registry:ui",
			"title": "Icon Badge",
			"description": "Icon Badge primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/IconBadge.svelte"
			]
		},
		"image": {
			"type": "registry:ui",
			"title": "Image",
			"description": "Image primitive",
			"registryDependencies": [
				"kit-image",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Image.svelte"
			]
		},
		"inline": {
			"type": "registry:ui",
			"title": "Inline",
			"description": "Inline primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Inline.svelte"
			]
		},
		"input": {
			"type": "registry:ui",
			"title": "Input",
			"description": "Input primitive",
			"registryDependencies": [
				"kit-input",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Input.svelte"
			]
		},
		"intro-simple": {
			"type": "registry:block",
			"title": "Intro Simple",
			"description": "Text only: a badge, a large heading, one paragraph and up to two links as the actions (primary, then secondary), centred or at the start, in the middle of the section or low in a tall one.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"group",
				"link-button",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/intro-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/intro-simple/1.json",
				"group": "hero",
				"kind": "block",
				"model": "intro@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"kit-box": {
			"type": "registry:ui",
			"title": "Kit Box",
			"description": "UI8Kit 3 Box primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/box/Box.svelte",
				"src/kit/ui/box/box.shared.ts"
			]
		},
		"kit-button": {
			"type": "registry:ui",
			"title": "Kit Button",
			"description": "UI8Kit 3 Button primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/button/Button.svelte",
				"src/kit/ui/button/button.shared.ts"
			]
		},
		"kit-checkbox": {
			"type": "registry:ui",
			"title": "Kit Checkbox",
			"description": "UI8Kit 3 Checkbox primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/checkbox/Checkbox.svelte",
				"src/kit/ui/checkbox/checkbox.shared.ts"
			]
		},
		"kit-dialog": {
			"type": "registry:ui",
			"title": "Kit Dialog",
			"description": "UI8Kit 3 Dialog primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/dialog/Dialog.svelte",
				"src/kit/ui/dialog/dialog.shared.ts"
			]
		},
		"kit-disclosure": {
			"type": "registry:ui",
			"title": "Kit Disclosure",
			"description": "UI8Kit 3 Disclosure primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/disclosure/Disclosure.svelte",
				"src/kit/ui/disclosure/Summary.svelte",
				"src/kit/ui/disclosure/disclosure.shared.ts"
			]
		},
		"kit-form": {
			"type": "registry:ui",
			"title": "Kit Form",
			"description": "UI8Kit 3 Form primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/form/Form.svelte",
				"src/kit/ui/form/form.shared.ts"
			]
		},
		"kit-icon": {
			"type": "registry:ui",
			"title": "Kit Icon",
			"description": "UI8Kit 3 Icon primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/icon/Icon.svelte",
				"src/kit/ui/icon/icon.shared.ts",
				"src/kit/ui/icon/icon.variants.json"
			]
		},
		"kit-image": {
			"type": "registry:ui",
			"title": "Kit Image",
			"description": "UI8Kit 3 Image primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/image/Image.svelte",
				"src/kit/ui/image/Picture.svelte",
				"src/kit/ui/image/Source.svelte",
				"src/kit/ui/image/image.shared.ts"
			]
		},
		"kit-input": {
			"type": "registry:ui",
			"title": "Kit Input",
			"description": "UI8Kit 3 Input primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/input/Input.svelte",
				"src/kit/ui/input/input.shared.ts"
			]
		},
		"kit-label": {
			"type": "registry:ui",
			"title": "Kit Label",
			"description": "UI8Kit 3 Label primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/label/Label.svelte",
				"src/kit/ui/label/label.shared.ts"
			]
		},
		"kit-link": {
			"type": "registry:ui",
			"title": "Kit Link",
			"description": "UI8Kit 3 Link primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/link/Link.svelte",
				"src/kit/ui/link/link.shared.ts"
			]
		},
		"kit-meter": {
			"type": "registry:ui",
			"title": "Kit Meter",
			"description": "UI8Kit 3 Meter primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/meter/Meter.svelte",
				"src/kit/ui/meter/meter.shared.ts"
			]
		},
		"kit-progress": {
			"type": "registry:ui",
			"title": "Kit Progress",
			"description": "UI8Kit 3 Progress primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/progress/Progress.svelte",
				"src/kit/ui/progress/progress.shared.ts"
			]
		},
		"kit-radio": {
			"type": "registry:ui",
			"title": "Kit Radio",
			"description": "UI8Kit 3 Radio primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/radio/Radio.svelte",
				"src/kit/ui/radio/radio.shared.ts"
			]
		},
		"kit-select": {
			"type": "registry:ui",
			"title": "Kit Select",
			"description": "UI8Kit 3 Select primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/select/Select.svelte",
				"src/kit/ui/select/SelectOptGroup.svelte",
				"src/kit/ui/select/SelectOption.svelte",
				"src/kit/ui/select/select.shared.ts"
			]
		},
		"kit-separator": {
			"type": "registry:ui",
			"title": "Kit Separator",
			"description": "UI8Kit 3 Separator primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/separator/Separator.svelte",
				"src/kit/ui/separator/separator.shared.ts"
			]
		},
		"kit-switch": {
			"type": "registry:ui",
			"title": "Kit Switch",
			"description": "UI8Kit 3 Switch primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/switch/Switch.svelte",
				"src/kit/ui/switch/switch.shared.ts"
			]
		},
		"kit-text": {
			"type": "registry:ui",
			"title": "Kit Text",
			"description": "UI8Kit 3 Text primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/text/Text.svelte",
				"src/kit/ui/text/text.shared.ts"
			]
		},
		"kit-textarea": {
			"type": "registry:ui",
			"title": "Kit Textarea",
			"description": "UI8Kit 3 Textarea primitive (unstyled), from @ui8kit/registry",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/kit/ui/textarea/Textarea.svelte",
				"src/kit/ui/textarea/textarea.shared.ts"
			]
		},
		"label": {
			"type": "registry:ui",
			"title": "Label",
			"description": "Label primitive",
			"registryDependencies": [
				"kit-label",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Label.svelte"
			]
		},
		"legend": {
			"type": "registry:ui",
			"title": "Legend",
			"description": "Legend primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Legend.svelte"
			]
		},
		"link": {
			"type": "registry:ui",
			"title": "Link",
			"description": "Link primitive",
			"registryDependencies": [
				"kit-link",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Link.svelte"
			]
		},
		"link-button": {
			"type": "registry:ui",
			"title": "Link Button",
			"description": "Link Button primitive",
			"registryDependencies": [
				"kit-link",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/LinkButton.svelte"
			]
		},
		"link-plain": {
			"type": "registry:ui",
			"title": "Link Plain",
			"description": "Link Plain primitive",
			"registryDependencies": [
				"kit-link",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/LinkPlain.svelte"
			]
		},
		"list": {
			"type": "registry:ui",
			"title": "List",
			"description": "List primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/List.svelte"
			]
		},
		"list-item": {
			"type": "registry:ui",
			"title": "List Item",
			"description": "List Item primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/ListItem.svelte"
			]
		},
		"locations-simple": {
			"type": "registry:block",
			"title": "Locations Simple",
			"description": "The heading, one paragraph and the offices (the name, the address) in two columns beside one picture, at the start or the end.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/locations-simple.svelte",
				"src/blocks/locations-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/locations-simple/1.json",
				"group": "contact",
				"kind": "block",
				"model": "locations@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"logos-simple": {
			"type": "registry:block",
			"title": "Logos Simple",
			"description": "A short heading over the logos as a list: a wrapping row or a grid of cards.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/logos-simple.svelte",
				"src/blocks/logos-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/logos-simple/1.json",
				"group": "proof",
				"kind": "block",
				"model": "logos@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"lucide-icon": {
			"type": "registry:ui",
			"title": "Lucide Icon",
			"description": "Lucide Icon primitive",
			"registryDependencies": [
				"kit-icon",
				"recipes",
				"utils"
			],
			"dependencies": [
				"lucide"
			],
			"files": [
				"src/compose/LucideIcon.svelte",
				"src/icons/LucideIcon.svelte",
				"src/icons/lucide-icons.ts"
			]
		},
		"media-frame": {
			"type": "registry:component",
			"title": "Media Frame",
			"description": "Media Frame component",
			"registryDependencies": [
				"box",
				"image",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/components/media-frame.assets.ts",
				"src/components/media-frame.svelte"
			]
		},
		"menu-simple": {
			"type": "registry:block",
			"title": "Menu Simple",
			"description": "The heading, one paragraph and the dishes (a picture, a badge when set, the name, the weight, a line, the price): on cards in three, two or four columns, or menu rows with the price at the end.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/menu-simple.svelte",
				"src/blocks/menu-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/menu-simple/1.json",
				"group": "food",
				"kind": "block",
				"model": "menu@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"meter": {
			"type": "registry:ui",
			"title": "Meter",
			"description": "Meter primitive",
			"registryDependencies": [
				"kit-meter",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Meter.svelte"
			]
		},
		"offers-simple": {
			"type": "registry:block",
			"title": "Offers Simple",
			"description": "The heading, one paragraph and two or three offers on cards, each with a title, a line and an action.",
			"registryDependencies": [
				"block",
				"container",
				"link-button",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/offers-simple.svelte",
				"src/blocks/offers-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/offers-simple/1.json",
				"group": "cta",
				"kind": "block",
				"model": "offers@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"opt-group": {
			"type": "registry:ui",
			"title": "Opt Group",
			"description": "Opt Group primitive",
			"registryDependencies": [
				"kit-select",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/OptGroup.svelte"
			]
		},
		"photos-simple": {
			"type": "registry:block",
			"title": "Photos Simple",
			"description": "The heading, one paragraph and the photos as a list in two, three or four columns.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/photos-simple.svelte",
				"src/blocks/photos-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/photos-simple/1.json",
				"group": "company",
				"kind": "block",
				"model": "photos@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"presets": {
			"type": "registry:lib",
			"title": "Presets",
			"description": "Presets lib",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/presets/defaults.ts"
			]
		},
		"pricing-simple": {
			"type": "registry:block",
			"title": "Pricing Simple",
			"description": "The heading, one paragraph and the plans on cards (the name, a badge on the highlighted plan, a line, the price, an action): in three or two columns, or one row each.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"link-button",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/pricing-simple.svelte",
				"src/blocks/pricing-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/pricing-simple/1.json",
				"group": "pricing",
				"kind": "block",
				"model": "pricing@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"product-reviews": {
			"type": "registry:block",
			"title": "Product Reviews",
			"description": "The heading, one paragraph and the reviews on cards (the rating, the words, the reviewer with the portrait): in three or two columns, or one under the other.",
			"registryDependencies": [
				"block",
				"container",
				"group",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/product-reviews.svelte",
				"src/blocks/product-reviews.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/product-reviews/1.json",
				"group": "product",
				"kind": "block",
				"model": "reviews@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"product-simple": {
			"type": "registry:block",
			"title": "Product Simple",
			"description": "One product: the main picture and thumbnails beside the name, the price, one paragraph and the action; the pictures at the start, at the end or above.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"link-button",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/product-simple.svelte",
				"src/blocks/product-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/product-simple/1.json",
				"group": "product",
				"kind": "block",
				"model": "product@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"products-simple": {
			"type": "registry:block",
			"title": "Products Simple",
			"description": "The heading, one paragraph and the products (a picture, the name as a link, the price): in three or four columns, or rows with the picture at the side.",
			"registryDependencies": [
				"block",
				"container",
				"link-plain",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/products-simple.svelte",
				"src/blocks/products-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/products-simple/1.json",
				"group": "catalog",
				"kind": "block",
				"model": "products@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"profile-intro": {
			"type": "registry:block",
			"title": "Profile Intro",
			"description": "A person: the name, the role, one paragraph and the links beside the portrait (at the end or the start), or under a round portrait.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"link-button",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/profile-intro.svelte",
				"src/blocks/profile-intro.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/profile-intro/1.json",
				"group": "hero",
				"kind": "block",
				"model": "profile@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"progress": {
			"type": "registry:ui",
			"title": "Progress",
			"description": "Progress primitive",
			"registryDependencies": [
				"kit-progress",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Progress.svelte"
			]
		},
		"promo-simple": {
			"type": "registry:block",
			"title": "Promo Simple",
			"description": "One offer: the discount as a badge, the heading, the deadline as text, one paragraph, a promo code when set and one button, beside a picture at the end or at the start, or under a wide one.",
			"registryDependencies": [
				"badge",
				"block",
				"box",
				"container",
				"link-button",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/promo-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/promo-simple/1.json",
				"group": "cta",
				"kind": "block",
				"model": "promo@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"prose": {
			"type": "registry:ui",
			"title": "Prose",
			"description": "Prose primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Prose.svelte"
			]
		},
		"pull-quote-simple": {
			"type": "registry:block",
			"title": "Pull Quote Simple",
			"description": "The words of a quote in large type with the author, a role line and the source under them: a bar at the side, or centred.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"link-plain",
				"stack",
				"text",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/pull-quote-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/pull-quote-simple/1.json",
				"group": "story",
				"kind": "block",
				"model": "pull-quote@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"purchase-simple": {
			"type": "registry:block",
			"title": "Purchase Simple",
			"description": "On a card surface: the heading and one paragraph beside the price, the action and a note; or all centred.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"link-button",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/purchase-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/purchase-simple/1.json",
				"group": "product",
				"kind": "block",
				"model": "purchase@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"radio": {
			"type": "registry:ui",
			"title": "Radio",
			"description": "Radio primitive",
			"registryDependencies": [
				"kit-radio",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Radio.svelte"
			]
		},
		"range": {
			"type": "registry:ui",
			"title": "Range",
			"description": "Range primitive",
			"registryDependencies": [
				"kit-input",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Range.svelte"
			]
		},
		"rating-simple": {
			"type": "registry:block",
			"title": "Rating Simple",
			"description": "The score, what it is and the source as a link: one bar on a card surface, or centred.",
			"registryDependencies": [
				"block",
				"box",
				"container",
				"link-plain",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/rating-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/rating-simple/1.json",
				"group": "proof",
				"kind": "block",
				"model": "rating@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"recipes": {
			"type": "registry:lib",
			"title": "Recipes",
			"description": "Recipes (Tailwind classes per variant/size/state) of the composed primitives",
			"registryDependencies": [
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/recipes.ts"
			]
		},
		"rooms-simple": {
			"type": "registry:block",
			"title": "Rooms Simple",
			"description": "The heading, one paragraph and the rooms (a picture, the name as a link, the guests, a line, the price a night): on cards in three or two columns, or rows with the picture at the start.",
			"registryDependencies": [
				"block",
				"container",
				"link-plain",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/rooms-simple.svelte",
				"src/blocks/rooms-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/rooms-simple/1.json",
				"group": "catalog",
				"kind": "block",
				"model": "rooms@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"select": {
			"type": "registry:ui",
			"title": "Select",
			"description": "Select primitive",
			"registryDependencies": [
				"kit-select",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Select.svelte"
			]
		},
		"select-option": {
			"type": "registry:ui",
			"title": "Select Option",
			"description": "Select Option primitive",
			"registryDependencies": [
				"kit-select",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/SelectOption.svelte"
			]
		},
		"separator": {
			"type": "registry:ui",
			"title": "Separator",
			"description": "Separator primitive",
			"registryDependencies": [
				"kit-separator",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Separator.svelte"
			]
		},
		"services-simple": {
			"type": "registry:block",
			"title": "Services Simple",
			"description": "The heading, one paragraph and the services (the name as a link, a line, the starting price): on cards in three or two columns, or rows with the price at the end.",
			"registryDependencies": [
				"block",
				"container",
				"link-plain",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/services-simple.svelte",
				"src/blocks/services-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/services-simple/1.json",
				"group": "features",
				"kind": "block",
				"model": "services@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"sheet": {
			"type": "registry:ui",
			"title": "Sheet",
			"description": "Sheet primitive",
			"registryDependencies": [
				"kit-dialog",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Sheet.svelte"
			]
		},
		"sheet-close": {
			"type": "registry:ui",
			"title": "Sheet Close",
			"description": "Sheet Close primitive",
			"registryDependencies": [
				"kit-button",
				"kit-icon",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/SheetClose.svelte"
			]
		},
		"sheet-trigger": {
			"type": "registry:ui",
			"title": "Sheet Trigger",
			"description": "Sheet Trigger primitive",
			"registryDependencies": [
				"kit-button",
				"kit-icon",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/SheetTrigger.svelte"
			]
		},
		"skeleton": {
			"type": "registry:ui",
			"title": "Skeleton",
			"description": "Skeleton primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Skeleton.svelte"
			]
		},
		"specs-simple": {
			"type": "registry:block",
			"title": "Specs Simple",
			"description": "The heading, one paragraph and the specifications as name and value rows on a muted surface, in one narrow column or two columns.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/specs-simple.svelte",
				"src/blocks/specs-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/specs-simple/1.json",
				"group": "product",
				"kind": "block",
				"model": "specs@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"split-simple": {
			"type": "registry:block",
			"title": "Split Simple",
			"description": "Two halves: the heading, one paragraph and up to two links as the actions (primary, then secondary) beside one picture that fills its half to the edge of the screen.",
			"registryDependencies": [
				"block",
				"box",
				"group",
				"link-button",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/split-simple.svelte"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/split-simple/1.json",
				"group": "split",
				"kind": "block",
				"model": "split@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"stack": {
			"type": "registry:ui",
			"title": "Stack",
			"description": "Stack primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Stack.svelte"
			]
		},
		"stats-simple": {
			"type": "registry:block",
			"title": "Stats Simple",
			"description": "The heading, one paragraph and the figures as a list (a large value, a label, a note), in two, three or four columns, plain or on cards.",
			"registryDependencies": [
				"block",
				"card",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/stats-simple.svelte",
				"src/blocks/stats-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/stats-simple/1.json",
				"group": "proof",
				"kind": "block",
				"model": "stats@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"steps-simple": {
			"type": "registry:block",
			"title": "Steps Simple",
			"description": "The heading, one paragraph and the steps as an ordered list (a label, a title, a line), in a row of three or four, or one under the other.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/steps-simple.svelte",
				"src/blocks/steps-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/steps-simple/1.json",
				"group": "how-it-works",
				"kind": "block",
				"model": "steps@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"store-policies": {
			"type": "registry:block",
			"title": "Store Policies",
			"description": "The heading, one paragraph and the policies (payment, delivery, returns), each with an icon, a title and a line: on cards in columns, or rows.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/store-policies.svelte",
				"src/blocks/store-policies.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/store-policies/1.json",
				"group": "storefront",
				"kind": "block",
				"model": "store-policy@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"stories-simple": {
			"type": "registry:block",
			"title": "Stories Simple",
			"description": "The heading, one paragraph and the stories as a list (a cover, the title as a link, a line): cards in two or three columns, or compact rows on a card surface.",
			"registryDependencies": [
				"block",
				"container",
				"link",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/stories-simple.svelte",
				"src/blocks/stories-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/stories-simple/1.json",
				"group": "blog",
				"kind": "block",
				"model": "stories@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"summary": {
			"type": "registry:ui",
			"title": "Summary",
			"description": "Summary primitive",
			"registryDependencies": [
				"kit-disclosure",
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Summary.svelte"
			]
		},
		"switch": {
			"type": "registry:ui",
			"title": "Switch",
			"description": "Switch primitive",
			"registryDependencies": [
				"kit-switch",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Switch.svelte"
			]
		},
		"table": {
			"type": "registry:ui",
			"title": "Table",
			"description": "Table primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Table.svelte"
			]
		},
		"table-body": {
			"type": "registry:ui",
			"title": "Table Body",
			"description": "Table Body primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableBody.svelte"
			]
		},
		"table-caption": {
			"type": "registry:ui",
			"title": "Table Caption",
			"description": "Table Caption primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableCaption.svelte"
			]
		},
		"table-cell": {
			"type": "registry:ui",
			"title": "Table Cell",
			"description": "Table Cell primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableCell.svelte"
			]
		},
		"table-col": {
			"type": "registry:ui",
			"title": "Table Col",
			"description": "Table Col primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableCol.svelte"
			]
		},
		"table-col-group": {
			"type": "registry:ui",
			"title": "Table Col Group",
			"description": "Table Col Group primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableColGroup.svelte"
			]
		},
		"table-foot": {
			"type": "registry:ui",
			"title": "Table Foot",
			"description": "Table Foot primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableFoot.svelte"
			]
		},
		"table-head": {
			"type": "registry:ui",
			"title": "Table Head",
			"description": "Table Head primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableHead.svelte"
			]
		},
		"table-head-cell": {
			"type": "registry:ui",
			"title": "Table Head Cell",
			"description": "Table Head Cell primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableHeadCell.svelte"
			]
		},
		"table-row": {
			"type": "registry:ui",
			"title": "Table Row",
			"description": "Table Row primitive",
			"registryDependencies": [
				"kit-box",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/TableRow.svelte"
			]
		},
		"team-simple": {
			"type": "registry:block",
			"title": "Team Simple",
			"description": "The heading, one paragraph and the people as a list: a portrait, the name and the role, in two, three or four columns, plain or on cards.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/team-simple.svelte",
				"src/blocks/team-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/team-simple/1.json",
				"group": "company",
				"kind": "block",
				"model": "team@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"testimonials-simple": {
			"type": "registry:block",
			"title": "Testimonials Simple",
			"description": "The heading, one paragraph and the quotes as a list (the words, a portrait, the name and the role): on cards in two or three columns, in rows with the portrait at the side, or centred.",
			"registryDependencies": [
				"block",
				"container",
				"group",
				"list",
				"list-item",
				"media-frame",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/testimonials-simple.svelte",
				"src/blocks/testimonials-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/testimonials-simple/1.json",
				"group": "proof",
				"kind": "block",
				"model": "testimonials@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"text": {
			"type": "registry:ui",
			"title": "Text",
			"description": "Text primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Text.svelte"
			]
		},
		"textarea": {
			"type": "registry:ui",
			"title": "Textarea",
			"description": "Textarea primitive",
			"registryDependencies": [
				"kit-textarea",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Textarea.svelte"
			]
		},
		"theme-amber-minimal": {
			"type": "registry:theme",
			"title": "Amber Minimal",
			"description": "Skin Amber Minimal: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"amber-minimal\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/amber-minimal.css"
			]
		},
		"theme-base": {
			"type": "registry:theme",
			"title": "Theme Base",
			"description": "Start values of a skin scoped on an element (data-skin on any element but <html>): the kit font, tracking, radius and shadows, so the element shows its own skin only. Licences of the skins in NOTICE.md.",
			"registryDependencies": [],
			"dependencies": [],
			"files": [
				"src/styles/skins/NOTICE.md",
				"src/styles/skins/base.css"
			]
		},
		"theme-bubblegum": {
			"type": "registry:theme",
			"title": "Bubblegum",
			"description": "Skin Bubblegum: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"bubblegum\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/bubblegum.css"
			]
		},
		"theme-claude": {
			"type": "registry:theme",
			"title": "Claude",
			"description": "Skin Claude: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"claude\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/claude.css"
			]
		},
		"theme-cosmic-night": {
			"type": "registry:theme",
			"title": "Cosmic Night",
			"description": "Skin Cosmic Night: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"cosmic-night\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/cosmic-night.css"
			]
		},
		"theme-doom-64": {
			"type": "registry:theme",
			"title": "Doom 64",
			"description": "Skin Doom 64: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"doom-64\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/doom-64.css"
			]
		},
		"theme-kodama-grove": {
			"type": "registry:theme",
			"title": "Kodama Grove",
			"description": "Skin Kodama Grove: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"kodama-grove\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/kodama-grove.css"
			]
		},
		"theme-mocha-mousse": {
			"type": "registry:theme",
			"title": "Mocha Mousse",
			"description": "Skin Mocha Mousse: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"mocha-mousse\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/mocha-mousse.css"
			]
		},
		"theme-modern-minimal": {
			"type": "registry:theme",
			"title": "Modern Minimal",
			"description": "Skin Modern Minimal: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"modern-minimal\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/modern-minimal.css"
			]
		},
		"theme-neo-brutalism": {
			"type": "registry:theme",
			"title": "Neo Brutalism",
			"description": "Skin Neo Brutalism: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"neo-brutalism\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/neo-brutalism.css"
			]
		},
		"theme-notebook": {
			"type": "registry:theme",
			"title": "Notebook",
			"description": "Skin Notebook: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"notebook\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/notebook.css"
			]
		},
		"theme-perpetuity": {
			"type": "registry:theme",
			"title": "Perpetuity",
			"description": "Skin Perpetuity: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"perpetuity\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/perpetuity.css"
			]
		},
		"theme-rose": {
			"type": "registry:theme",
			"title": "Rose",
			"description": "Skin Rose: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"rose\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/rose.css"
			]
		},
		"theme-sky": {
			"type": "registry:theme",
			"title": "Sky",
			"description": "Skin Sky: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"sky\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/sky.css"
			]
		},
		"theme-supabase": {
			"type": "registry:theme",
			"title": "Supabase",
			"description": "Skin Supabase: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"supabase\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/supabase.css"
			]
		},
		"theme-t3-chat": {
			"type": "registry:theme",
			"title": "T3 Chat",
			"description": "Skin T3 Chat: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"t3-chat\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/t3-chat.css"
			]
		},
		"theme-toggle": {
			"type": "registry:ui",
			"title": "Theme Toggle",
			"description": "Theme Toggle primitive",
			"registryDependencies": [
				"kit-button",
				"kit-icon",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/ThemeToggle.svelte"
			]
		},
		"theme-violet-bloom": {
			"type": "registry:theme",
			"title": "Violet Bloom",
			"description": "Skin Violet Bloom: brand tokens (colours, radius, shadows, fonts) for every UI8Kit component, light and dark; on with data-skin=\"violet-bloom\".",
			"registryDependencies": [
				"theme-base"
			],
			"dependencies": [],
			"files": [
				"src/styles/skins/violet-bloom.css"
			]
		},
		"timeline-simple": {
			"type": "registry:block",
			"title": "Timeline Simple",
			"description": "The heading, one paragraph and the steps of a process or a history (the date or the stage, a title, a line) as an ordered list: one column of muted steps, or side by side in two or four columns.",
			"registryDependencies": [
				"block",
				"container",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/timeline-simple.svelte",
				"src/blocks/timeline-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/timeline-simple/1.json",
				"group": "how-it-works",
				"kind": "block",
				"model": "timeline@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"title": {
			"type": "registry:ui",
			"title": "Title",
			"description": "Title primitive",
			"registryDependencies": [
				"kit-text",
				"recipes",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/compose/Title.svelte"
			]
		},
		"topics-simple": {
			"type": "registry:block",
			"title": "Topics Simple",
			"description": "The heading, one paragraph and the rubrics of a blog on cards (a label, the title as a link, a line): in two or three columns, or one under the other.",
			"registryDependencies": [
				"badge",
				"block",
				"container",
				"link-plain",
				"list",
				"list-item",
				"stack",
				"text",
				"title",
				"utils"
			],
			"dependencies": [],
			"files": [
				"src/blocks/topics-simple.svelte",
				"src/blocks/topics-simple.types.ts"
			],
			"meta": {
				"category": "marketing",
				"contract": "contracts/topics-simple/1.json",
				"group": "blog",
				"kind": "block",
				"model": "topics@1",
				"tags": [
					"svelte",
					"block"
				]
			}
		},
		"utils": {
			"type": "registry:utils",
			"title": "Utils",
			"description": "cn, variants, expr, safe URLs and the shared helpers of the primitives and compositions (plus the theme CSS in styles/)",
			"registryDependencies": [],
			"dependencies": [
				"clsx",
				"lucide",
				"tailwind-merge"
			],
			"files": [
				"src/kit/utils/cn.ts",
				"src/kit/utils/env.ts",
				"src/kit/utils/expr.ts",
				"src/kit/utils/index.ts",
				"src/kit/utils/recipe-types.ts",
				"src/kit/utils/tags.ts",
				"src/kit/utils/variants.ts",
				"src/styles/index.css",
				"src/styles/kit.css",
				"src/styles/theme.css",
				"src/utils/a11y/dismiss.ts",
				"src/utils/a11y/focus-trap.ts",
				"src/utils/a11y/focusable.ts",
				"src/utils/a11y/index.ts",
				"src/utils/a11y/roving.ts",
				"src/utils/a11y/scroll-lock.ts",
				"src/utils/cn.ts",
				"src/utils/env.ts",
				"src/utils/expr.ts",
				"src/utils/format.ts",
				"src/utils/html.ts",
				"src/utils/index.ts",
				"src/utils/safe.ts",
				"src/utils/tags.ts",
				"src/utils/variants.ts"
			]
		}
	},
	"themes": {
		"base": {
			"item": "theme-base",
			"files": [
				"src/styles/skins/NOTICE.md",
				"src/styles/skins/base.css"
			]
		},
		"skins": {
			"amber-minimal": {
				"item": "theme-amber-minimal",
				"title": "Amber Minimal",
				"file": "src/styles/skins/amber-minimal.css"
			},
			"bubblegum": {
				"item": "theme-bubblegum",
				"title": "Bubblegum",
				"file": "src/styles/skins/bubblegum.css"
			},
			"claude": {
				"item": "theme-claude",
				"title": "Claude",
				"file": "src/styles/skins/claude.css"
			},
			"cosmic-night": {
				"item": "theme-cosmic-night",
				"title": "Cosmic Night",
				"file": "src/styles/skins/cosmic-night.css"
			},
			"doom-64": {
				"item": "theme-doom-64",
				"title": "Doom 64",
				"file": "src/styles/skins/doom-64.css"
			},
			"kodama-grove": {
				"item": "theme-kodama-grove",
				"title": "Kodama Grove",
				"file": "src/styles/skins/kodama-grove.css"
			},
			"mocha-mousse": {
				"item": "theme-mocha-mousse",
				"title": "Mocha Mousse",
				"file": "src/styles/skins/mocha-mousse.css"
			},
			"modern-minimal": {
				"item": "theme-modern-minimal",
				"title": "Modern Minimal",
				"file": "src/styles/skins/modern-minimal.css"
			},
			"neo-brutalism": {
				"item": "theme-neo-brutalism",
				"title": "Neo Brutalism",
				"file": "src/styles/skins/neo-brutalism.css"
			},
			"notebook": {
				"item": "theme-notebook",
				"title": "Notebook",
				"file": "src/styles/skins/notebook.css"
			},
			"perpetuity": {
				"item": "theme-perpetuity",
				"title": "Perpetuity",
				"file": "src/styles/skins/perpetuity.css"
			},
			"rose": {
				"item": "theme-rose",
				"title": "Rose",
				"file": "src/styles/skins/rose.css"
			},
			"sky": {
				"item": "theme-sky",
				"title": "Sky",
				"file": "src/styles/skins/sky.css"
			},
			"supabase": {
				"item": "theme-supabase",
				"title": "Supabase",
				"file": "src/styles/skins/supabase.css"
			},
			"t3-chat": {
				"item": "theme-t3-chat",
				"title": "T3 Chat",
				"file": "src/styles/skins/t3-chat.css"
			},
			"violet-bloom": {
				"item": "theme-violet-bloom",
				"title": "Violet Bloom",
				"file": "src/styles/skins/violet-bloom.css"
			}
		}
	},
	"blocks": {
		"amenities-simple": {
			"spec": "block.amenitiessimple",
			"organism": "blocks/amenities-simple.svelte",
			"organismName": "AmenitiesSimple",
			"defaultVariant": "grid3",
			"variants": {
				"grid3": {
					"layout": "grid",
					"cols": "3"
				},
				"grid2": {
					"layout": "grid",
					"cols": "2"
				},
				"pills": {
					"layout": "pills",
					"cols": "3"
				}
			}
		},
		"article-lead": {
			"spec": "block.articlelead",
			"organism": "blocks/article-lead.svelte",
			"organismName": "ArticleLead",
			"defaultVariant": "mediaTop",
			"variants": {
				"mediaTop": {
					"media": "top"
				},
				"mediaStart": {
					"media": "start"
				},
				"mediaEnd": {
					"media": "end"
				}
			}
		},
		"article-simple": {
			"spec": "block.articlesimple",
			"organism": "blocks/article-simple.svelte",
			"organismName": "ArticleSimple",
			"defaultVariant": "column",
			"variants": {
				"column": {
					"layout": "column",
					"align": "start"
				},
				"twoColumns": {
					"layout": "columns",
					"align": "center"
				}
			}
		},
		"cases-simple": {
			"spec": "block.casessimple",
			"organism": "blocks/cases-simple.svelte",
			"organismName": "CasesSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2"
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"chapters-simple": {
			"spec": "block.chapterssimple",
			"organism": "blocks/chapters-simple.svelte",
			"organismName": "ChaptersSimple",
			"defaultVariant": "illustratedRows",
			"variants": {
				"illustratedRows": {
					"layout": "rows"
				},
				"paired": {
					"layout": "paired"
				}
			}
		},
		"choice-links": {
			"spec": "block.choicelinks",
			"organism": "blocks/choice-links.svelte",
			"organismName": "ChoiceLinks",
			"defaultVariant": "row",
			"variants": {
				"row": {
					"layout": "row"
				},
				"grid": {
					"layout": "grid"
				}
			}
		},
		"collections-simple": {
			"spec": "block.collectionssimple",
			"organism": "blocks/collections-simple.svelte",
			"organismName": "CollectionsSimple",
			"defaultVariant": "cards4",
			"variants": {
				"cards4": {
					"cols": "4"
				},
				"cards2": {
					"cols": "2"
				}
			}
		},
		"compare-simple": {
			"spec": "block.comparesimple",
			"organism": "blocks/compare-simple.svelte",
			"organismName": "CompareSimple",
			"defaultVariant": "twoProducts",
			"variants": {
				"twoProducts": {
					"width": "wide"
				},
				"narrow": {
					"width": "narrow"
				}
			}
		},
		"contacts-simple": {
			"spec": "block.contactssimple",
			"organism": "blocks/contacts-simple.svelte",
			"organismName": "ContactsSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2"
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"course-outline": {
			"spec": "block.courseoutline",
			"organism": "blocks/course-outline.svelte",
			"organismName": "CourseOutline",
			"defaultVariant": "moduleRows",
			"variants": {
				"moduleRows": {
					"layout": "rows"
				},
				"cards": {
					"layout": "cards"
				}
			}
		},
		"cta-simple": {
			"spec": "block.ctasimple",
			"organism": "blocks/cta-simple.svelte",
			"organismName": "CtaSimple",
			"defaultVariant": "center",
			"variants": {
				"center": {
					"layout": "stack",
					"surface": "muted"
				},
				"start": {
					"layout": "stack",
					"surface": "muted",
					"align": "start"
				},
				"between": {
					"layout": "between",
					"surface": "muted",
					"align": "start"
				},
				"centerOutline": {
					"layout": "stack",
					"surface": "outline"
				},
				"betweenOutline": {
					"layout": "between",
					"surface": "outline",
					"align": "start"
				}
			}
		},
		"delivery-simple": {
			"spec": "block.deliverysimple",
			"organism": "blocks/delivery-simple.svelte",
			"organismName": "DeliverySimple",
			"defaultVariant": "rows",
			"variants": {
				"rows": {
					"layout": "rows"
				},
				"cards": {
					"layout": "cards"
				}
			}
		},
		"digital-simple": {
			"spec": "block.digitalsimple",
			"organism": "blocks/digital-simple.svelte",
			"organismName": "DigitalSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards"
				},
				"rows": {
					"layout": "rows",
					"align": "start"
				}
			}
		},
		"error-simple": {
			"spec": "block.errorsimple",
			"organism": "blocks/error-simple.svelte",
			"organismName": "ErrorSimple",
			"defaultVariant": "center",
			"variants": {
				"center": {},
				"start": {
					"align": "start"
				}
			}
		},
		"event-intro": {
			"spec": "block.eventintro",
			"organism": "blocks/event-intro.svelte",
			"organismName": "EventIntro",
			"defaultVariant": "center",
			"variants": {
				"center": {},
				"start": {
					"align": "start"
				}
			}
		},
		"faq-simple": {
			"spec": "block.faqsimple",
			"organism": "blocks/faq-simple.svelte",
			"organismName": "FaqSimple",
			"defaultVariant": "grid2",
			"variants": {
				"grid2": {
					"columns": "two"
				},
				"list": {
					"columns": "one"
				}
			}
		},
		"feature-showcase-simple": {
			"spec": "block.featureshowcasesimple",
			"organism": "blocks/feature-showcase-simple.svelte",
			"organismName": "FeatureShowcaseSimple",
			"defaultVariant": "mediaEnd",
			"variants": {
				"mediaEnd": {
					"media": "end"
				},
				"mediaStart": {
					"media": "start"
				},
				"mediaTop": {
					"media": "top",
					"align": "center"
				}
			}
		},
		"features-simple": {
			"spec": "block.featuressimple",
			"organism": "blocks/features-simple.svelte",
			"organismName": "FeaturesSimple",
			"defaultVariant": "cols3",
			"variants": {
				"cols3": {
					"layout": "stack",
					"cols": "3",
					"marker": "top"
				},
				"cols2": {
					"layout": "stack",
					"cols": "2",
					"marker": "top"
				},
				"cols4": {
					"layout": "stack",
					"cols": "4",
					"marker": "top"
				},
				"summaryRow": {
					"layout": "aside",
					"cols": "3",
					"marker": "top",
					"align": "start"
				},
				"summaryGrid": {
					"layout": "aside",
					"cols": "2",
					"marker": "top",
					"align": "start"
				},
				"inlineGrid": {
					"layout": "stack",
					"cols": "2",
					"marker": "inline"
				},
				"checklist": {
					"layout": "aside",
					"cols": "2",
					"marker": "inline",
					"align": "start"
				}
			}
		},
		"figure-simple": {
			"spec": "block.figuresimple",
			"organism": "blocks/figure-simple.svelte",
			"organismName": "FigureSimple",
			"defaultVariant": "wide",
			"variants": {
				"wide": {
					"layout": "wide"
				},
				"captionEnd": {
					"layout": "end"
				},
				"captionStart": {
					"layout": "start"
				}
			}
		},
		"footer-simple": {
			"spec": "block.footersimple",
			"organism": "blocks/footer-simple.svelte",
			"organismName": "FooterSimple",
			"defaultVariant": "brandLinks",
			"variants": {
				"brandLinks": {
					"layout": "row"
				},
				"linkGrid": {
					"layout": "grid"
				},
				"centered": {
					"layout": "centered"
				}
			}
		},
		"gallery-hero": {
			"spec": "block.galleryhero",
			"organism": "blocks/gallery-hero.svelte",
			"organismName": "GalleryHero",
			"defaultVariant": "photos3",
			"variants": {
				"photos3": {
					"media": "end",
					"count": "3"
				},
				"photos4": {
					"media": "end",
					"count": "4",
					"photos": {
						"$": "galleryPhotos4"
					}
				},
				"photos3Start": {
					"media": "start",
					"count": "3"
				},
				"photos4Start": {
					"media": "start",
					"count": "4",
					"photos": {
						"$": "galleryPhotos4"
					}
				},
				"photos3Bottom": {
					"media": "bottom",
					"count": "3",
					"align": "center"
				},
				"photos4Bottom": {
					"media": "bottom",
					"count": "4",
					"align": "center",
					"photos": {
						"$": "galleryPhotos4"
					}
				}
			}
		},
		"guarantees-simple": {
			"spec": "block.guaranteessimple",
			"organism": "blocks/guarantees-simple.svelte",
			"organismName": "GuaranteesSimple",
			"defaultVariant": "strip4",
			"variants": {
				"strip4": {
					"layout": "strip",
					"cols": "4"
				},
				"strip3": {
					"layout": "strip",
					"cols": "3"
				},
				"cards4": {
					"layout": "cards",
					"cols": "4"
				},
				"cards3": {
					"layout": "cards",
					"cols": "3"
				}
			}
		},
		"header-simple": {
			"spec": "block.headersimple",
			"organism": "blocks/header-simple.svelte",
			"organismName": "HeaderSimple",
			"defaultVariant": "inline",
			"variants": {
				"inline": {
					"layout": "inline"
				},
				"linksEnd": {
					"layout": "end"
				},
				"centered": {
					"layout": "centered"
				}
			}
		},
		"hero-simple": {
			"spec": "block.herosimple",
			"organism": "blocks/hero-simple.svelte",
			"organismName": "HeroSimple",
			"defaultVariant": "mediaEnd",
			"variants": {
				"mediaEnd": {
					"media": "end",
					"ratio": "landscape"
				},
				"mediaStart": {
					"media": "start",
					"ratio": "landscape"
				},
				"mediaTop": {
					"media": "top",
					"ratio": "landscape",
					"align": "center"
				},
				"mediaBottom": {
					"media": "bottom",
					"ratio": "landscape",
					"align": "center"
				},
				"mediaEndPortrait": {
					"media": "end",
					"ratio": "portrait"
				},
				"mediaStartPortrait": {
					"media": "start",
					"ratio": "portrait"
				}
			}
		},
		"hours-simple": {
			"spec": "block.hourssimple",
			"organism": "blocks/hours-simple.svelte",
			"organismName": "HoursSimple",
			"defaultVariant": "columns",
			"variants": {
				"columns": {
					"layout": "columns",
					"surface": "plain",
					"align": "start"
				},
				"columnsCard": {
					"layout": "columns",
					"surface": "card",
					"align": "start"
				},
				"stack": {
					"layout": "stack",
					"surface": "plain"
				},
				"stackCard": {
					"layout": "stack",
					"surface": "card"
				}
			}
		},
		"intro-simple": {
			"spec": "block.introsimple",
			"organism": "blocks/intro-simple.svelte",
			"organismName": "IntroSimple",
			"defaultVariant": "center",
			"variants": {
				"center": {
					"place": "middle"
				},
				"start": {
					"place": "middle",
					"align": "start"
				},
				"bottomStart": {
					"place": "bottom",
					"align": "start"
				},
				"bottomCenter": {
					"place": "bottom"
				}
			}
		},
		"locations-simple": {
			"spec": "block.locationssimple",
			"organism": "blocks/locations-simple.svelte",
			"organismName": "LocationsSimple",
			"defaultVariant": "mediaStart",
			"variants": {
				"mediaStart": {
					"media": "start"
				},
				"mediaEnd": {
					"media": "end"
				}
			}
		},
		"logos-simple": {
			"spec": "block.logossimple",
			"organism": "blocks/logos-simple.svelte",
			"organismName": "LogosSimple",
			"defaultVariant": "row",
			"variants": {
				"row": {
					"surface": "plain"
				},
				"cards": {
					"surface": "cards"
				}
			}
		},
		"menu-simple": {
			"spec": "block.menusimple",
			"organism": "blocks/menu-simple.svelte",
			"organismName": "MenuSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2"
				},
				"cards4": {
					"layout": "cards",
					"cols": "4"
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"offers-simple": {
			"spec": "block.offerssimple",
			"organism": "blocks/offers-simple.svelte",
			"organismName": "OffersSimple",
			"defaultVariant": "duo",
			"variants": {
				"duo": {
					"cols": "2"
				},
				"duoStart": {
					"cols": "2",
					"align": "start"
				}
			}
		},
		"photos-simple": {
			"spec": "block.photossimple",
			"organism": "blocks/photos-simple.svelte",
			"organismName": "PhotosSimple",
			"defaultVariant": "row4",
			"variants": {
				"row4": {
					"cols": "4"
				},
				"grid3": {
					"cols": "3"
				},
				"diptych": {
					"cols": "2"
				}
			}
		},
		"pricing-simple": {
			"spec": "block.pricingsimple",
			"organism": "blocks/pricing-simple.svelte",
			"organismName": "PricingSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2",
					"plans": {
						"$": "pricingPlans2"
					}
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"product-reviews": {
			"spec": "block.productreviews",
			"organism": "blocks/product-reviews.svelte",
			"organismName": "ProductReviews",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"rows": {
					"layout": "rows",
					"cols": "3"
				}
			}
		},
		"product-simple": {
			"spec": "block.productsimple",
			"organism": "blocks/product-simple.svelte",
			"organismName": "ProductSimple",
			"defaultVariant": "mediaStart",
			"variants": {
				"mediaStart": {
					"media": "start"
				},
				"mediaEnd": {
					"media": "end"
				},
				"mediaTop": {
					"media": "top"
				}
			}
		},
		"products-simple": {
			"spec": "block.productssimple",
			"organism": "blocks/products-simple.svelte",
			"organismName": "ProductsSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "grid",
					"cols": "3"
				},
				"denseGrid": {
					"layout": "grid",
					"cols": "4"
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"profile-intro": {
			"spec": "block.profileintro",
			"organism": "blocks/profile-intro.svelte",
			"organismName": "ProfileIntro",
			"defaultVariant": "portraitEnd",
			"variants": {
				"portraitEnd": {
					"media": "end"
				},
				"portraitStart": {
					"media": "start"
				},
				"portraitTop": {
					"media": "top",
					"align": "center"
				}
			}
		},
		"promo-simple": {
			"spec": "block.promosimple",
			"organism": "blocks/promo-simple.svelte",
			"organismName": "PromoSimple",
			"defaultVariant": "mediaEnd",
			"variants": {
				"mediaEnd": {
					"media": "end"
				},
				"mediaStart": {
					"media": "start"
				},
				"mediaTop": {
					"media": "top",
					"align": "center"
				}
			}
		},
		"pull-quote-simple": {
			"spec": "block.pullquotesimple",
			"organism": "blocks/pull-quote-simple.svelte",
			"organismName": "PullQuoteSimple",
			"defaultVariant": "standalone",
			"variants": {
				"standalone": {
					"layout": "rule"
				},
				"centered": {
					"layout": "centered"
				}
			}
		},
		"purchase-simple": {
			"spec": "block.purchasesimple",
			"organism": "blocks/purchase-simple.svelte",
			"organismName": "PurchaseSimple",
			"defaultVariant": "panel",
			"variants": {
				"panel": {
					"layout": "panel"
				},
				"centered": {
					"layout": "centered"
				}
			}
		},
		"rating-simple": {
			"spec": "block.ratingsimple",
			"organism": "blocks/rating-simple.svelte",
			"organismName": "RatingSimple",
			"defaultVariant": "inline",
			"variants": {
				"inline": {
					"layout": "bar"
				},
				"centered": {
					"layout": "centered"
				}
			}
		},
		"rooms-simple": {
			"spec": "block.roomssimple",
			"organism": "blocks/rooms-simple.svelte",
			"organismName": "RoomsSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2"
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"services-simple": {
			"spec": "block.servicessimple",
			"organism": "blocks/services-simple.svelte",
			"organismName": "ServicesSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2"
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"specs-simple": {
			"spec": "block.specssimple",
			"organism": "blocks/specs-simple.svelte",
			"organismName": "SpecsSimple",
			"defaultVariant": "keyValue",
			"variants": {
				"keyValue": {
					"layout": "rows"
				},
				"twoColumns": {
					"layout": "columns"
				}
			}
		},
		"split-simple": {
			"spec": "block.splitsimple",
			"organism": "blocks/split-simple.svelte",
			"organismName": "SplitSimple",
			"defaultVariant": "mediaEnd",
			"variants": {
				"mediaEnd": {
					"media": "end"
				},
				"mediaStart": {
					"media": "start"
				}
			}
		},
		"stats-simple": {
			"spec": "block.statssimple",
			"organism": "blocks/stats-simple.svelte",
			"organismName": "StatsSimple",
			"defaultVariant": "cols4",
			"variants": {
				"cols4": {
					"cols": "4",
					"surface": "plain"
				},
				"cols3": {
					"cols": "3",
					"surface": "plain"
				},
				"cols2": {
					"cols": "2",
					"surface": "plain"
				},
				"cards4": {
					"cols": "4",
					"surface": "cards"
				}
			}
		},
		"steps-simple": {
			"spec": "block.stepssimple",
			"organism": "blocks/steps-simple.svelte",
			"organismName": "StepsSimple",
			"defaultVariant": "row4",
			"variants": {
				"row4": {
					"layout": "row",
					"cols": "4"
				},
				"row3": {
					"layout": "row",
					"cols": "3"
				},
				"column": {
					"layout": "column",
					"cols": "4",
					"align": "start"
				}
			}
		},
		"store-policies": {
			"spec": "block.storepolicies",
			"organism": "blocks/store-policies.svelte",
			"organismName": "StorePolicies",
			"defaultVariant": "cols3",
			"variants": {
				"cols3": {
					"layout": "cards",
					"cols": "3"
				},
				"rows": {
					"layout": "rows",
					"cols": "3",
					"align": "start"
				}
			}
		},
		"stories-simple": {
			"spec": "block.storiessimple",
			"organism": "blocks/stories-simple.svelte",
			"organismName": "StoriesSimple",
			"defaultVariant": "cols3",
			"variants": {
				"cols3": {
					"layout": "grid",
					"cols": "3"
				},
				"duo": {
					"layout": "grid",
					"cols": "2"
				},
				"related3": {
					"layout": "compact",
					"cols": "3"
				}
			}
		},
		"team-simple": {
			"spec": "block.teamsimple",
			"organism": "blocks/team-simple.svelte",
			"organismName": "TeamSimple",
			"defaultVariant": "cols3",
			"variants": {
				"cols3": {
					"layout": "grid",
					"cols": "3",
					"surface": "plain"
				},
				"cols2": {
					"layout": "grid",
					"cols": "2",
					"surface": "plain"
				},
				"cols4": {
					"layout": "grid",
					"cols": "4",
					"surface": "plain"
				},
				"cards3": {
					"layout": "grid",
					"cols": "3",
					"surface": "cards"
				},
				"portraitRow": {
					"layout": "aside",
					"cols": "3",
					"surface": "plain",
					"align": "start"
				},
				"bylineCols3": {
					"layout": "byline",
					"cols": "3",
					"surface": "cards",
					"align": "start"
				},
				"sideList": {
					"layout": "list",
					"cols": "2",
					"surface": "plain",
					"align": "start"
				}
			}
		},
		"testimonials-simple": {
			"spec": "block.testimonialssimple",
			"organism": "blocks/testimonials-simple.svelte",
			"organismName": "TestimonialsSimple",
			"defaultVariant": "cols3",
			"variants": {
				"cols3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2"
				},
				"portraitRows": {
					"layout": "rows",
					"cols": "3"
				},
				"centered": {
					"layout": "centered",
					"cols": "3"
				}
			}
		},
		"timeline-simple": {
			"spec": "block.timelinesimple",
			"organism": "blocks/timeline-simple.svelte",
			"organismName": "TimelineSimple",
			"defaultVariant": "column",
			"variants": {
				"column": {
					"layout": "column",
					"cols": "2"
				},
				"grid2": {
					"layout": "grid",
					"cols": "2"
				},
				"grid4": {
					"layout": "grid",
					"cols": "4",
					"align": "center"
				}
			}
		},
		"topics-simple": {
			"spec": "block.topicssimple",
			"organism": "blocks/topics-simple.svelte",
			"organismName": "TopicsSimple",
			"defaultVariant": "cards3",
			"variants": {
				"cards3": {
					"layout": "cards",
					"cols": "3"
				},
				"cards2": {
					"layout": "cards",
					"cols": "2"
				},
				"rows": {
					"layout": "rows",
					"cols": "3"
				}
			}
		}
	},
	"assets": {
		"block.amenitiessimple/grid3": {
			"item": "amenities-simple",
			"variant": "grid3"
		},
		"block.amenitiessimple/grid2": {
			"item": "amenities-simple",
			"variant": "grid2"
		},
		"block.amenitiessimple/pills": {
			"item": "amenities-simple",
			"variant": "pills"
		},
		"block.articlelead/mediaTop": {
			"item": "article-lead",
			"variant": "mediaTop"
		},
		"block.articlelead/mediaStart": {
			"item": "article-lead",
			"variant": "mediaStart"
		},
		"block.articlelead/mediaEnd": {
			"item": "article-lead",
			"variant": "mediaEnd"
		},
		"block.articlesimple/column": {
			"item": "article-simple",
			"variant": "column"
		},
		"block.articlesimple/twoColumns": {
			"item": "article-simple",
			"variant": "twoColumns"
		},
		"block.casessimple/cards3": {
			"item": "cases-simple",
			"variant": "cards3"
		},
		"block.casessimple/cards2": {
			"item": "cases-simple",
			"variant": "cards2"
		},
		"block.casessimple/rows": {
			"item": "cases-simple",
			"variant": "rows"
		},
		"block.chapterssimple/illustratedRows": {
			"item": "chapters-simple",
			"variant": "illustratedRows"
		},
		"block.chapterssimple/paired": {
			"item": "chapters-simple",
			"variant": "paired"
		},
		"block.choicelinks/row": {
			"item": "choice-links",
			"variant": "row"
		},
		"block.choicelinks/grid": {
			"item": "choice-links",
			"variant": "grid"
		},
		"block.collectionssimple/cards4": {
			"item": "collections-simple",
			"variant": "cards4"
		},
		"block.collectionssimple/cards2": {
			"item": "collections-simple",
			"variant": "cards2"
		},
		"block.comparesimple/twoProducts": {
			"item": "compare-simple",
			"variant": "twoProducts"
		},
		"block.comparesimple/narrow": {
			"item": "compare-simple",
			"variant": "narrow"
		},
		"block.contactssimple/cards3": {
			"item": "contacts-simple",
			"variant": "cards3"
		},
		"block.contactssimple/cards2": {
			"item": "contacts-simple",
			"variant": "cards2"
		},
		"block.contactssimple/rows": {
			"item": "contacts-simple",
			"variant": "rows"
		},
		"block.courseoutline/moduleRows": {
			"item": "course-outline",
			"variant": "moduleRows"
		},
		"block.courseoutline/cards": {
			"item": "course-outline",
			"variant": "cards"
		},
		"block.ctasimple/center": {
			"item": "cta-simple",
			"variant": "center"
		},
		"block.ctasimple/start": {
			"item": "cta-simple",
			"variant": "start"
		},
		"block.ctasimple/between": {
			"item": "cta-simple",
			"variant": "between"
		},
		"block.ctasimple/centerOutline": {
			"item": "cta-simple",
			"variant": "centerOutline"
		},
		"block.ctasimple/betweenOutline": {
			"item": "cta-simple",
			"variant": "betweenOutline"
		},
		"block.deliverysimple/rows": {
			"item": "delivery-simple",
			"variant": "rows"
		},
		"block.deliverysimple/cards": {
			"item": "delivery-simple",
			"variant": "cards"
		},
		"block.digitalsimple/cards3": {
			"item": "digital-simple",
			"variant": "cards3"
		},
		"block.digitalsimple/rows": {
			"item": "digital-simple",
			"variant": "rows"
		},
		"block.errorsimple/center": {
			"item": "error-simple",
			"variant": "center"
		},
		"block.errorsimple/start": {
			"item": "error-simple",
			"variant": "start"
		},
		"block.eventintro/center": {
			"item": "event-intro",
			"variant": "center"
		},
		"block.eventintro/start": {
			"item": "event-intro",
			"variant": "start"
		},
		"block.faqsimple/grid2": {
			"item": "faq-simple",
			"variant": "grid2"
		},
		"block.faqsimple/list": {
			"item": "faq-simple",
			"variant": "list"
		},
		"block.featureshowcasesimple/mediaEnd": {
			"item": "feature-showcase-simple",
			"variant": "mediaEnd"
		},
		"block.featureshowcasesimple/mediaStart": {
			"item": "feature-showcase-simple",
			"variant": "mediaStart"
		},
		"block.featureshowcasesimple/mediaTop": {
			"item": "feature-showcase-simple",
			"variant": "mediaTop"
		},
		"block.featuressimple/cols3": {
			"item": "features-simple",
			"variant": "cols3"
		},
		"block.featuressimple/cols2": {
			"item": "features-simple",
			"variant": "cols2"
		},
		"block.featuressimple/cols4": {
			"item": "features-simple",
			"variant": "cols4"
		},
		"block.featuressimple/summaryRow": {
			"item": "features-simple",
			"variant": "summaryRow"
		},
		"block.featuressimple/summaryGrid": {
			"item": "features-simple",
			"variant": "summaryGrid"
		},
		"block.featuressimple/inlineGrid": {
			"item": "features-simple",
			"variant": "inlineGrid"
		},
		"block.featuressimple/checklist": {
			"item": "features-simple",
			"variant": "checklist"
		},
		"block.figuresimple/wide": {
			"item": "figure-simple",
			"variant": "wide"
		},
		"block.figuresimple/captionEnd": {
			"item": "figure-simple",
			"variant": "captionEnd"
		},
		"block.figuresimple/captionStart": {
			"item": "figure-simple",
			"variant": "captionStart"
		},
		"block.footersimple/brandLinks": {
			"item": "footer-simple",
			"variant": "brandLinks"
		},
		"block.footersimple/linkGrid": {
			"item": "footer-simple",
			"variant": "linkGrid"
		},
		"block.footersimple/centered": {
			"item": "footer-simple",
			"variant": "centered"
		},
		"block.galleryhero/photos3": {
			"item": "gallery-hero",
			"variant": "photos3"
		},
		"block.galleryhero/photos4": {
			"item": "gallery-hero",
			"variant": "photos4"
		},
		"block.galleryhero/photos3Start": {
			"item": "gallery-hero",
			"variant": "photos3Start"
		},
		"block.galleryhero/photos4Start": {
			"item": "gallery-hero",
			"variant": "photos4Start"
		},
		"block.galleryhero/photos3Bottom": {
			"item": "gallery-hero",
			"variant": "photos3Bottom"
		},
		"block.galleryhero/photos4Bottom": {
			"item": "gallery-hero",
			"variant": "photos4Bottom"
		},
		"block.guaranteessimple/strip4": {
			"item": "guarantees-simple",
			"variant": "strip4"
		},
		"block.guaranteessimple/strip3": {
			"item": "guarantees-simple",
			"variant": "strip3"
		},
		"block.guaranteessimple/cards4": {
			"item": "guarantees-simple",
			"variant": "cards4"
		},
		"block.guaranteessimple/cards3": {
			"item": "guarantees-simple",
			"variant": "cards3"
		},
		"block.headersimple/inline": {
			"item": "header-simple",
			"variant": "inline"
		},
		"block.headersimple/linksEnd": {
			"item": "header-simple",
			"variant": "linksEnd"
		},
		"block.headersimple/centered": {
			"item": "header-simple",
			"variant": "centered"
		},
		"block.herosimple/mediaEnd": {
			"item": "hero-simple",
			"variant": "mediaEnd"
		},
		"block.herosimple/mediaStart": {
			"item": "hero-simple",
			"variant": "mediaStart"
		},
		"block.herosimple/mediaTop": {
			"item": "hero-simple",
			"variant": "mediaTop"
		},
		"block.herosimple/mediaBottom": {
			"item": "hero-simple",
			"variant": "mediaBottom"
		},
		"block.herosimple/mediaEndPortrait": {
			"item": "hero-simple",
			"variant": "mediaEndPortrait"
		},
		"block.herosimple/mediaStartPortrait": {
			"item": "hero-simple",
			"variant": "mediaStartPortrait"
		},
		"block.hourssimple/columns": {
			"item": "hours-simple",
			"variant": "columns"
		},
		"block.hourssimple/columnsCard": {
			"item": "hours-simple",
			"variant": "columnsCard"
		},
		"block.hourssimple/stack": {
			"item": "hours-simple",
			"variant": "stack"
		},
		"block.hourssimple/stackCard": {
			"item": "hours-simple",
			"variant": "stackCard"
		},
		"block.introsimple/center": {
			"item": "intro-simple",
			"variant": "center"
		},
		"block.introsimple/start": {
			"item": "intro-simple",
			"variant": "start"
		},
		"block.introsimple/bottomStart": {
			"item": "intro-simple",
			"variant": "bottomStart"
		},
		"block.introsimple/bottomCenter": {
			"item": "intro-simple",
			"variant": "bottomCenter"
		},
		"block.locationssimple/mediaStart": {
			"item": "locations-simple",
			"variant": "mediaStart"
		},
		"block.locationssimple/mediaEnd": {
			"item": "locations-simple",
			"variant": "mediaEnd"
		},
		"block.logossimple/row": {
			"item": "logos-simple",
			"variant": "row"
		},
		"block.logossimple/cards": {
			"item": "logos-simple",
			"variant": "cards"
		},
		"block.menusimple/cards3": {
			"item": "menu-simple",
			"variant": "cards3"
		},
		"block.menusimple/cards2": {
			"item": "menu-simple",
			"variant": "cards2"
		},
		"block.menusimple/cards4": {
			"item": "menu-simple",
			"variant": "cards4"
		},
		"block.menusimple/rows": {
			"item": "menu-simple",
			"variant": "rows"
		},
		"block.offerssimple/duo": {
			"item": "offers-simple",
			"variant": "duo"
		},
		"block.offerssimple/duoStart": {
			"item": "offers-simple",
			"variant": "duoStart"
		},
		"block.photossimple/row4": {
			"item": "photos-simple",
			"variant": "row4"
		},
		"block.photossimple/grid3": {
			"item": "photos-simple",
			"variant": "grid3"
		},
		"block.photossimple/diptych": {
			"item": "photos-simple",
			"variant": "diptych"
		},
		"block.pricingsimple/cards3": {
			"item": "pricing-simple",
			"variant": "cards3"
		},
		"block.pricingsimple/cards2": {
			"item": "pricing-simple",
			"variant": "cards2"
		},
		"block.pricingsimple/rows": {
			"item": "pricing-simple",
			"variant": "rows"
		},
		"block.productreviews/cards3": {
			"item": "product-reviews",
			"variant": "cards3"
		},
		"block.productreviews/rows": {
			"item": "product-reviews",
			"variant": "rows"
		},
		"block.productsimple/mediaStart": {
			"item": "product-simple",
			"variant": "mediaStart"
		},
		"block.productsimple/mediaEnd": {
			"item": "product-simple",
			"variant": "mediaEnd"
		},
		"block.productsimple/mediaTop": {
			"item": "product-simple",
			"variant": "mediaTop"
		},
		"block.productssimple/cards3": {
			"item": "products-simple",
			"variant": "cards3"
		},
		"block.productssimple/denseGrid": {
			"item": "products-simple",
			"variant": "denseGrid"
		},
		"block.productssimple/rows": {
			"item": "products-simple",
			"variant": "rows"
		},
		"block.profileintro/portraitEnd": {
			"item": "profile-intro",
			"variant": "portraitEnd"
		},
		"block.profileintro/portraitStart": {
			"item": "profile-intro",
			"variant": "portraitStart"
		},
		"block.profileintro/portraitTop": {
			"item": "profile-intro",
			"variant": "portraitTop"
		},
		"block.promosimple/mediaEnd": {
			"item": "promo-simple",
			"variant": "mediaEnd"
		},
		"block.promosimple/mediaStart": {
			"item": "promo-simple",
			"variant": "mediaStart"
		},
		"block.promosimple/mediaTop": {
			"item": "promo-simple",
			"variant": "mediaTop"
		},
		"block.pullquotesimple/standalone": {
			"item": "pull-quote-simple",
			"variant": "standalone"
		},
		"block.pullquotesimple/centered": {
			"item": "pull-quote-simple",
			"variant": "centered"
		},
		"block.purchasesimple/panel": {
			"item": "purchase-simple",
			"variant": "panel"
		},
		"block.purchasesimple/centered": {
			"item": "purchase-simple",
			"variant": "centered"
		},
		"block.ratingsimple/inline": {
			"item": "rating-simple",
			"variant": "inline"
		},
		"block.ratingsimple/centered": {
			"item": "rating-simple",
			"variant": "centered"
		},
		"block.roomssimple/cards3": {
			"item": "rooms-simple",
			"variant": "cards3"
		},
		"block.roomssimple/cards2": {
			"item": "rooms-simple",
			"variant": "cards2"
		},
		"block.roomssimple/rows": {
			"item": "rooms-simple",
			"variant": "rows"
		},
		"block.servicessimple/cards3": {
			"item": "services-simple",
			"variant": "cards3"
		},
		"block.servicessimple/cards2": {
			"item": "services-simple",
			"variant": "cards2"
		},
		"block.servicessimple/rows": {
			"item": "services-simple",
			"variant": "rows"
		},
		"block.specssimple/keyValue": {
			"item": "specs-simple",
			"variant": "keyValue"
		},
		"block.specssimple/twoColumns": {
			"item": "specs-simple",
			"variant": "twoColumns"
		},
		"block.splitsimple/mediaEnd": {
			"item": "split-simple",
			"variant": "mediaEnd"
		},
		"block.splitsimple/mediaStart": {
			"item": "split-simple",
			"variant": "mediaStart"
		},
		"block.statssimple/cols4": {
			"item": "stats-simple",
			"variant": "cols4"
		},
		"block.statssimple/cols3": {
			"item": "stats-simple",
			"variant": "cols3"
		},
		"block.statssimple/cols2": {
			"item": "stats-simple",
			"variant": "cols2"
		},
		"block.statssimple/cards4": {
			"item": "stats-simple",
			"variant": "cards4"
		},
		"block.stepssimple/row4": {
			"item": "steps-simple",
			"variant": "row4"
		},
		"block.stepssimple/row3": {
			"item": "steps-simple",
			"variant": "row3"
		},
		"block.stepssimple/column": {
			"item": "steps-simple",
			"variant": "column"
		},
		"block.storepolicies/cols3": {
			"item": "store-policies",
			"variant": "cols3"
		},
		"block.storepolicies/rows": {
			"item": "store-policies",
			"variant": "rows"
		},
		"block.storiessimple/cols3": {
			"item": "stories-simple",
			"variant": "cols3"
		},
		"block.storiessimple/duo": {
			"item": "stories-simple",
			"variant": "duo"
		},
		"block.storiessimple/related3": {
			"item": "stories-simple",
			"variant": "related3"
		},
		"block.teamsimple/cols3": {
			"item": "team-simple",
			"variant": "cols3"
		},
		"block.teamsimple/cols2": {
			"item": "team-simple",
			"variant": "cols2"
		},
		"block.teamsimple/cols4": {
			"item": "team-simple",
			"variant": "cols4"
		},
		"block.teamsimple/cards3": {
			"item": "team-simple",
			"variant": "cards3"
		},
		"block.teamsimple/portraitRow": {
			"item": "team-simple",
			"variant": "portraitRow"
		},
		"block.teamsimple/bylineCols3": {
			"item": "team-simple",
			"variant": "bylineCols3"
		},
		"block.teamsimple/sideList": {
			"item": "team-simple",
			"variant": "sideList"
		},
		"block.testimonialssimple/cols3": {
			"item": "testimonials-simple",
			"variant": "cols3"
		},
		"block.testimonialssimple/cards2": {
			"item": "testimonials-simple",
			"variant": "cards2"
		},
		"block.testimonialssimple/portraitRows": {
			"item": "testimonials-simple",
			"variant": "portraitRows"
		},
		"block.testimonialssimple/centered": {
			"item": "testimonials-simple",
			"variant": "centered"
		},
		"block.timelinesimple/column": {
			"item": "timeline-simple",
			"variant": "column"
		},
		"block.timelinesimple/grid2": {
			"item": "timeline-simple",
			"variant": "grid2"
		},
		"block.timelinesimple/grid4": {
			"item": "timeline-simple",
			"variant": "grid4"
		},
		"block.topicssimple/cards3": {
			"item": "topics-simple",
			"variant": "cards3"
		},
		"block.topicssimple/cards2": {
			"item": "topics-simple",
			"variant": "cards2"
		},
		"block.topicssimple/rows": {
			"item": "topics-simple",
			"variant": "rows"
		}
	},
	"specs": {
		"block.amenitiessimple": {
			"item": "amenities-simple",
			"variant": "grid3"
		},
		"block.articlelead": {
			"item": "article-lead",
			"variant": "mediaTop"
		},
		"block.articlesimple": {
			"item": "article-simple",
			"variant": "column"
		},
		"block.casessimple": {
			"item": "cases-simple",
			"variant": "cards3"
		},
		"block.chapterssimple": {
			"item": "chapters-simple",
			"variant": "illustratedRows"
		},
		"block.choicelinks": {
			"item": "choice-links",
			"variant": "row"
		},
		"block.collectionssimple": {
			"item": "collections-simple",
			"variant": "cards4"
		},
		"block.comparesimple": {
			"item": "compare-simple",
			"variant": "twoProducts"
		},
		"block.contactssimple": {
			"item": "contacts-simple",
			"variant": "cards3"
		},
		"block.courseoutline": {
			"item": "course-outline",
			"variant": "moduleRows"
		},
		"block.ctasimple": {
			"item": "cta-simple",
			"variant": "center"
		},
		"block.deliverysimple": {
			"item": "delivery-simple",
			"variant": "rows"
		},
		"block.digitalsimple": {
			"item": "digital-simple",
			"variant": "cards3"
		},
		"block.errorsimple": {
			"item": "error-simple",
			"variant": "center"
		},
		"block.eventintro": {
			"item": "event-intro",
			"variant": "center"
		},
		"block.faqsimple": {
			"item": "faq-simple",
			"variant": "grid2"
		},
		"block.featureshowcasesimple": {
			"item": "feature-showcase-simple",
			"variant": "mediaEnd"
		},
		"block.featuressimple": {
			"item": "features-simple",
			"variant": "cols3"
		},
		"block.figuresimple": {
			"item": "figure-simple",
			"variant": "wide"
		},
		"block.footersimple": {
			"item": "footer-simple",
			"variant": "brandLinks"
		},
		"block.galleryhero": {
			"item": "gallery-hero",
			"variant": "photos3"
		},
		"block.guaranteessimple": {
			"item": "guarantees-simple",
			"variant": "strip4"
		},
		"block.headersimple": {
			"item": "header-simple",
			"variant": "inline"
		},
		"block.herosimple": {
			"item": "hero-simple",
			"variant": "mediaEnd"
		},
		"block.hourssimple": {
			"item": "hours-simple",
			"variant": "columns"
		},
		"block.introsimple": {
			"item": "intro-simple",
			"variant": "center"
		},
		"block.locationssimple": {
			"item": "locations-simple",
			"variant": "mediaStart"
		},
		"block.logossimple": {
			"item": "logos-simple",
			"variant": "row"
		},
		"block.menusimple": {
			"item": "menu-simple",
			"variant": "cards3"
		},
		"block.offerssimple": {
			"item": "offers-simple",
			"variant": "duo"
		},
		"block.photossimple": {
			"item": "photos-simple",
			"variant": "row4"
		},
		"block.pricingsimple": {
			"item": "pricing-simple",
			"variant": "cards3"
		},
		"block.productreviews": {
			"item": "product-reviews",
			"variant": "cards3"
		},
		"block.productsimple": {
			"item": "product-simple",
			"variant": "mediaStart"
		},
		"block.productssimple": {
			"item": "products-simple",
			"variant": "cards3"
		},
		"block.profileintro": {
			"item": "profile-intro",
			"variant": "portraitEnd"
		},
		"block.promosimple": {
			"item": "promo-simple",
			"variant": "mediaEnd"
		},
		"block.pullquotesimple": {
			"item": "pull-quote-simple",
			"variant": "standalone"
		},
		"block.purchasesimple": {
			"item": "purchase-simple",
			"variant": "panel"
		},
		"block.ratingsimple": {
			"item": "rating-simple",
			"variant": "inline"
		},
		"block.roomssimple": {
			"item": "rooms-simple",
			"variant": "cards3"
		},
		"block.servicessimple": {
			"item": "services-simple",
			"variant": "cards3"
		},
		"block.specssimple": {
			"item": "specs-simple",
			"variant": "keyValue"
		},
		"block.splitsimple": {
			"item": "split-simple",
			"variant": "mediaEnd"
		},
		"block.statssimple": {
			"item": "stats-simple",
			"variant": "cols4"
		},
		"block.stepssimple": {
			"item": "steps-simple",
			"variant": "row4"
		},
		"block.storepolicies": {
			"item": "store-policies",
			"variant": "cols3"
		},
		"block.storiessimple": {
			"item": "stories-simple",
			"variant": "cols3"
		},
		"block.teamsimple": {
			"item": "team-simple",
			"variant": "cols3"
		},
		"block.testimonialssimple": {
			"item": "testimonials-simple",
			"variant": "cols3"
		},
		"block.timelinesimple": {
			"item": "timeline-simple",
			"variant": "column"
		},
		"block.topicssimple": {
			"item": "topics-simple",
			"variant": "cards3"
		}
	}
};
});

__def("packages/builder-core/src/catalog/sources.ts", function (exports) {
const raw = __req("packages/builder-core/src/catalog/sources.json").default;
const catalogSources = raw as unknown as CatalogSources;

function withoutRefs(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withoutRefs);
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([, inner]) => !(typeof inner === "object" && inner !== null && ("$" in inner || ("op" in inner && "args" in inner))))
			.map(([key, inner]) => [key, withoutRefs(inner)])
	);
}

/** Published variant props of a registry block without dictionary refs; the default variant when none is set. */
function variantProps(item: string, variant: string | null | undefined): Record<string, unknown> | null {
	const block = Object.hasOwn(catalogSources.blocks, item) ? catalogSources.blocks[item]! : null;
	if (!block) return null;
	const preset = block.variants[variant ?? block.defaultVariant] ?? block.variants[block.defaultVariant];
	return preset ? (withoutRefs(preset) as Record<string, unknown>) : null;
}

exports["catalogSources"] = catalogSources;
exports["variantProps"] = variantProps;

});

__def("packages/builder-core/src/catalog/blocks.json", function (exports) {
  exports.default = {
	"format": "buildy-catalog-blocks",
	"version": 1,
	"registry": "https://registry.buildy.tw/svelte",
	"prototypes": {
		"repo": "ui8kit/prototypes",
		"commit": "8748fcb3b6df5767e10e8cb8ad937ad7ddf80cab",
		"generator": "codegen-x/ui8kit packages/prototypes",
		"inputs": {
			"sha256": "47c467be9f754aa3a99ee545abca9684c18d3454c7b468806e67378d98c3570f"
		}
	},
	"digest": "sha256:1526e530ebd62d6f4b45834f45e5c7dec722cce7c970a2001b1592f1f13c6995",
	"blocks": [
		{
			"item": "hero-simple",
			"title": "Hero Simple",
			"description": "A badge, the heading, one paragraph and up to two links as the actions (primary, then secondary), with one picture at the end, at the start (landscape or portrait), on top or at the bottom.",
			"category": "hero",
			"prototype": "hero-simple.svelte",
			"contract": {
				"item": "hero-simple",
				"version": 1,
				"block": "block.herosimple",
				"organism": "HeroSimple",
				"line": "simple",
				"model": "hero@1",
				"modelSchema": "https://registry.buildy.tw/models/hero@1.schema.json",
				"axes": {
					"media": [
						"end",
						"start",
						"top",
						"bottom"
					],
					"ratio": [
						"landscape",
						"portrait"
					]
				},
				"defaults": {
					"media": "end",
					"ratio": "landscape"
				},
				"variants": [
					{
						"id": "mediaEnd",
						"label": "Picture at the end",
						"axes": {
							"media": "end",
							"ratio": "landscape"
						}
					},
					{
						"id": "mediaStart",
						"label": "Picture at the start",
						"axes": {
							"media": "start",
							"ratio": "landscape"
						}
					},
					{
						"id": "mediaTop",
						"label": "Wide picture on top",
						"axes": {
							"media": "top",
							"ratio": "landscape"
						},
						"settings": {
							"align": "center"
						}
					},
					{
						"id": "mediaBottom",
						"label": "Wide picture at the bottom",
						"axes": {
							"media": "bottom",
							"ratio": "landscape"
						},
						"settings": {
							"align": "center"
						}
					},
					{
						"id": "mediaEndPortrait",
						"label": "Portrait picture at the end",
						"axes": {
							"media": "end",
							"ratio": "portrait"
						}
					},
					{
						"id": "mediaStartPortrait",
						"label": "Portrait picture at the start",
						"axes": {
							"media": "start",
							"ratio": "portrait"
						}
					}
				],
				"defaultVariant": "mediaEnd",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "badge",
						"kind": "badge",
						"fields": [
							"/badge"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "secondaryAction",
						"kind": "action",
						"fields": [
							"/secondaryActionLabel",
							"/secondaryActionHref"
						]
					},
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt",
							"/imageDark"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/hero@1.schema.json",
				"title": "HeroContent",
				"description": "Hero content: an optional badge, the heading, a description, one picture (light, optional dark) and up to two actions (the first drawn as the primary button, the second as the secondary one). One object is valid in every hero layout (media at the end, at the start, on top).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title"
				],
				"properties": {
					"badge": {
						"description": "a short pill above the heading; empty: no badge",
						"type": "string",
						"maxLength": 40
					},
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"image": {
						"description": "address of the picture (an https URL or a path); none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the picture; none: the title (the placeholder is decorative)",
						"type": "string",
						"maxLength": 160
					},
					"imageDark": {
						"description": "address of the picture in the dark theme; none: image",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"secondaryActionLabel": {
						"description": "the label of the second action (the secondary button after the first); drawn when the label and the address are both set; empty: none",
						"type": "string",
						"maxLength": 40
					},
					"secondaryActionHref": {
						"description": "the address of the second action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "intro-simple",
			"title": "Intro Simple",
			"description": "Text only: a badge, a large heading, one paragraph and up to two links as the actions (primary, then secondary), centred or at the start, in the middle of the section or low in a tall one.",
			"category": "hero",
			"prototype": "intro-simple.svelte",
			"contract": {
				"item": "intro-simple",
				"version": 1,
				"block": "block.introsimple",
				"organism": "IntroSimple",
				"line": "simple",
				"model": "intro@1",
				"modelSchema": "https://registry.buildy.tw/models/intro@1.schema.json",
				"axes": {
					"place": [
						"middle",
						"bottom"
					]
				},
				"defaults": {
					"place": "middle"
				},
				"variants": [
					{
						"id": "center",
						"label": "Centred",
						"axes": {
							"place": "middle"
						}
					},
					{
						"id": "start",
						"label": "At the start",
						"axes": {
							"place": "middle"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "bottomStart",
						"label": "Low in the section, at the start",
						"axes": {
							"place": "bottom"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "bottomCenter",
						"label": "Low in the section, centred",
						"axes": {
							"place": "bottom"
						}
					}
				],
				"defaultVariant": "center",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "badge",
						"kind": "badge",
						"fields": [
							"/badge"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "secondaryAction",
						"kind": "action",
						"fields": [
							"/secondaryActionLabel",
							"/secondaryActionHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/intro@1.schema.json",
				"title": "IntroContent",
				"description": "Intro content: an optional badge, the heading, a description and up to two actions (the first drawn as the primary button, the second as the secondary one). Text only: one object is valid in every intro layout (centred, at the start, low in the section).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title"
				],
				"properties": {
					"badge": {
						"description": "a short pill above the heading; empty: no badge",
						"type": "string",
						"maxLength": 40
					},
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"secondaryActionLabel": {
						"description": "the label of the second action (the secondary button after the first); drawn when the label and the address are both set; empty: none",
						"type": "string",
						"maxLength": 40
					},
					"secondaryActionHref": {
						"description": "the address of the second action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "gallery-hero",
			"title": "Gallery Hero",
			"description": "The heading, one paragraph and up to two links as the actions beside three or four photos: at the end, at the start, or in a row under the copy.",
			"category": "hero",
			"prototype": "gallery-hero.svelte",
			"contract": {
				"item": "gallery-hero",
				"version": 1,
				"block": "block.galleryhero",
				"organism": "GalleryHero",
				"line": "simple",
				"model": "gallery@1",
				"modelSchema": "https://registry.buildy.tw/models/gallery@1.schema.json",
				"axes": {
					"media": [
						"end",
						"start",
						"bottom"
					],
					"count": [
						"3",
						"4"
					]
				},
				"defaults": {
					"media": "end",
					"count": "3"
				},
				"variants": [
					{
						"id": "photos3",
						"label": "Three photos at the end",
						"axes": {
							"media": "end",
							"count": "3"
						}
					},
					{
						"id": "photos4",
						"label": "Four photos at the end",
						"axes": {
							"media": "end",
							"count": "4"
						}
					},
					{
						"id": "photos3Start",
						"label": "Three photos at the start",
						"axes": {
							"media": "start",
							"count": "3"
						}
					},
					{
						"id": "photos4Start",
						"label": "Four photos at the start",
						"axes": {
							"media": "start",
							"count": "4"
						}
					},
					{
						"id": "photos3Bottom",
						"label": "Three photos under the copy",
						"axes": {
							"media": "bottom",
							"count": "3"
						},
						"settings": {
							"align": "center"
						}
					},
					{
						"id": "photos4Bottom",
						"label": "Four photos under the copy",
						"axes": {
							"media": "bottom",
							"count": "4"
						},
						"settings": {
							"align": "center"
						}
					}
				],
				"defaultVariant": "photos3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "secondaryAction",
						"kind": "action",
						"fields": [
							"/secondaryActionLabel",
							"/secondaryActionHref"
						]
					},
					{
						"place": "photos.image",
						"kind": "media",
						"fields": [
							"/photos/*/image",
							"/photos/*/imageAlt"
						],
						"list": "photos"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/gallery@1.schema.json",
				"title": "GalleryContent",
				"description": "Gallery hero content: the heading, a description, up to two actions and three or four photos. One object is valid in every gallery layout (a grid of photos at the end or the start, layered photos at the end or under the copy).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"photos"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"secondaryActionLabel": {
						"description": "the label of the second action (the secondary button after the first); drawn when the label and the address are both set; empty: none",
						"type": "string",
						"maxLength": 40
					},
					"secondaryActionHref": {
						"description": "the address of the second action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"photos": {
						"description": "the photos, in the order they are shown (the layout shows three or four)",
						"type": "array",
						"minItems": 3,
						"maxItems": 4,
						"items": {
							"title": "GalleryPhoto",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"imageAlt"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the photo; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"imageAlt": {
									"description": "alt text of the photo",
									"type": "string",
									"maxLength": 160,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "split-simple",
			"title": "Split Simple",
			"description": "Two halves: the heading, one paragraph and up to two links as the actions (primary, then secondary) beside one picture that fills its half to the edge of the screen.",
			"category": "split",
			"prototype": "split-simple.svelte",
			"contract": {
				"item": "split-simple",
				"version": 1,
				"block": "block.splitsimple",
				"organism": "SplitSimple",
				"line": "simple",
				"model": "split@1",
				"modelSchema": "https://registry.buildy.tw/models/split@1.schema.json",
				"axes": {
					"media": [
						"end",
						"start"
					]
				},
				"defaults": {
					"media": "end"
				},
				"variants": [
					{
						"id": "mediaEnd",
						"label": "Picture at the end, to the edge",
						"axes": {
							"media": "end"
						}
					},
					{
						"id": "mediaStart",
						"label": "Picture at the start, to the edge",
						"axes": {
							"media": "start"
						}
					}
				],
				"defaultVariant": "mediaEnd",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt",
							"/imageDark"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "secondaryAction",
						"kind": "action",
						"fields": [
							"/secondaryActionLabel",
							"/secondaryActionHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/split@1.schema.json",
				"title": "SplitContent",
				"description": "Split content: the copy of one half (the heading, a description and up to two actions: the first drawn as the primary button, the second as the secondary one) and the picture of the other half (light, optional dark), which fills its half. One object is valid in every split layout (the picture at the end, at the start). Other media of the half (video, a sign-in form) are a later version of this model.",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"image": {
						"description": "address of the picture (an https URL or a path); none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the picture; none: the title (the placeholder is decorative)",
						"type": "string",
						"maxLength": 160
					},
					"imageDark": {
						"description": "address of the picture in the dark theme; none: image",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"secondaryActionLabel": {
						"description": "the label of the second action (the secondary button after the first); drawn when the label and the address are both set; empty: none",
						"type": "string",
						"maxLength": 40
					},
					"secondaryActionHref": {
						"description": "the address of the second action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "features-simple",
			"title": "Features Simple",
			"description": "The heading, one paragraph and the features as a list (an icon disc, a title, a line): in columns under the heading or beside it, the icon on top or at the side.",
			"category": "features",
			"prototype": "features-simple.svelte",
			"contract": {
				"item": "features-simple",
				"version": 1,
				"block": "block.featuressimple",
				"organism": "FeaturesSimple",
				"line": "simple",
				"model": "features@1",
				"modelSchema": "https://registry.buildy.tw/models/features@1.schema.json",
				"axes": {
					"layout": [
						"stack",
						"aside"
					],
					"cols": [
						"2",
						"3",
						"4"
					],
					"marker": [
						"top",
						"inline"
					]
				},
				"defaults": {
					"layout": "stack",
					"cols": "3",
					"marker": "top"
				},
				"variants": [
					{
						"id": "cols3",
						"label": "Three columns",
						"axes": {
							"layout": "stack",
							"cols": "3",
							"marker": "top"
						}
					},
					{
						"id": "cols2",
						"label": "Two columns",
						"axes": {
							"layout": "stack",
							"cols": "2",
							"marker": "top"
						}
					},
					{
						"id": "cols4",
						"label": "Four columns",
						"axes": {
							"layout": "stack",
							"cols": "4",
							"marker": "top"
						}
					},
					{
						"id": "summaryRow",
						"label": "The heading beside a row of three",
						"axes": {
							"layout": "aside",
							"cols": "3",
							"marker": "top"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "summaryGrid",
						"label": "The heading beside a 2 x 2 grid",
						"axes": {
							"layout": "aside",
							"cols": "2",
							"marker": "top"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "inlineGrid",
						"label": "Icons at the side, two columns",
						"axes": {
							"layout": "stack",
							"cols": "2",
							"marker": "inline"
						}
					},
					{
						"id": "checklist",
						"label": "The heading beside a list with icons at the side",
						"axes": {
							"layout": "aside",
							"cols": "2",
							"marker": "inline"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cols3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/features@1.schema.json",
				"title": "FeaturesContent",
				"description": "Features content: the heading, a description and an ordered list of two to eight features, each with an optional icon picture, a title and a line. One object is valid in every features layout (columns under the heading, the heading beside them, markers at the side, a checklist).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the features, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "SimpleFeature",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the icon picture of the feature; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the title of the feature",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the feature; empty: none",
									"type": "string",
									"maxLength": 240
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "stats-simple",
			"title": "Stats Simple",
			"description": "The heading, one paragraph and the figures as a list (a large value, a label, a note), in two, three or four columns, plain or on cards.",
			"category": "proof",
			"prototype": "stats-simple.svelte",
			"contract": {
				"item": "stats-simple",
				"version": 1,
				"block": "block.statssimple",
				"organism": "StatsSimple",
				"line": "simple",
				"model": "stats@1",
				"modelSchema": "https://registry.buildy.tw/models/stats@1.schema.json",
				"axes": {
					"cols": [
						"2",
						"3",
						"4"
					],
					"surface": [
						"plain",
						"cards"
					]
				},
				"defaults": {
					"cols": "4",
					"surface": "plain"
				},
				"variants": [
					{
						"id": "cols4",
						"label": "Four figures",
						"axes": {
							"cols": "4",
							"surface": "plain"
						}
					},
					{
						"id": "cols3",
						"label": "Three columns",
						"axes": {
							"cols": "3",
							"surface": "plain"
						}
					},
					{
						"id": "cols2",
						"label": "Two columns",
						"axes": {
							"cols": "2",
							"surface": "plain"
						}
					},
					{
						"id": "cards4",
						"label": "Four figures on cards",
						"axes": {
							"cols": "4",
							"surface": "cards"
						}
					}
				],
				"defaultVariant": "cols4",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.value",
						"kind": "text",
						"fields": [
							"/items/*/value"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 4
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/stats@1.schema.json",
				"title": "StatsContent",
				"description": "Stats content: the heading, a description and an ordered list of two to four figures, each with a value, a label and an optional note. One object is valid in every stats layout.",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the figures, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 4,
						"items": {
							"title": "SimpleStat",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"value",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"value": {
									"description": "the figure as it is shown (12k, 99.9%, 4.8)",
									"type": "string",
									"maxLength": 16,
									"minLength": 1,
									"pattern": "\\S"
								},
								"title": {
									"description": "what the figure counts",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "a short note under the label; empty: none",
									"type": "string",
									"maxLength": 160
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "testimonials-simple",
			"title": "Testimonials Simple",
			"description": "The heading, one paragraph and the quotes as a list (the words, a portrait, the name and the role): on cards in two or three columns, in rows with the portrait at the side, or centred.",
			"category": "proof",
			"prototype": "testimonials-simple.svelte",
			"contract": {
				"item": "testimonials-simple",
				"version": 1,
				"block": "block.testimonialssimple",
				"organism": "TestimonialsSimple",
				"line": "simple",
				"model": "testimonials@1",
				"modelSchema": "https://registry.buildy.tw/models/testimonials@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows",
						"centered"
					],
					"cols": [
						"2",
						"3"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cols3",
						"label": "Three cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two long quotes on cards",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "portraitRows",
						"label": "Portraits at the side",
						"axes": {
							"layout": "rows",
							"cols": "3"
						}
					},
					{
						"id": "centered",
						"label": "Centred quotes",
						"axes": {
							"layout": "centered",
							"cols": "3"
						}
					}
				],
				"defaultVariant": "cols3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "quotes.quote",
						"kind": "text",
						"fields": [
							"/quotes/*/quote"
						],
						"list": "quotes"
					},
					{
						"place": "quotes.avatar",
						"kind": "media",
						"fields": [
							"/quotes/*/avatar"
						],
						"list": "quotes"
					},
					{
						"place": "quotes.title",
						"kind": "heading",
						"fields": [
							"/quotes/*/title"
						],
						"list": "quotes"
					},
					{
						"place": "quotes.description",
						"kind": "text",
						"fields": [
							"/quotes/*/description"
						],
						"list": "quotes"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/testimonials@1.schema.json",
				"title": "TestimonialsContent",
				"description": "Testimonials content: the heading, a description and an ordered list of one to six quotes, each with the words, the author, a role line and a portrait. One object is valid in every testimonials layout (cards in columns, rows with the portrait at the side, one centred quote).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"quotes"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"quotes": {
						"description": "the quotes, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "SimpleQuote",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"quote",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"quote": {
									"description": "the words of the author",
									"type": "string",
									"maxLength": 400,
									"minLength": 1,
									"pattern": "\\S"
								},
								"avatar": {
									"description": "address of the portrait; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the author",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "the role and the company of the author; empty: none",
									"type": "string",
									"maxLength": 120
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "logos-simple",
			"title": "Logos Simple",
			"description": "A short heading over the logos as a list: a wrapping row or a grid of cards.",
			"category": "proof",
			"prototype": "logos-simple.svelte",
			"contract": {
				"item": "logos-simple",
				"version": 1,
				"block": "block.logossimple",
				"organism": "LogosSimple",
				"line": "simple",
				"model": "logos@1",
				"modelSchema": "https://registry.buildy.tw/models/logos@1.schema.json",
				"axes": {
					"surface": [
						"plain",
						"cards"
					]
				},
				"defaults": {
					"surface": "plain"
				},
				"variants": [
					{
						"id": "row",
						"label": "Logos in a row",
						"axes": {
							"surface": "plain"
						}
					},
					{
						"id": "cards",
						"label": "Logos on cards",
						"axes": {
							"surface": "cards"
						}
					}
				],
				"defaultVariant": "row",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "logos.image",
						"kind": "media",
						"fields": [
							"/logos/*/image",
							"/logos/*/title"
						],
						"list": "logos"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/logos@1.schema.json",
				"title": "LogosContent",
				"description": "Logos content: the heading and an ordered list of three to eight logos, each a picture and the name it stands for. One object is valid in every logos layout.",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"logos"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"logos": {
						"description": "the logos, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "SimpleLogo",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the logo; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the company (the alt text of the logo)",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "team-simple",
			"title": "Team Simple",
			"description": "The heading, one paragraph and the people as a list: a portrait, the name and the role, in two, three or four columns, plain or on cards.",
			"category": "company",
			"prototype": "team-simple.svelte",
			"contract": {
				"item": "team-simple",
				"version": 1,
				"block": "block.teamsimple",
				"organism": "TeamSimple",
				"line": "simple",
				"model": "team@1",
				"modelSchema": "https://registry.buildy.tw/models/team@1.schema.json",
				"axes": {
					"layout": [
						"grid",
						"aside",
						"byline",
						"list"
					],
					"cols": [
						"2",
						"3",
						"4"
					],
					"surface": [
						"plain",
						"cards"
					]
				},
				"defaults": {
					"layout": "grid",
					"cols": "3",
					"surface": "plain"
				},
				"variants": [
					{
						"id": "cols3",
						"label": "Three columns",
						"axes": {
							"layout": "grid",
							"cols": "3",
							"surface": "plain"
						}
					},
					{
						"id": "cols2",
						"label": "Two columns",
						"axes": {
							"layout": "grid",
							"cols": "2",
							"surface": "plain"
						}
					},
					{
						"id": "cols4",
						"label": "Four columns",
						"axes": {
							"layout": "grid",
							"cols": "4",
							"surface": "plain"
						}
					},
					{
						"id": "cards3",
						"label": "Three columns on cards",
						"axes": {
							"layout": "grid",
							"cols": "3",
							"surface": "cards"
						}
					},
					{
						"id": "portraitRow",
						"label": "The heading beside large portraits",
						"axes": {
							"layout": "aside",
							"cols": "3",
							"surface": "plain"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "bylineCols3",
						"label": "Small portraits beside the names, on cards",
						"axes": {
							"layout": "byline",
							"cols": "3",
							"surface": "cards"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "sideList",
						"label": "A compact list in two columns",
						"axes": {
							"layout": "list",
							"cols": "2",
							"surface": "plain"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cols3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "members.avatar",
						"kind": "media",
						"fields": [
							"/members/*/avatar"
						],
						"list": "members"
					},
					{
						"place": "members.title",
						"kind": "heading",
						"fields": [
							"/members/*/title"
						],
						"list": "members"
					},
					{
						"place": "members.description",
						"kind": "text",
						"fields": [
							"/members/*/description"
						],
						"list": "members"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/team@1.schema.json",
				"title": "TeamContent",
				"description": "Team content: the heading, a description and an ordered list of one to twelve members. One object is valid in every team layout (two, three or four columns, plain or on cards).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"members"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"members": {
						"description": "the people, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 12,
						"items": {
							"title": "SimpleMember",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the member (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"avatar": {
									"description": "address of the portrait; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the member",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "the role or a short line about the member; empty: none",
									"type": "string",
									"maxLength": 240
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "photos-simple",
			"title": "Photos Simple",
			"description": "The heading, one paragraph and the photos as a list in two, three or four columns.",
			"category": "company",
			"prototype": "photos-simple.svelte",
			"contract": {
				"item": "photos-simple",
				"version": 1,
				"block": "block.photossimple",
				"organism": "PhotosSimple",
				"line": "simple",
				"model": "photos@1",
				"modelSchema": "https://registry.buildy.tw/models/photos@1.schema.json",
				"axes": {
					"cols": [
						"2",
						"3",
						"4"
					]
				},
				"defaults": {
					"cols": "4"
				},
				"variants": [
					{
						"id": "row4",
						"label": "Four in a row",
						"axes": {
							"cols": "4"
						}
					},
					{
						"id": "grid3",
						"label": "Three columns",
						"axes": {
							"cols": "3"
						}
					},
					{
						"id": "diptych",
						"label": "A pair",
						"axes": {
							"cols": "2"
						}
					}
				],
				"defaultVariant": "row4",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "photos.image",
						"kind": "media",
						"fields": [
							"/photos/*/image",
							"/photos/*/imageAlt"
						],
						"list": "photos"
					}
				],
				"wireframe": {
					"items": 4
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/photos@1.schema.json",
				"title": "PhotosContent",
				"description": "Photos content: the heading, a description and an ordered list of two to eight photos. One object is valid in every photos layout (a row, a grid, a pair, a mosaic, a wide lead photo).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"photos"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"photos": {
						"description": "the photos, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 12,
						"items": {
							"title": "SimplePhoto",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"imageAlt"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the photo; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"imageAlt": {
									"description": "alt text of the photo",
									"type": "string",
									"maxLength": 160,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "stories-simple",
			"title": "Stories Simple",
			"description": "The heading, one paragraph and the stories as a list (a cover, the title as a link, a line): cards in two or three columns, or compact rows on a card surface.",
			"category": "blog",
			"prototype": "stories-simple.svelte",
			"contract": {
				"item": "stories-simple",
				"version": 1,
				"block": "block.storiessimple",
				"organism": "StoriesSimple",
				"line": "simple",
				"model": "stories@1",
				"modelSchema": "https://registry.buildy.tw/models/stories@1.schema.json",
				"axes": {
					"layout": [
						"grid",
						"compact"
					],
					"cols": [
						"2",
						"3"
					]
				},
				"defaults": {
					"layout": "grid",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cols3",
						"label": "Three columns",
						"axes": {
							"layout": "grid",
							"cols": "3"
						}
					},
					{
						"id": "duo",
						"label": "Two columns, wide covers",
						"axes": {
							"layout": "grid",
							"cols": "2"
						}
					},
					{
						"id": "related3",
						"label": "Compact rows on cards",
						"axes": {
							"layout": "compact",
							"cols": "3"
						}
					}
				],
				"defaultVariant": "cols3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "stories.image",
						"kind": "media",
						"fields": [
							"/stories/*/image"
						],
						"list": "stories"
					},
					{
						"place": "stories.title",
						"kind": "heading",
						"fields": [
							"/stories/*/title",
							"/stories/*/href"
						],
						"list": "stories"
					},
					{
						"place": "stories.description",
						"kind": "text",
						"fields": [
							"/stories/*/description"
						],
						"list": "stories"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/stories@1.schema.json",
				"title": "StoriesContent",
				"description": "Stories content: the heading, a description and an ordered list of one to six stories (posts), each with a cover picture, a title, a line and an address. One object is valid in every stories layout (columns, a featured story, compact rows, alternating rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"stories"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"stories": {
						"description": "the stories, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "SimpleStory",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the cover picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the title of the story",
									"type": "string",
									"maxLength": 120,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the story; empty: none",
									"type": "string",
									"maxLength": 240
								},
								"href": {
									"description": "the address of the story; none: the title is plain text",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "faq-simple",
			"title": "Faq Simple",
			"description": "The heading, one paragraph and the questions with their answers as a list, each under a rule, in two columns or one.",
			"category": "faq",
			"prototype": "faq-simple.svelte",
			"contract": {
				"item": "faq-simple",
				"version": 1,
				"block": "block.faqsimple",
				"organism": "FaqSimple",
				"line": "simple",
				"model": "faq@1",
				"modelSchema": "https://registry.buildy.tw/models/faq@1.schema.json",
				"axes": {
					"columns": [
						"one",
						"two"
					]
				},
				"defaults": {
					"columns": "two"
				},
				"variants": [
					{
						"id": "grid2",
						"label": "Two columns",
						"axes": {
							"columns": "two"
						}
					},
					{
						"id": "list",
						"label": "One column",
						"axes": {
							"columns": "one"
						}
					}
				],
				"defaultVariant": "grid2",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/faq@1.schema.json",
				"title": "FaqContent",
				"description": "FAQ content: the heading, a description and an ordered list of questions with their answers. One object is valid in every FAQ layout (one column, two columns).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the questions, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 12,
						"items": {
							"title": "SimpleQuestion",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"description"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the question",
									"type": "string",
									"maxLength": 160,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "the answer",
									"type": "string",
									"maxLength": 600,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "steps-simple",
			"title": "Steps Simple",
			"description": "The heading, one paragraph and the steps as an ordered list (a label, a title, a line), in a row of three or four, or one under the other.",
			"category": "how-it-works",
			"prototype": "steps-simple.svelte",
			"contract": {
				"item": "steps-simple",
				"version": 1,
				"block": "block.stepssimple",
				"organism": "StepsSimple",
				"line": "simple",
				"model": "steps@1",
				"modelSchema": "https://registry.buildy.tw/models/steps@1.schema.json",
				"axes": {
					"layout": [
						"row",
						"column"
					],
					"cols": [
						"3",
						"4"
					]
				},
				"defaults": {
					"layout": "row",
					"cols": "4"
				},
				"variants": [
					{
						"id": "row4",
						"label": "Four steps in a row",
						"axes": {
							"layout": "row",
							"cols": "4"
						}
					},
					{
						"id": "row3",
						"label": "Three columns",
						"axes": {
							"layout": "row",
							"cols": "3"
						}
					},
					{
						"id": "column",
						"label": "One under the other",
						"axes": {
							"layout": "column",
							"cols": "4"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "row4",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "steps.label",
						"kind": "badge",
						"fields": [
							"/steps/*/label"
						],
						"list": "steps"
					},
					{
						"place": "steps.title",
						"kind": "heading",
						"fields": [
							"/steps/*/title"
						],
						"list": "steps"
					},
					{
						"place": "steps.description",
						"kind": "text",
						"fields": [
							"/steps/*/description"
						],
						"list": "steps"
					}
				],
				"wireframe": {
					"items": 4
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/steps@1.schema.json",
				"title": "StepsContent",
				"description": "Steps content: the heading, a description and an ordered list of two to six steps, each with a short label (01, 02), a title and a line. One object is valid in every steps layout (a row, a column).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"steps"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"steps": {
						"description": "the steps, in the order they are taken",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "SimpleStep",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"label": {
									"description": "the short marker of the step (01, 2, A)",
									"type": "string",
									"maxLength": 8,
									"minLength": 1,
									"pattern": "\\S"
								},
								"title": {
									"description": "the title of the step",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the step; empty: none",
									"type": "string",
									"maxLength": 240
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "feature-showcase-simple",
			"title": "Feature Showcase Simple",
			"description": "The heading, one paragraph and the key points as a list beside one picture (at the end or the start), or the head over a wide picture with the points in three columns under it.",
			"category": "features",
			"prototype": "feature-showcase-simple.svelte",
			"contract": {
				"item": "feature-showcase-simple",
				"version": 1,
				"block": "block.featureshowcasesimple",
				"organism": "FeatureShowcaseSimple",
				"line": "simple",
				"model": "feature-showcase@1",
				"modelSchema": "https://registry.buildy.tw/models/feature-showcase@1.schema.json",
				"axes": {
					"media": [
						"end",
						"start",
						"top"
					]
				},
				"defaults": {
					"media": "end"
				},
				"variants": [
					{
						"id": "mediaEnd",
						"label": "Picture at the end",
						"axes": {
							"media": "end"
						}
					},
					{
						"id": "mediaStart",
						"label": "Picture at the start",
						"axes": {
							"media": "start"
						}
					},
					{
						"id": "mediaTop",
						"label": "Picture above the points",
						"axes": {
							"media": "top"
						},
						"settings": {
							"align": "center"
						}
					}
				],
				"defaultVariant": "mediaEnd",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/feature-showcase@1.schema.json",
				"title": "FeatureShowcaseContent",
				"description": "Feature showcase content: the heading, a description, one picture and an ordered list of two to six key points, each with a title and a line. One object is valid in every showcase layout (the picture at the end, at the start, above the points).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"imageAlt",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"image": {
						"description": "address of the picture; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the picture",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					},
					"items": {
						"description": "the key points, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "ShowcaseItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the title of the point",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the point; empty: none",
									"type": "string",
									"maxLength": 240
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "header-simple",
			"title": "Header Simple",
			"description": "The brand as the link home, the navigation links and one action in a bar: the links in the middle, at the end beside the action, or centred under the brand. No menu button: the links wrap on a narrow screen.",
			"category": "navigation",
			"prototype": "header-simple.svelte",
			"contract": {
				"item": "header-simple",
				"version": 1,
				"block": "block.headersimple",
				"organism": "HeaderSimple",
				"line": "simple",
				"model": "header@1",
				"modelSchema": "https://registry.buildy.tw/models/header@1.schema.json",
				"axes": {
					"layout": [
						"inline",
						"end",
						"centered"
					]
				},
				"defaults": {
					"layout": "inline"
				},
				"variants": [
					{
						"id": "inline",
						"label": "Links in the middle",
						"axes": {
							"layout": "inline"
						}
					},
					{
						"id": "linksEnd",
						"label": "Links at the end",
						"axes": {
							"layout": "end"
						}
					},
					{
						"id": "centered",
						"label": "Centred under the brand",
						"axes": {
							"layout": "centered"
						}
					}
				],
				"defaultVariant": "inline",
				"settings": {
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "brand",
						"kind": "text",
						"fields": [
							"/brand",
							"/brandHref"
						]
					},
					{
						"place": "links.label",
						"kind": "text",
						"fields": [
							"/links/*/label",
							"/links/*/href"
						],
						"list": "links"
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/header@1.schema.json",
				"title": "HeaderContent",
				"description": "Header content: the brand (a link home), an ordered list of navigation links and one action. One object is valid in every header layout (inline, the links at the end, centred).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"brand",
					"brandHref",
					"links"
				],
				"properties": {
					"brand": {
						"description": "the name of the site (the link home)",
						"type": "string",
						"maxLength": 40,
						"minLength": 1,
						"pattern": "\\S"
					},
					"brandHref": {
						"description": "the address of the home page",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"links": {
						"description": "the navigation links, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "HeaderLink",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"href"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"label": {
									"description": "the text of the link",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "footer-simple",
			"title": "Footer Simple",
			"description": "The brand and one line beside the links (a row or a grid of columns), or everything centred; the copyright line under them.",
			"category": "navigation",
			"prototype": "footer-simple.svelte",
			"contract": {
				"item": "footer-simple",
				"version": 1,
				"block": "block.footersimple",
				"organism": "FooterSimple",
				"line": "simple",
				"model": "footer@1",
				"modelSchema": "https://registry.buildy.tw/models/footer@1.schema.json",
				"axes": {
					"layout": [
						"row",
						"grid",
						"centered"
					]
				},
				"defaults": {
					"layout": "row"
				},
				"variants": [
					{
						"id": "brandLinks",
						"label": "The brand beside a row of links",
						"axes": {
							"layout": "row"
						}
					},
					{
						"id": "linkGrid",
						"label": "Links in columns",
						"axes": {
							"layout": "grid"
						}
					},
					{
						"id": "centered",
						"label": "Centred",
						"axes": {
							"layout": "centered"
						}
					}
				],
				"defaultVariant": "brandLinks",
				"settings": {
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "compact"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "brand",
						"kind": "text",
						"fields": [
							"/brand"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "links.label",
						"kind": "text",
						"fields": [
							"/links/*/label",
							"/links/*/href"
						],
						"list": "links"
					},
					{
						"place": "copyright",
						"kind": "text",
						"fields": [
							"/copyright"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/footer@1.schema.json",
				"title": "FooterContent",
				"description": "Footer content: the brand, one line about the site, an ordered list of links and the copyright line. One object is valid in every footer layout (the brand beside the links, a grid of links, centred).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"brand",
					"links",
					"copyright"
				],
				"properties": {
					"brand": {
						"description": "the name of the site",
						"type": "string",
						"maxLength": 40,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one line about the site; empty: none",
						"type": "string",
						"maxLength": 240
					},
					"links": {
						"description": "the links, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 12,
						"items": {
							"title": "FooterLink",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"href"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"label": {
									"description": "the text of the link",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					},
					"copyright": {
						"description": "the copyright line",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					}
				}
			}
		},
		{
			"item": "event-intro",
			"title": "Event Intro",
			"description": "The first screen of an event: a badge, the name as a large heading, one paragraph, the date and the place, and one action; centred or at the start.",
			"category": "hero",
			"prototype": "event-intro.svelte",
			"contract": {
				"item": "event-intro",
				"version": 1,
				"block": "block.eventintro",
				"organism": "EventIntro",
				"line": "simple",
				"model": "event@1",
				"modelSchema": "https://registry.buildy.tw/models/event@1.schema.json",
				"axes": {},
				"defaults": {},
				"variants": [
					{
						"id": "center",
						"label": "Centred",
						"axes": {}
					},
					{
						"id": "start",
						"label": "At the start",
						"axes": {},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "center",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "badge",
						"kind": "badge",
						"fields": [
							"/badge"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "date",
						"kind": "text",
						"fields": [
							"/date"
						]
					},
					{
						"place": "place",
						"kind": "text",
						"fields": [
							"/place"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/event@1.schema.json",
				"title": "EventContent",
				"description": "Event intro content: an optional badge, the name of the event as the heading, a description, the date, the place and one action. One object is valid in every event intro layout (centred, at the start).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"date",
					"place"
				],
				"properties": {
					"badge": {
						"description": "a short pill above the heading; empty: no badge",
						"type": "string",
						"maxLength": 40
					},
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"date": {
						"description": "the date and the time as they are shown",
						"type": "string",
						"maxLength": 60,
						"minLength": 1,
						"pattern": "\\S"
					},
					"place": {
						"description": "the place or the city, or online",
						"type": "string",
						"maxLength": 80,
						"minLength": 1,
						"pattern": "\\S"
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "profile-intro",
			"title": "Profile Intro",
			"description": "A person: the name, the role, one paragraph and the links beside the portrait (at the end or the start), or under a round portrait.",
			"category": "hero",
			"prototype": "profile-intro.svelte",
			"contract": {
				"item": "profile-intro",
				"version": 1,
				"block": "block.profileintro",
				"organism": "ProfileIntro",
				"line": "simple",
				"model": "profile@1",
				"modelSchema": "https://registry.buildy.tw/models/profile@1.schema.json",
				"axes": {
					"media": [
						"end",
						"start",
						"top"
					]
				},
				"defaults": {
					"media": "end"
				},
				"variants": [
					{
						"id": "portraitEnd",
						"label": "Portrait at the end",
						"axes": {
							"media": "end"
						}
					},
					{
						"id": "portraitStart",
						"label": "Portrait at the start",
						"axes": {
							"media": "start"
						}
					},
					{
						"id": "portraitTop",
						"label": "Round portrait above",
						"axes": {
							"media": "top"
						},
						"settings": {
							"align": "center"
						}
					}
				],
				"defaultVariant": "portraitEnd",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "role",
						"kind": "text",
						"fields": [
							"/role"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "links.label",
						"kind": "action",
						"fields": [
							"/links/*/label",
							"/links/*/href"
						],
						"list": "links"
					},
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/profile@1.schema.json",
				"title": "ProfileContent",
				"description": "Profile intro content: the name as the heading, the role, a description, a portrait and an ordered list of links (a site, social profiles). One object is valid in every profile layout (the portrait at the end, at the start, above the name).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"role",
					"imageAlt",
					"links"
				],
				"properties": {
					"title": {
						"description": "the name of the person (the heading)",
						"type": "string",
						"maxLength": 80,
						"minLength": 1,
						"pattern": "\\S"
					},
					"role": {
						"description": "the role and the company",
						"type": "string",
						"maxLength": 80,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"image": {
						"description": "address of the portrait; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the portrait",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					},
					"links": {
						"description": "the links of the person, in the order they are shown",
						"type": "array",
						"minItems": 0,
						"maxItems": 4,
						"items": {
							"title": "ProfileLink",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"href"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"label": {
									"description": "the text of the link",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "rating-simple",
			"title": "Rating Simple",
			"description": "The score, what it is and the source as a link: one bar on a card surface, or centred.",
			"category": "proof",
			"prototype": "rating-simple.svelte",
			"contract": {
				"item": "rating-simple",
				"version": 1,
				"block": "block.ratingsimple",
				"organism": "RatingSimple",
				"line": "simple",
				"model": "rating@1",
				"modelSchema": "https://registry.buildy.tw/models/rating@1.schema.json",
				"axes": {
					"layout": [
						"bar",
						"centered"
					]
				},
				"defaults": {
					"layout": "bar"
				},
				"variants": [
					{
						"id": "inline",
						"label": "A bar",
						"axes": {
							"layout": "bar"
						}
					},
					{
						"id": "centered",
						"label": "Centred",
						"axes": {
							"layout": "centered"
						}
					}
				],
				"defaultVariant": "inline",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "value",
						"kind": "text",
						"fields": [
							"/value"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "sourceLabel",
						"kind": "text",
						"fields": [
							"/sourceLabel",
							"/sourceHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/rating@1.schema.json",
				"title": "RatingContent",
				"description": "Rating content: the score, a heading that names it, a line (the count, the scale) and the source as a link. One object is valid in every rating layout (a bar, centred).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"value",
					"title"
				],
				"properties": {
					"value": {
						"description": "the score as it is shown (4.9, 98%)",
						"type": "string",
						"maxLength": 8,
						"minLength": 1,
						"pattern": "\\S"
					},
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "the count and the scale (out of 5, from 1,240 reviews); empty: none",
						"type": "string",
						"maxLength": 160
					},
					"sourceLabel": {
						"description": "the label of the source; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"sourceHref": {
						"description": "the address of the source",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "error-simple",
			"title": "Error Simple",
			"description": "A page for something that went wrong: the code, the heading, one paragraph and one action back; centred or at the start.",
			"category": "states",
			"prototype": "error-simple.svelte",
			"contract": {
				"item": "error-simple",
				"version": 1,
				"block": "block.errorsimple",
				"organism": "ErrorSimple",
				"line": "simple",
				"model": "error@1",
				"modelSchema": "https://registry.buildy.tw/models/error@1.schema.json",
				"axes": {},
				"defaults": {},
				"variants": [
					{
						"id": "center",
						"label": "Centred",
						"axes": {}
					},
					{
						"id": "start",
						"label": "At the start",
						"axes": {},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "center",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "code",
						"kind": "text",
						"fields": [
							"/code"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/error@1.schema.json",
				"title": "ErrorContent",
				"description": "Error content: the code (404, 500), a heading, a description and one action back. One object is valid in every error layout (centred, at the start).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"code",
					"title"
				],
				"properties": {
					"code": {
						"description": "the code as it is shown (404)",
						"type": "string",
						"maxLength": 8,
						"minLength": 1,
						"pattern": "\\S"
					},
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "figure-simple",
			"title": "Figure Simple",
			"description": "One large picture with its caption (a title, a line, the credit): wide with the caption under it, or the caption at the side.",
			"category": "story",
			"prototype": "figure-simple.svelte",
			"contract": {
				"item": "figure-simple",
				"version": 1,
				"block": "block.figuresimple",
				"organism": "FigureSimple",
				"line": "simple",
				"model": "figure@1",
				"modelSchema": "https://registry.buildy.tw/models/figure@1.schema.json",
				"axes": {
					"layout": [
						"wide",
						"end",
						"start"
					]
				},
				"defaults": {
					"layout": "wide"
				},
				"variants": [
					{
						"id": "wide",
						"label": "Wide, the caption under it",
						"axes": {
							"layout": "wide"
						}
					},
					{
						"id": "captionEnd",
						"label": "The caption at the end",
						"axes": {
							"layout": "end"
						}
					},
					{
						"id": "captionStart",
						"label": "The caption at the start",
						"axes": {
							"layout": "start"
						}
					}
				],
				"defaultVariant": "wide",
				"settings": {
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt"
						]
					},
					{
						"place": "title",
						"kind": "text",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "credit",
						"kind": "text",
						"fields": [
							"/credit"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/figure@1.schema.json",
				"title": "FigureContent",
				"description": "Figure content: one large picture with its caption: a title, a line and the credit. One object is valid in every figure layout (wide with the caption under it, the caption at the side).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"imageAlt",
					"title"
				],
				"properties": {
					"image": {
						"description": "address of the picture; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the picture",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					},
					"title": {
						"description": "the title of the caption (names the section)",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "the caption; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"credit": {
						"description": "the credit of the picture; empty: none",
						"type": "string",
						"maxLength": 80
					}
				}
			}
		},
		{
			"item": "pull-quote-simple",
			"title": "Pull Quote Simple",
			"description": "The words of a quote in large type with the author, a role line and the source under them: a bar at the side, or centred.",
			"category": "story",
			"prototype": "pull-quote-simple.svelte",
			"contract": {
				"item": "pull-quote-simple",
				"version": 1,
				"block": "block.pullquotesimple",
				"organism": "PullQuoteSimple",
				"line": "simple",
				"model": "pull-quote@1",
				"modelSchema": "https://registry.buildy.tw/models/pull-quote@1.schema.json",
				"axes": {
					"layout": [
						"rule",
						"centered"
					]
				},
				"defaults": {
					"layout": "rule"
				},
				"variants": [
					{
						"id": "standalone",
						"label": "A bar at the side",
						"axes": {
							"layout": "rule"
						}
					},
					{
						"id": "centered",
						"label": "Centred",
						"axes": {
							"layout": "centered"
						}
					}
				],
				"defaultVariant": "standalone",
				"settings": {
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "quote",
						"kind": "text",
						"fields": [
							"/quote"
						]
					},
					{
						"place": "title",
						"kind": "text",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "sourceLabel",
						"kind": "text",
						"fields": [
							"/sourceLabel",
							"/sourceHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/pull-quote@1.schema.json",
				"title": "PullQuoteContent",
				"description": "Pull quote content: the words, the author, a role line and the source as a link. One object is valid in every pull quote layout (a rule at the side, centred).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"quote",
					"title"
				],
				"properties": {
					"quote": {
						"description": "the words that are quoted",
						"type": "string",
						"maxLength": 400,
						"minLength": 1,
						"pattern": "\\S"
					},
					"title": {
						"description": "the name of the author (names the section)",
						"type": "string",
						"maxLength": 80,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "the role of the author; empty: none",
						"type": "string",
						"maxLength": 120
					},
					"sourceLabel": {
						"description": "the label of the source; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"sourceHref": {
						"description": "the address of the source",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "article-simple",
			"title": "Article Simple",
			"description": "The heading, one paragraph and the sections of a text (a subheading and its paragraph): one reading column, or two columns under a centred head.",
			"category": "story",
			"prototype": "article-simple.svelte",
			"contract": {
				"item": "article-simple",
				"version": 1,
				"block": "block.articlesimple",
				"organism": "ArticleSimple",
				"line": "simple",
				"model": "article@1",
				"modelSchema": "https://registry.buildy.tw/models/article@1.schema.json",
				"axes": {
					"layout": [
						"column",
						"columns"
					]
				},
				"defaults": {
					"layout": "column"
				},
				"variants": [
					{
						"id": "column",
						"label": "One reading column",
						"axes": {
							"layout": "column"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "twoColumns",
						"label": "Two columns",
						"axes": {
							"layout": "columns"
						},
						"settings": {
							"align": "center"
						}
					}
				],
				"defaultVariant": "column",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "sections.title",
						"kind": "heading",
						"fields": [
							"/sections/*/title"
						],
						"list": "sections"
					},
					{
						"place": "sections.description",
						"kind": "text",
						"fields": [
							"/sections/*/description"
						],
						"list": "sections"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/article@1.schema.json",
				"title": "ArticleContent",
				"description": "Article content: the heading, a description and an ordered list of sections, each with a subheading and its text. One object is valid in every article layout (one column, two columns).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"sections"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"sections": {
						"description": "the sections, in the order they are read",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "ArticleSection",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"description"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the subheading of the section",
									"type": "string",
									"maxLength": 120,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "the text of the section",
									"type": "string",
									"maxLength": 1200,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "article-lead",
			"title": "Article Lead",
			"description": "The head of an article: the heading, the lead paragraph and the byline (the portrait, the author, the date) under a wide cover, or beside it.",
			"category": "story",
			"prototype": "article-lead.svelte",
			"contract": {
				"item": "article-lead",
				"version": 1,
				"block": "block.articlelead",
				"organism": "ArticleLead",
				"line": "simple",
				"model": "article-lead@1",
				"modelSchema": "https://registry.buildy.tw/models/article-lead@1.schema.json",
				"axes": {
					"media": [
						"top",
						"start",
						"end"
					]
				},
				"defaults": {
					"media": "top"
				},
				"variants": [
					{
						"id": "mediaTop",
						"label": "Cover above",
						"axes": {
							"media": "top"
						}
					},
					{
						"id": "mediaStart",
						"label": "Cover at the start",
						"axes": {
							"media": "start"
						}
					},
					{
						"id": "mediaEnd",
						"label": "Cover at the end",
						"axes": {
							"media": "end"
						}
					}
				],
				"defaultVariant": "mediaTop",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "avatar",
						"kind": "media",
						"fields": [
							"/avatar",
							"/author"
						]
					},
					{
						"place": "author",
						"kind": "text",
						"fields": [
							"/author"
						]
					},
					{
						"place": "date",
						"kind": "text",
						"fields": [
							"/date"
						]
					},
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/article-lead@1.schema.json",
				"title": "ArticleLeadContent",
				"description": "Article lead content: the heading, the lead paragraph, a cover picture, the author with the portrait and the date. One object is valid in every article lead layout (the cover above, at the start, at the end).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"imageAlt",
					"author",
					"date"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"image": {
						"description": "address of the cover picture; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the cover picture",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					},
					"author": {
						"description": "the name of the author",
						"type": "string",
						"maxLength": 80,
						"minLength": 1,
						"pattern": "\\S"
					},
					"avatar": {
						"description": "address of the portrait of the author; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"date": {
						"description": "the date as it is shown",
						"type": "string",
						"maxLength": 40,
						"minLength": 1,
						"pattern": "\\S"
					}
				}
			}
		},
		{
			"item": "topics-simple",
			"title": "Topics Simple",
			"description": "The heading, one paragraph and the rubrics of a blog on cards (a label, the title as a link, a line): in two or three columns, or one under the other.",
			"category": "blog",
			"prototype": "topics-simple.svelte",
			"contract": {
				"item": "topics-simple",
				"version": 1,
				"block": "block.topicssimple",
				"organism": "TopicsSimple",
				"line": "simple",
				"model": "topics@1",
				"modelSchema": "https://registry.buildy.tw/models/topics@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"2",
						"3"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three columns",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two columns",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "rows",
						"label": "One under the other",
						"axes": {
							"layout": "rows",
							"cols": "3"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.label",
						"kind": "badge",
						"fields": [
							"/items/*/label"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title",
							"/items/*/href"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/topics@1.schema.json",
				"title": "TopicsContent",
				"description": "Topics content: the heading, a description and an ordered list of topics (blog rubrics), each with a short label, a title as a link and a line. One object is valid in every topics layout (cards in two or three columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the topics, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "TopicItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"label": {
									"description": "the short label (the count, the kind)",
									"type": "string",
									"maxLength": 24,
									"minLength": 1,
									"pattern": "\\S"
								},
								"title": {
									"description": "the name of the topic",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the topic; empty: none",
									"type": "string",
									"maxLength": 240
								},
								"href": {
									"description": "the address of the topic; none: the title is plain text",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "chapters-simple",
			"title": "Chapters Simple",
			"description": "The heading, one paragraph and the chapters (a picture, a label, the title, a paragraph): rows with the picture at the side, or a pair with the picture under the copy.",
			"category": "story",
			"prototype": "chapters-simple.svelte",
			"contract": {
				"item": "chapters-simple",
				"version": 1,
				"block": "block.chapterssimple",
				"organism": "ChaptersSimple",
				"line": "simple",
				"model": "chapters@1",
				"modelSchema": "https://registry.buildy.tw/models/chapters@1.schema.json",
				"axes": {
					"layout": [
						"rows",
						"paired"
					]
				},
				"defaults": {
					"layout": "rows"
				},
				"variants": [
					{
						"id": "illustratedRows",
						"label": "Rows with pictures",
						"axes": {
							"layout": "rows"
						}
					},
					{
						"id": "paired",
						"label": "A pair",
						"axes": {
							"layout": "paired"
						}
					}
				],
				"defaultVariant": "illustratedRows",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.label",
						"kind": "badge",
						"fields": [
							"/items/*/label"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/chapters@1.schema.json",
				"title": "ChaptersContent",
				"description": "Chapters content: the heading, a description and an ordered list of chapters, each with a picture, a short label, a title and a line. One object is valid in every chapters layout (rows with the picture at the side, a pair).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the chapters, in the order they are read",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "ChapterItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the picture of the chapter; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"label": {
									"description": "the short label (Chapter 1)",
									"type": "string",
									"maxLength": 24,
									"minLength": 1,
									"pattern": "\\S"
								},
								"title": {
									"description": "the title of the chapter (the alt text of the picture)",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one paragraph about the chapter; empty: none",
									"type": "string",
									"maxLength": 400
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "pricing-simple",
			"title": "Pricing Simple",
			"description": "The heading, one paragraph and the plans on cards (the name, a badge on the highlighted plan, a line, the price, an action): in three or two columns, or one row each.",
			"category": "pricing",
			"prototype": "pricing-simple.svelte",
			"contract": {
				"item": "pricing-simple",
				"version": 1,
				"block": "block.pricingsimple",
				"organism": "PricingSimple",
				"line": "simple",
				"model": "pricing@1",
				"modelSchema": "https://registry.buildy.tw/models/pricing@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three plans on cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two plans on cards",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "rows",
						"label": "One row per plan",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "plans.badge",
						"kind": "badge",
						"fields": [
							"/plans/*/badge"
						],
						"list": "plans"
					},
					{
						"place": "plans.title",
						"kind": "heading",
						"fields": [
							"/plans/*/title"
						],
						"list": "plans"
					},
					{
						"place": "plans.description",
						"kind": "text",
						"fields": [
							"/plans/*/description"
						],
						"list": "plans"
					},
					{
						"place": "plans.price",
						"kind": "text",
						"fields": [
							"/plans/*/price"
						],
						"list": "plans"
					},
					{
						"place": "plans.action",
						"kind": "action",
						"fields": [
							"/plans/*/actionLabel",
							"/plans/*/actionHref"
						],
						"list": "plans"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/pricing@1.schema.json",
				"title": "PricingContent",
				"description": "Pricing content: the heading, a description and an ordered list of two to four plans, each with a name, the price as it is shown, a line, an optional badge (the highlighted plan) and an action. One object is valid in every pricing layout (cards in two or three columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"plans"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"plans": {
						"description": "the plans, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 4,
						"items": {
							"title": "PricingPlan",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"price"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the name of the plan",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"price": {
									"description": "the price as it is shown ($12 / month)",
									"type": "string",
									"maxLength": 24,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the plan; empty: none",
									"type": "string",
									"maxLength": 240
								},
								"badge": {
									"description": "a short pill on the highlighted plan; empty: none",
									"type": "string",
									"maxLength": 24
								},
								"actionLabel": {
									"description": "the label of the action; the link is drawn when the label and the address are both set",
									"type": "string",
									"maxLength": 40
								},
								"actionHref": {
									"description": "the address of the action",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "contacts-simple",
			"title": "Contacts Simple",
			"description": "The heading, one paragraph and the teams to reach on cards (an icon, the name, a line, an action): in three or two columns, or rows with the icon at the side.",
			"category": "contact",
			"prototype": "contacts-simple.svelte",
			"contract": {
				"item": "contacts-simple",
				"version": 1,
				"block": "block.contactssimple",
				"organism": "ContactsSimple",
				"line": "simple",
				"model": "contacts@1",
				"modelSchema": "https://registry.buildy.tw/models/contacts@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two columns",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "rows",
						"label": "Icons at the side",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "items.action",
						"kind": "action",
						"fields": [
							"/items/*/actionLabel",
							"/items/*/actionHref"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/contacts@1.schema.json",
				"title": "ContactsContent",
				"description": "Contacts content: the heading, a description and an ordered list of teams or channels to reach, each with an icon picture, a name, a line and an action. One object is valid in every contacts layout (cards in two or three columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the contacts, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "ContactItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the icon picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the team or the channel",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line: the address, the phone or the hours; empty: none",
									"type": "string",
									"maxLength": 240
								},
								"actionLabel": {
									"description": "the label of the action; the link is drawn when the label and the address are both set",
									"type": "string",
									"maxLength": 40
								},
								"actionHref": {
									"description": "the address of the action",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "locations-simple",
			"title": "Locations Simple",
			"description": "The heading, one paragraph and the offices (the name, the address) in two columns beside one picture, at the start or the end.",
			"category": "contact",
			"prototype": "locations-simple.svelte",
			"contract": {
				"item": "locations-simple",
				"version": 1,
				"block": "block.locationssimple",
				"organism": "LocationsSimple",
				"line": "simple",
				"model": "locations@1",
				"modelSchema": "https://registry.buildy.tw/models/locations@1.schema.json",
				"axes": {
					"media": [
						"start",
						"end"
					]
				},
				"defaults": {
					"media": "start"
				},
				"variants": [
					{
						"id": "mediaStart",
						"label": "Picture at the start",
						"axes": {
							"media": "start"
						}
					},
					{
						"id": "mediaEnd",
						"label": "Picture at the end",
						"axes": {
							"media": "end"
						}
					}
				],
				"defaultVariant": "mediaStart",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/locations@1.schema.json",
				"title": "LocationsContent",
				"description": "Locations content: the heading, a description, one picture (a map or a place) and an ordered list of offices, each with a name and the address. One object is valid in every locations layout (the picture at the start, at the end).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"imageAlt",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"image": {
						"description": "address of the picture; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the picture",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					},
					"items": {
						"description": "the offices, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "LocationItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the name of the office or the city",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "the address and the hours; empty: none",
									"type": "string",
									"maxLength": 240
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "offers-simple",
			"title": "Offers Simple",
			"description": "The heading, one paragraph and two or three offers on cards, each with a title, a line and an action.",
			"category": "cta",
			"prototype": "offers-simple.svelte",
			"contract": {
				"item": "offers-simple",
				"version": 1,
				"block": "block.offerssimple",
				"organism": "OffersSimple",
				"line": "simple",
				"model": "offers@1",
				"modelSchema": "https://registry.buildy.tw/models/offers@1.schema.json",
				"axes": {
					"cols": [
						"2",
						"3"
					]
				},
				"defaults": {
					"cols": "2"
				},
				"variants": [
					{
						"id": "duo",
						"label": "Two offers",
						"axes": {
							"cols": "2"
						}
					},
					{
						"id": "duoStart",
						"label": "Two offers, the heading at the start",
						"axes": {
							"cols": "2"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "duo",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "items.action",
						"kind": "action",
						"fields": [
							"/items/*/actionLabel",
							"/items/*/actionHref"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 2
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/offers@1.schema.json",
				"title": "OffersContent",
				"description": "Offers content: the heading, a description and an ordered list of two or three offers, each with a title, a line and an action. One object is valid in every offers layout (two or three cards).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the offers, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 3,
						"items": {
							"title": "OfferItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the title of the offer",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the offer; empty: none",
									"type": "string",
									"maxLength": 240
								},
								"actionLabel": {
									"description": "the label of the action; the link is drawn when the label and the address are both set",
									"type": "string",
									"maxLength": 40
								},
								"actionHref": {
									"description": "the address of the action",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "products-simple",
			"title": "Products Simple",
			"description": "The heading, one paragraph and the products (a picture, the name as a link, the price): in three or four columns, or rows with the picture at the side.",
			"category": "catalog",
			"prototype": "products-simple.svelte",
			"contract": {
				"item": "products-simple",
				"version": 1,
				"block": "block.productssimple",
				"organism": "ProductsSimple",
				"line": "simple",
				"model": "products@1",
				"modelSchema": "https://registry.buildy.tw/models/products@1.schema.json",
				"axes": {
					"layout": [
						"grid",
						"rows"
					],
					"cols": [
						"3",
						"4"
					]
				},
				"defaults": {
					"layout": "grid",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three columns",
						"axes": {
							"layout": "grid",
							"cols": "3"
						}
					},
					{
						"id": "denseGrid",
						"label": "Four columns, compact",
						"axes": {
							"layout": "grid",
							"cols": "4"
						}
					},
					{
						"id": "rows",
						"label": "Rows",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title",
							"/items/*/href"
						],
						"list": "items"
					},
					{
						"place": "items.price",
						"kind": "text",
						"fields": [
							"/items/*/price"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/products@1.schema.json",
				"title": "ProductsContent",
				"description": "Products content: the heading, a description and an ordered list of products, each with a picture, a name as a link and the price as it is shown. One object is valid in every products layout (three or four columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the products, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "ProductItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"price"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the product picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the product (the alt text of the picture)",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"price": {
									"description": "the price as it is shown",
									"type": "string",
									"maxLength": 24,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the product; none: the name is plain text",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "product-simple",
			"title": "Product Simple",
			"description": "One product: the main picture and thumbnails beside the name, the price, one paragraph and the action; the pictures at the start, at the end or above.",
			"category": "product",
			"prototype": "product-simple.svelte",
			"contract": {
				"item": "product-simple",
				"version": 1,
				"block": "block.productsimple",
				"organism": "ProductSimple",
				"line": "simple",
				"model": "product@1",
				"modelSchema": "https://registry.buildy.tw/models/product@1.schema.json",
				"axes": {
					"media": [
						"start",
						"end",
						"top"
					]
				},
				"defaults": {
					"media": "start"
				},
				"variants": [
					{
						"id": "mediaStart",
						"label": "Pictures at the start",
						"axes": {
							"media": "start"
						}
					},
					{
						"id": "mediaEnd",
						"label": "Pictures at the end",
						"axes": {
							"media": "end"
						}
					},
					{
						"id": "mediaTop",
						"label": "Pictures above",
						"axes": {
							"media": "top"
						}
					}
				],
				"defaultVariant": "mediaStart",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "price",
						"kind": "text",
						"fields": [
							"/price"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt"
						]
					},
					{
						"place": "photos.image",
						"kind": "media",
						"fields": [
							"/photos/*/image"
						],
						"list": "photos"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/product@1.schema.json",
				"title": "ProductContent",
				"description": "Product content: the name as the heading, a description, the price as it is shown, the main picture, up to four more pictures and one action. One object is valid in every product layout (the pictures at the start, at the end, above).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"price",
					"imageAlt",
					"photos"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"price": {
						"description": "the price as it is shown",
						"type": "string",
						"maxLength": 24,
						"minLength": 1,
						"pattern": "\\S"
					},
					"image": {
						"description": "address of the main picture; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the main picture",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"photos": {
						"description": "more pictures of the product, thumbnails under the main picture (named by the product)",
						"type": "array",
						"minItems": 0,
						"maxItems": 4,
						"items": {
							"title": "ProductPhoto",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "collections-simple",
			"title": "Collections Simple",
			"description": "The heading, one paragraph and the collections (a picture and the name as one link) in four or two columns.",
			"category": "catalog",
			"prototype": "collections-simple.svelte",
			"contract": {
				"item": "collections-simple",
				"version": 1,
				"block": "block.collectionssimple",
				"organism": "CollectionsSimple",
				"line": "simple",
				"model": "collections@1",
				"modelSchema": "https://registry.buildy.tw/models/collections@1.schema.json",
				"axes": {
					"cols": [
						"4",
						"3",
						"2"
					]
				},
				"defaults": {
					"cols": "4"
				},
				"variants": [
					{
						"id": "cards4",
						"label": "Four columns",
						"axes": {
							"cols": "4"
						}
					},
					{
						"id": "cards2",
						"label": "Two columns",
						"axes": {
							"cols": "2"
						}
					}
				],
				"defaultVariant": "cards4",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "text",
						"fields": [
							"/items/*/title",
							"/items/*/href"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 4
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/collections@1.schema.json",
				"title": "CollectionsContent",
				"description": "Collections content: the heading, a description and an ordered list of collections (categories), each a picture and a name as one link. One object is valid in every collections layout (two, three or four columns).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the collections, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "CollectionItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"href"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the picture of the collection; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the collection",
									"type": "string",
									"maxLength": 60,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the collection",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "specs-simple",
			"title": "Specs Simple",
			"description": "The heading, one paragraph and the specifications as name and value rows on a muted surface, in one narrow column or two columns.",
			"category": "product",
			"prototype": "specs-simple.svelte",
			"contract": {
				"item": "specs-simple",
				"version": 1,
				"block": "block.specssimple",
				"organism": "SpecsSimple",
				"line": "simple",
				"model": "specs@1",
				"modelSchema": "https://registry.buildy.tw/models/specs@1.schema.json",
				"axes": {
					"layout": [
						"rows",
						"columns"
					]
				},
				"defaults": {
					"layout": "rows"
				},
				"variants": [
					{
						"id": "keyValue",
						"label": "Rows",
						"axes": {
							"layout": "rows"
						}
					},
					{
						"id": "twoColumns",
						"label": "Two columns",
						"axes": {
							"layout": "columns"
						}
					}
				],
				"defaultVariant": "keyValue",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "text",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/specs@1.schema.json",
				"title": "SpecsContent",
				"description": "Specs content: the heading, a description and an ordered list of specifications, each a name and its value. One object is valid in every specs layout (rows, two columns).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the specifications, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 16,
						"items": {
							"title": "SpecItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"description"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the name of the specification",
									"type": "string",
									"maxLength": 60,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "the value as it is shown",
									"type": "string",
									"maxLength": 120,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "compare-simple",
			"title": "Compare Simple",
			"description": "The heading, one paragraph and two options side by side: their names in a header row, then a row per feature with the value of each.",
			"category": "product",
			"prototype": "compare-simple.svelte",
			"contract": {
				"item": "compare-simple",
				"version": 1,
				"block": "block.comparesimple",
				"organism": "CompareSimple",
				"line": "simple",
				"model": "compare@1",
				"modelSchema": "https://registry.buildy.tw/models/compare@1.schema.json",
				"axes": {
					"width": [
						"wide",
						"narrow"
					]
				},
				"defaults": {
					"width": "wide"
				},
				"variants": [
					{
						"id": "twoProducts",
						"label": "Two options",
						"axes": {
							"width": "wide"
						}
					},
					{
						"id": "narrow",
						"label": "Two options, narrow",
						"axes": {
							"width": "narrow"
						}
					}
				],
				"defaultVariant": "twoProducts",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "firstLabel",
						"kind": "text",
						"fields": [
							"/firstLabel"
						]
					},
					{
						"place": "secondLabel",
						"kind": "text",
						"fields": [
							"/secondLabel"
						]
					},
					{
						"place": "rows.title",
						"kind": "text",
						"fields": [
							"/rows/*/title"
						],
						"list": "rows"
					},
					{
						"place": "rows.first",
						"kind": "text",
						"fields": [
							"/rows/*/first"
						],
						"list": "rows"
					},
					{
						"place": "rows.second",
						"kind": "text",
						"fields": [
							"/rows/*/second"
						],
						"list": "rows"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/compare@1.schema.json",
				"title": "CompareContent",
				"description": "Compare content: the heading, a description, the names of the two options and an ordered list of rows, each a feature with the value of each option. One object is valid in every compare layout (a table, cards).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"firstLabel",
					"secondLabel",
					"rows"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"firstLabel": {
						"description": "the name of the first option",
						"type": "string",
						"maxLength": 40,
						"minLength": 1,
						"pattern": "\\S"
					},
					"secondLabel": {
						"description": "the name of the second option",
						"type": "string",
						"maxLength": 40,
						"minLength": 1,
						"pattern": "\\S"
					},
					"rows": {
						"description": "the rows, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 12,
						"items": {
							"title": "CompareLine",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"first",
								"second"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the feature that is compared",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"first": {
									"description": "the value of the first option",
									"type": "string",
									"maxLength": 60,
									"minLength": 1,
									"pattern": "\\S"
								},
								"second": {
									"description": "the value of the second option",
									"type": "string",
									"maxLength": 60,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "course-outline",
			"title": "Course Outline",
			"description": "The heading, one paragraph and the modules in order (a label, the title, a line, the length): rows in a narrow column, or two columns of cards.",
			"category": "how-it-works",
			"prototype": "course-outline.svelte",
			"contract": {
				"item": "course-outline",
				"version": 1,
				"block": "block.courseoutline",
				"organism": "CourseOutline",
				"line": "simple",
				"model": "curriculum@1",
				"modelSchema": "https://registry.buildy.tw/models/curriculum@1.schema.json",
				"axes": {
					"layout": [
						"rows",
						"cards"
					]
				},
				"defaults": {
					"layout": "rows"
				},
				"variants": [
					{
						"id": "moduleRows",
						"label": "Rows",
						"axes": {
							"layout": "rows"
						}
					},
					{
						"id": "cards",
						"label": "Two columns of cards",
						"axes": {
							"layout": "cards"
						}
					}
				],
				"defaultVariant": "moduleRows",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "modules.label",
						"kind": "badge",
						"fields": [
							"/modules/*/label"
						],
						"list": "modules"
					},
					{
						"place": "modules.title",
						"kind": "heading",
						"fields": [
							"/modules/*/title"
						],
						"list": "modules"
					},
					{
						"place": "modules.description",
						"kind": "text",
						"fields": [
							"/modules/*/description"
						],
						"list": "modules"
					},
					{
						"place": "modules.meta",
						"kind": "text",
						"fields": [
							"/modules/*/meta"
						],
						"list": "modules"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/curriculum@1.schema.json",
				"title": "CurriculumContent",
				"description": "Curriculum content: the heading, a description and an ordered list of modules, each with a short label, a title, a line and a meta line (the length). One object is valid in every curriculum layout (rows, two columns of cards).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"modules"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"modules": {
						"description": "the modules, in the order they are taken",
						"type": "array",
						"minItems": 1,
						"maxItems": 12,
						"items": {
							"title": "CourseModule",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"label": {
									"description": "the short label (Module 1)",
									"type": "string",
									"maxLength": 24,
									"minLength": 1,
									"pattern": "\\S"
								},
								"title": {
									"description": "the title of the module",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the module; empty: none",
									"type": "string",
									"maxLength": 240
								},
								"meta": {
									"description": "the meta line (2 hours, 5 lessons); empty: none",
									"type": "string",
									"maxLength": 40
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "choice-links",
			"title": "Choice Links",
			"description": "The heading, one paragraph and the options (sizes, versions) as outline links: a wrapping row, or a grid of four.",
			"category": "product",
			"prototype": "choice-links.svelte",
			"contract": {
				"item": "choice-links",
				"version": 1,
				"block": "block.choicelinks",
				"organism": "ChoiceLinks",
				"line": "simple",
				"model": "choices@1",
				"modelSchema": "https://registry.buildy.tw/models/choices@1.schema.json",
				"axes": {
					"layout": [
						"row",
						"grid"
					]
				},
				"defaults": {
					"layout": "row"
				},
				"variants": [
					{
						"id": "row",
						"label": "A row",
						"axes": {
							"layout": "row"
						}
					},
					{
						"id": "grid",
						"label": "A grid",
						"axes": {
							"layout": "grid"
						}
					}
				],
				"defaultVariant": "row",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.label",
						"kind": "action",
						"fields": [
							"/items/*/label",
							"/items/*/href"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/choices@1.schema.json",
				"title": "ChoicesContent",
				"description": "Choices content: the heading, a description and an ordered list of options as links (sizes, versions, plans). One object is valid in every choices layout (a row, a grid).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the options, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "ChoiceItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"label",
								"href"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"label": {
									"description": "the text of the link",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "purchase-simple",
			"title": "Purchase Simple",
			"description": "On a card surface: the heading and one paragraph beside the price, the action and a note; or all centred.",
			"category": "product",
			"prototype": "purchase-simple.svelte",
			"contract": {
				"item": "purchase-simple",
				"version": 1,
				"block": "block.purchasesimple",
				"organism": "PurchaseSimple",
				"line": "simple",
				"model": "purchase@1",
				"modelSchema": "https://registry.buildy.tw/models/purchase@1.schema.json",
				"axes": {
					"layout": [
						"panel",
						"centered"
					]
				},
				"defaults": {
					"layout": "panel"
				},
				"variants": [
					{
						"id": "panel",
						"label": "A panel",
						"axes": {
							"layout": "panel"
						}
					},
					{
						"id": "centered",
						"label": "Centred",
						"axes": {
							"layout": "centered"
						}
					}
				],
				"defaultVariant": "panel",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "price",
						"kind": "text",
						"fields": [
							"/price"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "note",
						"kind": "text",
						"fields": [
							"/note"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/purchase@1.schema.json",
				"title": "PurchaseContent",
				"description": "Purchase content: the heading, a description, the price as it is shown, a note (delivery, returns) and one action. One object is valid in every purchase layout (a panel, centred).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"price"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"price": {
						"description": "the price as it is shown",
						"type": "string",
						"maxLength": 24,
						"minLength": 1,
						"pattern": "\\S"
					},
					"note": {
						"description": "a short note under the action; empty: none",
						"type": "string",
						"maxLength": 120
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "store-policies",
			"title": "Store Policies",
			"description": "The heading, one paragraph and the policies (payment, delivery, returns), each with an icon, a title and a line: on cards in columns, or rows.",
			"category": "storefront",
			"prototype": "store-policies.svelte",
			"contract": {
				"item": "store-policies",
				"version": 1,
				"block": "block.storepolicies",
				"organism": "StorePolicies",
				"line": "simple",
				"model": "store-policy@1",
				"modelSchema": "https://registry.buildy.tw/models/store-policy@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cols3",
						"label": "Three cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "rows",
						"label": "Icons at the side",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cols3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/store-policy@1.schema.json",
				"title": "StorePolicyContent",
				"description": "Store policy content: the heading, a description and an ordered list of policies (payment, delivery, returns), each with an icon picture, a title and a line. One object is valid in every store policy layout (three columns on cards, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the policies, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "PolicyItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the icon picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the title of the policy",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the policy; empty: none",
									"type": "string",
									"maxLength": 240
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "product-reviews",
			"title": "Product Reviews",
			"description": "The heading, one paragraph and the reviews on cards (the rating, the words, the reviewer with the portrait): in three or two columns, or one under the other.",
			"category": "product",
			"prototype": "product-reviews.svelte",
			"contract": {
				"item": "product-reviews",
				"version": 1,
				"block": "block.productreviews",
				"organism": "ProductReviews",
				"line": "simple",
				"model": "reviews@1",
				"modelSchema": "https://registry.buildy.tw/models/reviews@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "rows",
						"label": "One under the other",
						"axes": {
							"layout": "rows",
							"cols": "3"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.rating",
						"kind": "text",
						"fields": [
							"/items/*/rating"
						],
						"list": "items"
					},
					{
						"place": "items.quote",
						"kind": "text",
						"fields": [
							"/items/*/quote"
						],
						"list": "items"
					},
					{
						"place": "items.avatar",
						"kind": "media",
						"fields": [
							"/items/*/avatar"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/reviews@1.schema.json",
				"title": "ReviewsContent",
				"description": "Reviews content: the heading, a description and an ordered list of reviews, each with the rating as it is shown, the words, the portrait, the name and a line (the date, the product). One object is valid in every reviews layout (cards in two or three columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the reviews, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "ReviewItem",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"rating",
								"quote",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"rating": {
									"description": "the rating as it is shown (5 / 5)",
									"type": "string",
									"maxLength": 16,
									"minLength": 1,
									"pattern": "\\S"
								},
								"quote": {
									"description": "the words of the review",
									"type": "string",
									"maxLength": 400,
									"minLength": 1,
									"pattern": "\\S"
								},
								"avatar": {
									"description": "address of the portrait; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the reviewer",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "a line: the date or the product; empty: none",
									"type": "string",
									"maxLength": 80
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "menu-simple",
			"title": "Menu Simple",
			"description": "The heading, one paragraph and the dishes (a picture, a badge when set, the name, the weight, a line, the price): on cards in three, two or four columns, or menu rows with the price at the end.",
			"category": "food",
			"prototype": "menu-simple.svelte",
			"contract": {
				"item": "menu-simple",
				"version": 1,
				"block": "block.menusimple",
				"organism": "MenuSimple",
				"line": "simple",
				"model": "menu@1",
				"modelSchema": "https://registry.buildy.tw/models/menu@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2",
						"4"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three dish cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two columns",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "cards4",
						"label": "Four columns",
						"axes": {
							"layout": "cards",
							"cols": "4"
						}
					},
					{
						"id": "rows",
						"label": "Menu rows, the price at the end",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.badge",
						"kind": "badge",
						"fields": [
							"/items/*/badge"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.weight",
						"kind": "text",
						"fields": [
							"/items/*/weight"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "items.price",
						"kind": "text",
						"fields": [
							"/items/*/price"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/menu@1.schema.json",
				"title": "MenuContent",
				"description": "Menu content: the heading, a description and an ordered list of dishes, each with a picture, the name, the weight or the portion, the price as it is shown, a line and an optional badge. One object is valid in every menu layout (cards in two, three or four columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the dishes, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 8,
						"items": {
							"title": "MenuDish",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"price"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the dish picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the dish (the alt text of the picture)",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"weight": {
									"description": "the weight or the portion as it is shown; empty: none",
									"type": "string",
									"maxLength": 40
								},
								"price": {
									"description": "the price as it is shown",
									"type": "string",
									"maxLength": 24,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the dish; empty: none",
									"type": "string",
									"maxLength": 200
								},
								"badge": {
									"description": "a short pill (new, spicy); empty: no badge",
									"type": "string",
									"maxLength": 24
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "cta-simple",
			"title": "Cta Simple",
			"description": "One band: a badge when set, the heading, one paragraph and up to two buttons; centred or at the start, or the buttons at the end; on a muted or an outlined surface.",
			"category": "cta",
			"prototype": "cta-simple.svelte",
			"contract": {
				"item": "cta-simple",
				"version": 1,
				"block": "block.ctasimple",
				"organism": "CtaSimple",
				"line": "simple",
				"model": "cta@1",
				"modelSchema": "https://registry.buildy.tw/models/cta@1.schema.json",
				"axes": {
					"layout": [
						"stack",
						"between"
					],
					"surface": [
						"muted",
						"outline"
					]
				},
				"defaults": {
					"layout": "stack",
					"surface": "muted"
				},
				"variants": [
					{
						"id": "center",
						"label": "Centred band",
						"axes": {
							"layout": "stack",
							"surface": "muted"
						}
					},
					{
						"id": "start",
						"label": "At the start",
						"axes": {
							"layout": "stack",
							"surface": "muted"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "between",
						"label": "Buttons at the end",
						"axes": {
							"layout": "between",
							"surface": "muted"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "centerOutline",
						"label": "Centred, outlined",
						"axes": {
							"layout": "stack",
							"surface": "outline"
						}
					},
					{
						"id": "betweenOutline",
						"label": "Buttons at the end, outlined",
						"axes": {
							"layout": "between",
							"surface": "outline"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "center",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "badge",
						"kind": "badge",
						"fields": [
							"/badge"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "secondaryAction",
						"kind": "action",
						"fields": [
							"/secondaryActionLabel",
							"/secondaryActionHref"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/cta@1.schema.json",
				"title": "CtaContent",
				"description": "Call to action content: an optional badge, the heading, a description, up to two actions. One object is valid in every call to action layout (centred, at the start, the actions at the end; muted or outlined).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title"
				],
				"properties": {
					"badge": {
						"description": "a short pill above the heading; empty: no badge",
						"type": "string",
						"maxLength": 40
					},
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"secondaryActionLabel": {
						"description": "the label of the second action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"secondaryActionHref": {
						"description": "the address of the second action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					}
				}
			}
		},
		{
			"item": "promo-simple",
			"title": "Promo Simple",
			"description": "One offer: the discount as a badge, the heading, the deadline as text, one paragraph, a promo code when set and one button, beside a picture at the end or at the start, or under a wide one.",
			"category": "cta",
			"prototype": "promo-simple.svelte",
			"contract": {
				"item": "promo-simple",
				"version": 1,
				"block": "block.promosimple",
				"organism": "PromoSimple",
				"line": "simple",
				"model": "promo@1",
				"modelSchema": "https://registry.buildy.tw/models/promo@1.schema.json",
				"axes": {
					"media": [
						"end",
						"start",
						"top"
					]
				},
				"defaults": {
					"media": "end"
				},
				"variants": [
					{
						"id": "mediaEnd",
						"label": "Picture at the end",
						"axes": {
							"media": "end"
						}
					},
					{
						"id": "mediaStart",
						"label": "Picture at the start",
						"axes": {
							"media": "start"
						}
					},
					{
						"id": "mediaTop",
						"label": "Wide picture on top",
						"axes": {
							"media": "top"
						},
						"settings": {
							"align": "center"
						}
					}
				],
				"defaultVariant": "mediaEnd",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "badge",
						"kind": "badge",
						"fields": [
							"/badge"
						]
					},
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "deadline",
						"kind": "text",
						"fields": [
							"/deadline"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "code",
						"kind": "text",
						"fields": [
							"/code"
						]
					},
					{
						"place": "action",
						"kind": "action",
						"fields": [
							"/actionLabel",
							"/actionHref"
						]
					},
					{
						"place": "media",
						"kind": "media",
						"fields": [
							"/image",
							"/imageAlt"
						]
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/promo@1.schema.json",
				"title": "PromoContent",
				"description": "Promo content: one offer with the discount as a badge, the heading, the deadline as text, a description, an optional promo code, one action and a picture. One object is valid in every promo layout (the picture at the end, at the start, on top).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"deadline",
					"imageAlt"
				],
				"properties": {
					"badge": {
						"description": "the discount as a short pill (-20%); empty: no badge",
						"type": "string",
						"maxLength": 24
					},
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"deadline": {
						"description": "the deadline of the offer as it is shown (until 31 December)",
						"type": "string",
						"maxLength": 60,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"code": {
						"description": "a promo code; empty: none",
						"type": "string",
						"maxLength": 24
					},
					"actionLabel": {
						"description": "the label of the action; the link is drawn when the label and the address are both set",
						"type": "string",
						"maxLength": 40
					},
					"actionHref": {
						"description": "the address of the action",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"image": {
						"description": "address of the picture; none: the placeholder",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"imageAlt": {
						"description": "alt text of the picture",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					}
				}
			}
		},
		{
			"item": "hours-simple",
			"title": "Hours Simple",
			"description": "The heading, one paragraph, the address (a link to the map), the phone and the opening hours by day: side by side or in one narrow column, plain or on cards.",
			"category": "contact",
			"prototype": "hours-simple.svelte",
			"contract": {
				"item": "hours-simple",
				"version": 1,
				"block": "block.hourssimple",
				"organism": "HoursSimple",
				"line": "simple",
				"model": "hours@1",
				"modelSchema": "https://registry.buildy.tw/models/hours@1.schema.json",
				"axes": {
					"layout": [
						"columns",
						"stack"
					],
					"surface": [
						"plain",
						"card"
					]
				},
				"defaults": {
					"layout": "columns",
					"surface": "plain"
				},
				"variants": [
					{
						"id": "columns",
						"label": "Address and hours side by side",
						"axes": {
							"layout": "columns",
							"surface": "plain"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "columnsCard",
						"label": "Side by side on cards",
						"axes": {
							"layout": "columns",
							"surface": "card"
						},
						"settings": {
							"align": "start"
						}
					},
					{
						"id": "stack",
						"label": "One centred column",
						"axes": {
							"layout": "stack",
							"surface": "plain"
						}
					},
					{
						"id": "stackCard",
						"label": "One column on cards",
						"axes": {
							"layout": "stack",
							"surface": "card"
						}
					}
				],
				"defaultVariant": "columns",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "address",
						"kind": "text",
						"fields": [
							"/address",
							"/mapHref"
						]
					},
					{
						"place": "phone",
						"kind": "text",
						"fields": [
							"/phone",
							"/phoneHref"
						]
					},
					{
						"place": "items.day",
						"kind": "text",
						"fields": [
							"/items/*/day"
						],
						"list": "items"
					},
					{
						"place": "items.time",
						"kind": "text",
						"fields": [
							"/items/*/time"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/hours@1.schema.json",
				"title": "HoursContent",
				"description": "Opening hours content: the heading, a description, the address, the phone and its link, an optional map address (the address links to it) and the opening hours, a row per day or per days. One object is valid in every hours layout (side by side, one column; plain or on cards).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"address",
					"phone",
					"phoneHref",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"address": {
						"description": "the address as it is shown",
						"type": "string",
						"maxLength": 160,
						"minLength": 1,
						"pattern": "\\S"
					},
					"phone": {
						"description": "the phone number as it is shown",
						"type": "string",
						"maxLength": 40,
						"minLength": 1,
						"pattern": "\\S"
					},
					"phoneHref": {
						"description": "the address of the phone link (tel:)",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"mapHref": {
						"description": "the address of the map; set: the address is a link to it",
						"type": "string",
						"maxLength": 2048,
						"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
					},
					"items": {
						"description": "the opening hours, a row per day or per days",
						"type": "array",
						"minItems": 1,
						"maxItems": 7,
						"items": {
							"title": "OpeningHour",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"day",
								"time"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"day": {
									"description": "the day or the days (Mon to Fri)",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"time": {
									"description": "the time as it is shown (12:00 to 23:00), or closed",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "rooms-simple",
			"title": "Rooms Simple",
			"description": "The heading, one paragraph and the rooms (a picture, the name as a link, the guests, a line, the price a night): on cards in three or two columns, or rows with the picture at the start.",
			"category": "catalog",
			"prototype": "rooms-simple.svelte",
			"contract": {
				"item": "rooms-simple",
				"version": 1,
				"block": "block.roomssimple",
				"organism": "RoomsSimple",
				"line": "simple",
				"model": "rooms@1",
				"modelSchema": "https://registry.buildy.tw/models/rooms@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three room cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two columns",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "rows",
						"label": "Rows, the picture at the start",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title",
							"/items/*/href"
						],
						"list": "items"
					},
					{
						"place": "items.guests",
						"kind": "text",
						"fields": [
							"/items/*/guests"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "items.price",
						"kind": "text",
						"fields": [
							"/items/*/price"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/rooms@1.schema.json",
				"title": "RoomsContent",
				"description": "Rooms content: the heading, a description and an ordered list of rooms or apartments, each with a picture, the name, the guests or the size, a line, the price a night as it is shown and an optional address. One object is valid in every rooms layout (cards in three or two columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the rooms, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "Room",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"price"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the room picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"title": {
									"description": "the name of the room (the alt text of the picture)",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"guests": {
									"description": "the guests or the size as it is shown (2 guests, 24 m2); empty: none",
									"type": "string",
									"maxLength": 60
								},
								"description": {
									"description": "one line about the room; empty: none",
									"type": "string",
									"maxLength": 200
								},
								"price": {
									"description": "the price a night as it is shown",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the room page; empty: no link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "guarantees-simple",
			"title": "Guarantees Simple",
			"description": "The heading, one paragraph and the promises (delivery, quality, returns), each a short title and a line: side by side on one muted band, or on cards, in four or three columns.",
			"category": "features",
			"prototype": "guarantees-simple.svelte",
			"contract": {
				"item": "guarantees-simple",
				"version": 1,
				"block": "block.guaranteessimple",
				"organism": "GuaranteesSimple",
				"line": "simple",
				"model": "guarantees@1",
				"modelSchema": "https://registry.buildy.tw/models/guarantees@1.schema.json",
				"axes": {
					"layout": [
						"strip",
						"cards"
					],
					"cols": [
						"4",
						"3"
					]
				},
				"defaults": {
					"layout": "strip",
					"cols": "4"
				},
				"variants": [
					{
						"id": "strip4",
						"label": "A strip of four",
						"axes": {
							"layout": "strip",
							"cols": "4"
						}
					},
					{
						"id": "strip3",
						"label": "A strip of three",
						"axes": {
							"layout": "strip",
							"cols": "3"
						}
					},
					{
						"id": "cards4",
						"label": "Four cards",
						"axes": {
							"layout": "cards",
							"cols": "4"
						}
					},
					{
						"id": "cards3",
						"label": "Three cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					}
				],
				"defaultVariant": "strip4",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.text",
						"kind": "text",
						"fields": [
							"/items/*/text"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 4
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/guarantees@1.schema.json",
				"title": "GuaranteesContent",
				"description": "Guarantees content: the heading, a description and an ordered list of promises, each with a short title and a line. One object is valid in every guarantees layout (a strip, cards; four or three columns).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the promises, in the order they are shown",
						"type": "array",
						"minItems": 2,
						"maxItems": 8,
						"items": {
							"title": "Guarantee",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the promise in a few words",
									"type": "string",
									"maxLength": 60,
									"minLength": 1,
									"pattern": "\\S"
								},
								"text": {
									"description": "one line about the promise; empty: none",
									"type": "string",
									"maxLength": 160
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "services-simple",
			"title": "Services Simple",
			"description": "The heading, one paragraph and the services (the name as a link, a line, the starting price): on cards in three or two columns, or rows with the price at the end.",
			"category": "features",
			"prototype": "services-simple.svelte",
			"contract": {
				"item": "services-simple",
				"version": 1,
				"block": "block.servicessimple",
				"organism": "ServicesSimple",
				"line": "simple",
				"model": "services@1",
				"modelSchema": "https://registry.buildy.tw/models/services@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three service cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two columns",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "rows",
						"label": "Rows, the price at the end",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title",
							"/items/*/href"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "items.price",
						"kind": "text",
						"fields": [
							"/items/*/price"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/services@1.schema.json",
				"title": "ServicesContent",
				"description": "Services content: the heading, a description and an ordered list of services, each with the name, a line, the price as it is shown and an optional address. One object is valid in every services layout (cards in three or two columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the services, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 9,
						"items": {
							"title": "Service",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the name of the service",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the service; empty: none",
									"type": "string",
									"maxLength": 200
								},
								"price": {
									"description": "the price as it is shown (from 90 000 per project); empty: none",
									"type": "string",
									"maxLength": 40
								},
								"href": {
									"description": "the address of the service page; empty: no link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "cases-simple",
			"title": "Cases Simple",
			"description": "The heading, one paragraph and the case studies (a picture, the client, the title as a link, the result in one line): on cards in three or two columns, or rows with the picture at the start.",
			"category": "proof",
			"prototype": "cases-simple.svelte",
			"contract": {
				"item": "cases-simple",
				"version": 1,
				"block": "block.casessimple",
				"organism": "CasesSimple",
				"line": "simple",
				"model": "cases@1",
				"modelSchema": "https://registry.buildy.tw/models/cases@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "cards",
					"cols": "3"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three case cards",
						"axes": {
							"layout": "cards",
							"cols": "3"
						}
					},
					{
						"id": "cards2",
						"label": "Two columns",
						"axes": {
							"layout": "cards",
							"cols": "2"
						}
					},
					{
						"id": "rows",
						"label": "Rows, the picture at the start",
						"axes": {
							"layout": "rows",
							"cols": "3"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.image",
						"kind": "media",
						"fields": [
							"/items/*/image"
						],
						"list": "items"
					},
					{
						"place": "items.client",
						"kind": "text",
						"fields": [
							"/items/*/client"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title",
							"/items/*/href"
						],
						"list": "items"
					},
					{
						"place": "items.result",
						"kind": "text",
						"fields": [
							"/items/*/result"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/cases@1.schema.json",
				"title": "CasesContent",
				"description": "Case studies content: the heading, a description and an ordered list of cases, each with a picture, the client, the title, the result in one line and an optional address. One object is valid in every cases layout (cards in three or two columns, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the cases, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "CaseStudy",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"image": {
									"description": "address of the case picture; none: the placeholder",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:https?:|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								},
								"client": {
									"description": "the client or the industry; empty: none",
									"type": "string",
									"maxLength": 60
								},
								"title": {
									"description": "the title of the case (the alt text of the picture)",
									"type": "string",
									"maxLength": 100,
									"minLength": 1,
									"pattern": "\\S"
								},
								"result": {
									"description": "the result in one line; empty: none",
									"type": "string",
									"maxLength": 200
								},
								"href": {
									"description": "the address of the case page; empty: no link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "timeline-simple",
			"title": "Timeline Simple",
			"description": "The heading, one paragraph and the steps of a process or a history (the date or the stage, a title, a line) as an ordered list: one column of muted steps, or side by side in two or four columns.",
			"category": "how-it-works",
			"prototype": "timeline-simple.svelte",
			"contract": {
				"item": "timeline-simple",
				"version": 1,
				"block": "block.timelinesimple",
				"organism": "TimelineSimple",
				"line": "simple",
				"model": "timeline@1",
				"modelSchema": "https://registry.buildy.tw/models/timeline@1.schema.json",
				"axes": {
					"layout": [
						"column",
						"grid"
					],
					"cols": [
						"2",
						"4"
					]
				},
				"defaults": {
					"layout": "column",
					"cols": "2"
				},
				"variants": [
					{
						"id": "column",
						"label": "One column",
						"axes": {
							"layout": "column",
							"cols": "2"
						}
					},
					{
						"id": "grid2",
						"label": "Two columns",
						"axes": {
							"layout": "grid",
							"cols": "2"
						}
					},
					{
						"id": "grid4",
						"label": "Four columns",
						"axes": {
							"layout": "grid",
							"cols": "4"
						},
						"settings": {
							"align": "center"
						}
					}
				],
				"defaultVariant": "column",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "start"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.date",
						"kind": "text",
						"fields": [
							"/items/*/date"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.text",
						"kind": "text",
						"fields": [
							"/items/*/text"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 2
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/timeline@1.schema.json",
				"title": "TimelineContent",
				"description": "Timeline content: the heading, a description and the steps of a process or a history, each with the date or the stage, a title and a line. One object is valid in every timeline layout (one column, two or four columns).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the steps, in their order",
						"type": "array",
						"minItems": 2,
						"maxItems": 8,
						"items": {
							"title": "TimelineStep",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"date",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"date": {
									"description": "the date or the stage as it is shown (Week 1, 2024)",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"title": {
									"description": "the title of the step",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"text": {
									"description": "one line about the step; empty: none",
									"type": "string",
									"maxLength": 200
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "amenities-simple",
			"title": "Amenities Simple",
			"description": "The heading, one paragraph and the amenities of a stay or a venue as short names: muted rows in three or two columns, or outlined pills in a wrapping row.",
			"category": "features",
			"prototype": "amenities-simple.svelte",
			"contract": {
				"item": "amenities-simple",
				"version": 1,
				"block": "block.amenitiessimple",
				"organism": "AmenitiesSimple",
				"line": "simple",
				"model": "amenities@1",
				"modelSchema": "https://registry.buildy.tw/models/amenities@1.schema.json",
				"axes": {
					"layout": [
						"grid",
						"pills"
					],
					"cols": [
						"3",
						"2"
					]
				},
				"defaults": {
					"layout": "grid",
					"cols": "3"
				},
				"variants": [
					{
						"id": "grid3",
						"label": "Three columns",
						"axes": {
							"layout": "grid",
							"cols": "3"
						}
					},
					{
						"id": "grid2",
						"label": "Two columns",
						"axes": {
							"layout": "grid",
							"cols": "2"
						}
					},
					{
						"id": "pills",
						"label": "Pills in a row",
						"axes": {
							"layout": "pills",
							"cols": "3"
						}
					}
				],
				"defaultVariant": "grid3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "text",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/amenities@1.schema.json",
				"title": "AmenitiesContent",
				"description": "Amenities content: the heading, a description and an ordered list of amenities as short names. One object is valid in every amenities layout (rows in three or two columns, pills).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the amenities, in the order they are shown",
						"type": "array",
						"minItems": 2,
						"maxItems": 16,
						"items": {
							"title": "Amenity",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the amenity in a few words",
									"type": "string",
									"maxLength": 60,
									"minLength": 1,
									"pattern": "\\S"
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "delivery-simple",
			"title": "Delivery Simple",
			"description": "The heading, one paragraph and the delivery zones (the area, the time, the minimum order, the price): card rows with the price at the end, or cards in three columns.",
			"category": "delivery",
			"prototype": "delivery-simple.svelte",
			"contract": {
				"item": "delivery-simple",
				"version": 1,
				"block": "block.deliverysimple",
				"organism": "DeliverySimple",
				"line": "simple",
				"model": "delivery@1",
				"modelSchema": "https://registry.buildy.tw/models/delivery@1.schema.json",
				"axes": {
					"layout": [
						"rows",
						"cards"
					]
				},
				"defaults": {
					"layout": "rows"
				},
				"variants": [
					{
						"id": "rows",
						"label": "Rows, the price at the end",
						"axes": {
							"layout": "rows"
						}
					},
					{
						"id": "cards",
						"label": "Cards in three columns",
						"axes": {
							"layout": "cards"
						}
					}
				],
				"defaultVariant": "rows",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title"
						],
						"list": "items"
					},
					{
						"place": "items.time",
						"kind": "text",
						"fields": [
							"/items/*/time"
						],
						"list": "items"
					},
					{
						"place": "items.minimum",
						"kind": "text",
						"fields": [
							"/items/*/minimum"
						],
						"list": "items"
					},
					{
						"place": "items.price",
						"kind": "text",
						"fields": [
							"/items/*/price"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/delivery@1.schema.json",
				"title": "DeliveryContent",
				"description": "Delivery zones content: the heading, a description and the zones, each with the area, the delivery time, the price and the minimum order as they are shown. One object is valid in every delivery layout (rows, cards).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the zones, nearest first",
						"type": "array",
						"minItems": 1,
						"maxItems": 6,
						"items": {
							"title": "DeliveryZone",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"price"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"title": {
									"description": "the area of the zone",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"time": {
									"description": "the delivery time as it is shown; empty: none",
									"type": "string",
									"maxLength": 40
								},
								"price": {
									"description": "the delivery price as it is shown (free, 290 ₽)",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"minimum": {
									"description": "the minimum order as it is shown; empty: none",
									"type": "string",
									"maxLength": 60
								}
							}
						}
					}
				}
			}
		},
		{
			"item": "digital-simple",
			"title": "Digital Simple",
			"description": "The heading, one paragraph and the digital goods (the format as a pill, the name as a link, a line, the price): on cards in three columns, or rows with the price at the end.",
			"category": "product",
			"prototype": "digital-simple.svelte",
			"contract": {
				"item": "digital-simple",
				"version": 1,
				"block": "block.digitalsimple",
				"organism": "DigitalSimple",
				"line": "simple",
				"model": "digital@1",
				"modelSchema": "https://registry.buildy.tw/models/digital@1.schema.json",
				"axes": {
					"layout": [
						"cards",
						"rows"
					]
				},
				"defaults": {
					"layout": "cards"
				},
				"variants": [
					{
						"id": "cards3",
						"label": "Three cards",
						"axes": {
							"layout": "cards"
						}
					},
					{
						"id": "rows",
						"label": "Rows, the price at the end",
						"axes": {
							"layout": "rows"
						},
						"settings": {
							"align": "start"
						}
					}
				],
				"defaultVariant": "cards3",
				"settings": {
					"level": {
						"type": "1 | 2 | 3",
						"default": 2
					},
					"padding": {
						"type": "\"compact\" | \"standard\" | \"spacious\"",
						"default": "standard"
					},
					"align": {
						"type": "\"start\" | \"center\" | \"end\"",
						"default": "center"
					},
					"landmarkLabel": {
						"type": "string"
					}
				},
				"modes": [
					"wireframe"
				],
				"defaultMode": "wireframe",
				"places": [
					{
						"place": "title",
						"kind": "heading",
						"fields": [
							"/title"
						]
					},
					{
						"place": "description",
						"kind": "text",
						"fields": [
							"/description"
						]
					},
					{
						"place": "items.format",
						"kind": "badge",
						"fields": [
							"/items/*/format"
						],
						"list": "items"
					},
					{
						"place": "items.title",
						"kind": "heading",
						"fields": [
							"/items/*/title",
							"/items/*/href"
						],
						"list": "items"
					},
					{
						"place": "items.description",
						"kind": "text",
						"fields": [
							"/items/*/description"
						],
						"list": "items"
					},
					{
						"place": "items.price",
						"kind": "text",
						"fields": [
							"/items/*/price"
						],
						"list": "items"
					}
				],
				"wireframe": {
					"items": 3
				}
			},
			"model": {
				"$schema": "https://json-schema.org/draft/2020-12/schema",
				"$id": "https://registry.buildy.tw/models/digital@1.schema.json",
				"title": "DigitalContent",
				"description": "Digital goods content: the heading, a description and an ordered list of digital goods, each with the format, the name, a line, the price as it is shown and an optional address. One object is valid in every layout (cards, rows).",
				"type": "object",
				"additionalProperties": false,
				"required": [
					"title",
					"items"
				],
				"properties": {
					"title": {
						"description": "the heading of the section",
						"type": "string",
						"maxLength": 120,
						"minLength": 1,
						"pattern": "\\S"
					},
					"description": {
						"description": "one paragraph under the heading; empty: none",
						"type": "string",
						"maxLength": 400
					},
					"items": {
						"description": "the goods, in the order they are shown",
						"type": "array",
						"minItems": 1,
						"maxItems": 9,
						"items": {
							"title": "DigitalGood",
							"type": "object",
							"additionalProperties": false,
							"required": [
								"id",
								"title",
								"price"
							],
							"properties": {
								"id": {
									"description": "stable key of the entry (the Codex entry id)",
									"type": "string",
									"pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
								},
								"format": {
									"description": "the format as a short pill (PDF, Figma, video course); empty: none",
									"type": "string",
									"maxLength": 40
								},
								"title": {
									"description": "the name of the good",
									"type": "string",
									"maxLength": 80,
									"minLength": 1,
									"pattern": "\\S"
								},
								"description": {
									"description": "one line about the good; empty: none",
									"type": "string",
									"maxLength": 200
								},
								"price": {
									"description": "the price as it is shown (990 ₽, free)",
									"type": "string",
									"maxLength": 40,
									"minLength": 1,
									"pattern": "\\S"
								},
								"href": {
									"description": "the address of the good page; empty: no link",
									"type": "string",
									"maxLength": 2048,
									"pattern": "^(?:(?:https?|mailto|tel):|(?![A-Za-z][A-Za-z0-9+.-]*:))"
								}
							}
						}
					}
				}
			}
		}
	]
};
});

__def("packages/builder-core/src/catalog/blocks.ts", function (exports) {
const raw = __req("packages/builder-core/src/catalog/blocks.json").default;
type BlocksFile = { format: "buildy-catalog-blocks"; version: number; registry: string; digest: string; blocks: CatalogBlock[] };

/** The generated file, read as its declared shape (scripts/registry-snapshot.mjs writes it from the pinned contracts). */
const data: unknown = raw;
const FILE = data as BlocksFile;

/** Every block of the catalog, in catalog order. */
function catalogBlocks(): CatalogBlock[] {
	return FILE.blocks;
}

/** One block by registry item, or null. */
function catalogBlock(item: string): CatalogBlock | null {
	return FILE.blocks.find((block) => block.item === item) ?? null;
}

/** The setting values a variant renders with: the contract defaults, then the variant's own settings (block-contract/v1). */
function variantSettings(item: string, variant: string): Record<string, string | number | boolean> {
	const contract = catalogBlock(item)?.contract;
	if (!contract) return {};
	const out: Record<string, string | number | boolean> = {};
	for (const [key, setting] of Object.entries(contract.settings ?? {})) if (setting.default !== undefined) out[key] = setting.default;
	return { ...out, ...(contract.variants.find((v) => v.id === variant)?.settings ?? {}) };
}

/** The layout axes of a block (block-contract/v1 `axes`: `media`, `cols`, `surface`): the variant sets them, never the content. */
function layoutAxes(item: string): string[] {
	return Object.keys(catalogBlock(item)?.contract.axes ?? {});
}

/** The axis values of a variant (`cards3` -> cols "3", surface "cards"), the contract defaults under them; null for an unknown variant. */
function variantAxisValues(item: string, variant: string): Record<string, string> | null {
	const contract = catalogBlock(item)?.contract;
	const found = contract?.variants.find((v) => v.id === variant);
	if (!contract || !found) return null;
	const out: Record<string, string> = {};
	for (const axis of Object.keys(contract.axes ?? {})) {
		const value = found.axes[axis] ?? contract.defaults?.[axis];
		if (value !== undefined) out[axis] = String(value);
	}
	return out;
}

/** The column axis of a block: the one contract axis whose values are all whole numbers (team-simple `cols`), else null.
 *  Read from the contract data, never from a block id (the rule of the generated wireframe: codegen-x prototypes `countAxis`). */
function columnAxis(item: string): string | null {
	const counts = Object.entries(catalogBlock(item)?.contract.axes ?? {}).filter(
		([, values]) => Array.isArray(values) && values.length > 0 && values.every((v) => /^[1-9][0-9]?$/.test(String(v))),
	);
	return counts.length === 1 ? counts[0]![0] : null;
}

/** The columns a variant lays its list out in (`cols4` -> 4, `cards3` -> 3), or null when the block has no column axis. */
function variantColumns(item: string, variant: string): number | null {
	const axis = columnAxis(item);
	const value = axis ? variantAxisValues(item, variant)?.[axis] : undefined;
	return value ? Number(value) : null;
}

/** The setting a variant renders with when the author set none (`align` of mediaTop is "center"), or undefined. */
function variantSettingDefault(item: string, variant: string, name: string): string | number | boolean | undefined {
	return variantSettings(item, variant)[name];
}

/** The settings any variant of a block sets on its own (hero-simple: `align` of mediaTop). */
function variantSettingNames(item: string): string[] {
	const names = new Set<string>();
	for (const v of catalogBlock(item)?.contract.variants ?? []) for (const key of Object.keys(v.settings ?? {})) names.add(key);
	return [...names];
}

/** Props of a variant's prototype (wireframe): its settings and its axes (block-contract/v1), as the generated prototype takes them. */
function prototypeProps(item: string, variant: string): Record<string, string | number | boolean> {
	const found = catalogBlock(item)?.contract.variants.find((v) => v.id === variant);
	return found ? { ...variantSettings(item, variant), ...found.axes } : {};
}

function catalogSearch(query: CatalogQuery = {}): CatalogResult {
	const words = (query.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
	const all: CatalogCard[] = FILE.blocks.flatMap((block) =>
		block.contract.variants.map((variant) => ({
			id: `${block.item}/${variant.id}`,
			item: block.item,
			variant: variant.id,
			title: block.title,
			label: variant.label,
			category: block.category,
			isDefault: variant.id === block.contract.defaultVariant
		}))
	);
	const text = (card: CatalogCard) => `${card.item} ${card.title} ${card.variant} ${card.label} ${card.category}`.toLowerCase();
	const matched = all.filter((card) => words.every((word) => text(card).includes(word)));
	const counts = new Map<string, number>();
	for (const card of matched) counts.set(card.category, (counts.get(card.category) ?? 0) + 1);
	const items = query.category ? matched.filter((card) => card.category === query.category) : matched;
	return { total: items.length, items, categories: [...counts].map(([value, count]) => ({ value, count })) };
}

/** Identity of the pinned catalog (sha256 of the registry files, contracts, models and prototypes): traces and the contract fingerprint. */
function catalogDigest(): string {
	return FILE.digest;
}

exports["catalogBlocks"] = catalogBlocks;
exports["catalogBlock"] = catalogBlock;
exports["layoutAxes"] = layoutAxes;
exports["variantAxisValues"] = variantAxisValues;
exports["columnAxis"] = columnAxis;
exports["variantColumns"] = variantColumns;
exports["variantSettingDefault"] = variantSettingDefault;
exports["variantSettingNames"] = variantSettingNames;
exports["prototypeProps"] = prototypeProps;
exports["catalogSearch"] = catalogSearch;
exports["catalogDigest"] = catalogDigest;

});

__def("packages/builder-core/src/catalog/validator.ts", function (exports) {

let PROPS_VALIDATOR: PropsValidator | null = null;

/** Install the props validator (the browser loads props-gate.ts lazily before its first write; the runtime at start). */
function setPropsValidator(validator: PropsValidator | null): void {
	PROPS_VALIDATOR = validator;
}

function propsValidatorInstalled(): boolean {
	return PROPS_VALIDATOR !== null;
}

/** Issues of the props of one registry item; null while no validator is installed (the gate is fail-closed). */
function validateItemProps(item: string, props: Record<string, unknown>): PropsIssue[] | null {
	return PROPS_VALIDATOR ? PROPS_VALIDATOR({ item, props } as RegistryRender) : null;
}

exports["setPropsValidator"] = setPropsValidator;
exports["propsValidatorInstalled"] = propsValidatorInstalled;
exports["validateItemProps"] = validateItemProps;

});

__def("packages/builder-core/src/catalog/organism.ts", function (exports) {
const raw = __req("packages/builder-core/src/catalog/sources.json").default;
const sources = raw as unknown as CatalogSources;

/** What the props gate checks: a registry item and its render props. */
type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A dictionary / data ref (`{"$": ...}`) or a data op (`{op, args}`): the Svelte block cannot resolve either. */
function isRef(value: Json): boolean {
	return isObject(value) && ("$" in value || ("op" in value && "args" in value));
}

/** Published variant props without dictionary / collection refs and data ops (the schema fills what they leave). */
function withoutRefs(value: Json): Json {
	if (Array.isArray(value)) return value.map(withoutRefs);
	if (!isObject(value)) return value;
	const out: Record<string, Json> = {};
	for (const [key, inner] of Object.entries(value)) {
		if (isRef(inner)) continue;
		out[key] = withoutRefs(inner);
	}
	return out;
}

/** The registry item and variant of a catalog block (`block.features` + `grid`), or null when the registry has none. */
function registryItemFor(catalogBlock: string | undefined | null, variant?: string | null): { item: string; variant: string } | null {
	if (!catalogBlock) return null;
	if (variant) {
		const hit = sources.assets[`${catalogBlock}/${variant}`];
		if (hit) return hit;
	}
	return sources.specs[catalogBlock] ?? null;
}

/** The published props of a variant without dictionary refs: what the variant itself sets (axes, sample literals). */
function variantPreset(item: string, variant: string): Record<string, unknown> {
	const value = sources.blocks[item]?.variants[variant];
	return isObject(value) ? (withoutRefs(value) as Record<string, unknown>) : {};
}

/** Named variants of a registry item with their published props (the presets the Variant select offers). */
function variantPresets(item: string): Record<string, Record<string, unknown>> {
	const out: Record<string, Record<string, unknown>> = {};
	for (const name of Object.keys(sources.blocks[item]?.variants ?? {})) out[name] = variantPreset(item, name);
	return out;
}

/** npm packages the registry tree imports (clsx, tailwind-merge; svelte is the framework). */
const registryNpmDependencies: string[] = sources.npmDependencies;

/** Items `npx ui8kit init` installs before any `add`. */
const registryInitItems: string[] = sources.initItems;

/**
 * Registry file paths (relative to the CLI install root, e.g. `src/blocks/feature-grid.svelte`) of `init` plus
 * `add <items>`: the items and their registryDependencies, transitively. Unknown names throw.
 */
function registryClosure(items: string[]): string[] {
	const seen = new Set<string>();
	const files = new Set<string>();
	const queue = [...sources.initItems, ...items];
	while (queue.length) {
		const name = queue.shift()!;
		if (seen.has(name)) continue;
		const item = sources.items[name];
		if (!item) throw new Error(`registry item ${name} is not in the pinned snapshot`);
		seen.add(name);
		for (const file of item.files) files.add(file);
		queue.push(...item.registryDependencies);
	}
	return [...files].sort();
}

function registrySkins(): RegistrySkin[] {
	return Object.entries(sources.themes?.skins ?? {})
		.map(([id, skin]) => ({ id, ...skin }))
		.sort((a, b) => a.title.localeCompare(b.title));
}

/** The skin with this id, or null when the pinned registry has none (unknown ids fall back to the default theme). */
function registrySkin(id: string | null | undefined): RegistrySkin | null {
	if (!id) return null;
	const skin = sources.themes?.skins?.[id];
	return skin ? { id, ...skin } : null;
}

/** CSS files of theme-base (what every skin depends on), as `npx ui8kit add theme-<id>` writes them. */
function registrySkinBaseCss(): string[] {
	return (sources.themes?.base?.files ?? []).filter((file) => file.endsWith(".css"));
}

/** Registry item that installs a skin. */
const skinItem = (id: string): string => `theme-${id}`;

/** Files `npx ui8kit add <name>` writes for one item (pinned snapshot, paths under the install root). */
function registryItemFiles(name: string): string[] {
	const item = sources.items[name];
	if (!item) throw new Error(`registry item ${name} is not in the pinned snapshot`);
	return [...item.files];
}

/** Item names of `init` plus `add <items>` with registryDependencies, transitively (lock entries of the CLI). */
function registryItemClosure(items: string[]): string[] {
	const seen = new Set<string>();
	const queue = [...sources.initItems, ...items];
	while (queue.length) {
		const name = queue.shift()!;
		if (seen.has(name)) continue;
		const item = sources.items[name];
		if (!item) throw new Error(`registry item ${name} is not in the pinned snapshot`);
		seen.add(name);
		queue.push(...item.registryDependencies);
	}
	return [...seen].sort();
}

exports["registryItemFor"] = registryItemFor;
exports["variantPreset"] = variantPreset;
exports["variantPresets"] = variantPresets;
exports["registryNpmDependencies"] = registryNpmDependencies;
exports["registryInitItems"] = registryInitItems;
exports["registryClosure"] = registryClosure;
exports["registrySkins"] = registrySkins;
exports["registrySkin"] = registrySkin;
exports["registrySkinBaseCss"] = registrySkinBaseCss;
exports["skinItem"] = skinItem;
exports["registryItemFiles"] = registryItemFiles;
exports["registryItemClosure"] = registryItemClosure;

});

__def("packages/builder-core/src/catalog/money.json", function (exports) {
  exports.default = {
	"format": "buildy-money-names",
	"unit": "minor",
	"names": []
};
});

__def("packages/builder-core/src/catalog/money.ts", function (exports) {
const raw = __req("packages/builder-core/src/catalog/money.json").default;
const NAMES = new Set<string>(raw.names);

/** A number prop with this name beside a `currency` prop of its object is money in minor units. */
const isMoneyName = (name: string): boolean => NAMES.has(name);

/** Digits of the minor unit (ISO 4217), as the registry's format.ts has them: cents for most, none for JPY and KRW. */
function minorDigits(currency: string): number {
	return currency === "JPY" || currency === "KRW" ? 0 : 2;
}

/** What a new money prop starts from in a sample: 10 whole units (1000 minor units; "$10"). */
const SAMPLE_MINOR = 1000;

/** Minor units -> the number an author reads (65000 RUB -> 650, 1250 USD -> 12.5). */
function toMajor(minor: number, currency: string): number {
	const digits = minorDigits(currency);
	return Math.round(minor) / 10 ** digits;
}

/** The number an author typed -> minor units (650 RUB -> 65000, 12.5 USD -> 1250), rounded to whole minor units. */
function toMinor(major: number, currency: string): number {
	return Math.round(major * 10 ** minorDigits(currency));
}

exports["isMoneyName"] = isMoneyName;
exports["minorDigits"] = minorDigits;
exports["SAMPLE_MINOR"] = SAMPLE_MINOR;
exports["toMajor"] = toMajor;
exports["toMinor"] = toMinor;

});

__def("packages/builder-core/src/catalog/pictures.json", function (exports) {
  exports.default = {
	"format": "buildy-record-pictures",
	"version": 1,
	"blocks": {
		"gallery-hero": [
			{
				"list": "photos",
				"field": "image",
				"alt": "imageAlt",
				"ratio": {
					"cases": [
						{
							"prop": "media",
							"eq": "bottom",
							"value": "4/3"
						},
						{
							"prop": "count",
							"eq": "4",
							"value": "4/3"
						}
					],
					"else": "1/1"
				},
				"size": {
					"value": "large"
				}
			}
		],
		"features-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"value": "small"
				}
			}
		],
		"testimonials-simple": [
			{
				"list": "quotes",
				"field": "avatar",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"value": "small"
				}
			}
		],
		"logos-simple": [
			{
				"list": "logos",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "16/9"
				},
				"size": {
					"value": "logo"
				}
			}
		],
		"team-simple": [
			{
				"list": "members",
				"field": "avatar",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"cases": [
						{
							"prop": "layout",
							"eq": "aside",
							"value": "large"
						},
						{
							"prop": "layout",
							"eq": "byline",
							"value": "small"
						}
					],
					"else": "large"
				}
			}
		],
		"photos-simple": [
			{
				"list": "photos",
				"field": "image",
				"alt": "imageAlt",
				"ratio": {
					"cases": [
						{
							"prop": "cols",
							"eq": "2",
							"value": "4/3"
						}
					],
					"else": "1/1"
				},
				"size": {
					"value": "large"
				}
			}
		],
		"stories-simple": [
			{
				"list": "stories",
				"field": "image",
				"alt": "title",
				"ratio": {
					"cases": [
						{
							"prop": "layout",
							"eq": "compact",
							"value": "1/1"
						},
						{
							"prop": "cols",
							"eq": "2",
							"value": "16/9"
						}
					],
					"else": "4/3"
				},
				"size": {
					"cases": [
						{
							"prop": "layout",
							"eq": "compact",
							"value": "large"
						}
					],
					"else": "large"
				}
			}
		],
		"chapters-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"cases": [
						{
							"prop": "layout",
							"eq": "paired",
							"value": "16/9"
						}
					],
					"else": "4/3"
				},
				"size": {
					"cases": [
						{
							"prop": "layout",
							"eq": "paired",
							"value": "large"
						}
					],
					"else": "large"
				}
			}
		],
		"contacts-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"value": "small"
				}
			}
		],
		"products-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "4/3"
				},
				"size": {
					"cases": [
						{
							"prop": "layout",
							"eq": "rows",
							"value": "large"
						}
					],
					"else": "large"
				}
			}
		],
		"product-simple": [
			{
				"list": "photos",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"value": "large"
				}
			}
		],
		"collections-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"value": "large"
				}
			}
		],
		"store-policies": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"value": "small"
				}
			}
		],
		"product-reviews": [
			{
				"list": "items",
				"field": "avatar",
				"alt": "title",
				"ratio": {
					"value": "1/1"
				},
				"size": {
					"value": "small"
				}
			}
		],
		"menu-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "4/3"
				},
				"size": {
					"cases": [
						{
							"prop": "layout",
							"eq": "rows",
							"value": "large"
						}
					],
					"else": "large"
				}
			}
		],
		"rooms-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "4/3"
				},
				"size": {
					"value": "large"
				}
			}
		],
		"cases-simple": [
			{
				"list": "items",
				"field": "image",
				"alt": "title",
				"ratio": {
					"value": "16/9"
				},
				"size": {
					"value": "large"
				}
			}
		]
	}
};
});

__def("packages/builder-core/src/catalog/pictures.ts", function (exports) {
const raw = __req("packages/builder-core/src/catalog/pictures.json").default;
type Expr = { value: string } | { cases: Array<{ prop: string; eq: string; value: string }>; else: string };
type Entry = { list: string; field: string; alt: string; ratio: Expr; size: Expr };
const BLOCKS: Record<string, Entry[]> = raw.blocks;
const sizeOf = (value: string): PictureSize => (value === "small" || value === "logo" ? value : "large");

function valueOf(expr: Expr, props: Record<string, unknown>): string {
	if ("value" in expr) return expr.value;
	return expr.cases.find((c) => String(props[c.prop] ?? "") === c.eq)?.value ?? expr.else;
}

/** The record pictures of an item for the given block props (layout props pick the case), in block order. */
function recordPictures(item: string, props: Record<string, unknown> = {}): RecordPicture[] {
	return (BLOCKS[item] ?? []).map((e) => ({ list: e.list, field: e.field, alt: e.alt, ratio: valueOf(e.ratio, props), size: sizeOf(valueOf(e.size, props)) }));
}

exports["recordPictures"] = recordPictures;

});

__def("packages/builder-core/src/catalog/image-url.ts", function (exports) {

const IMAGE_NAMES: ReadonlySet<string> = new Set(["image", "imageDark", "avatar"]);

/** A prop of this name, of kind text, is a picture address. */
const isImageName = (name: string): boolean => IMAGE_NAMES.has(name);

const MAX_LENGTH = 2048;

/** A relative path names a picture file: its last segment ends in a picture extension (a bare word like `phone` or `map-pin` is not one). */
const PICTURE_FILE = /\.(?:jpe?g|png|webp|gif|avif|svg)(?:[?#].*)?$/i;

/**
 * An https URL with a host, or a relative path to a picture file (`/photos/a.jpg`, `./a.jpg`, `../a.jpg`, `photos/a.jpg`).
 * Empty is "no picture" and is fine. A word with no picture extension (`phone`, `clock`: an icon name in a picture field) is not an address.
 */
function isImageUrl(value: string): boolean {
	if (value === "") return true;
	if (value.length > MAX_LENGTH || /[\s"'<>\\`]/.test(value) || [...value].some((ch) => ch.charCodeAt(0) < 32)) return false;
	if (value.startsWith("//")) return false;
	if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
		try {
			const url = new URL(value);
			return url.protocol === "https:" && url.hostname.includes(".");
		} catch {
			return false;
		}
	}
	return PICTURE_FILE.test(value);
}

exports["isImageName"] = isImageName;
exports["isImageUrl"] = isImageUrl;

});

__def("packages/builder-core/src/catalog/props.json", function (exports) {
  exports.default = {"format":"buildy-props-compact","version":1,"registry":"https://registry.buildy.tw","propsVersion":"0","digest":"sha256:6b23550c053ab0735abb93c87808380962555f589ac9dc2cf71a5e11e11e3a2f","defs":{"Amenity":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"data":{"anyOf":[{"$ref":"#/$defs/dataRef"},{"$ref":"#/$defs/dataOp"}]},"dataOp":{"description":"an operation over the data (packages/compose-gen/screens/src/ir.ts OPS)","type":"object","properties":{"op":{"enum":["add","and","at","cn","coalesce","cond","count","css","div","eq","firstOf","fitCols","ge","gt","has","le","len","list","lt","match","max","maxBy","min","money","mul","nbsp","ne","not","nth","num","or","pageWindow","pick","preset","range","recipe","round","str","sub","sumBy","tpl","undef","uniq","where","words"]},"args":{"type":"array"}},"required":["op","args"],"additionalProperties":false},"dataRef":{"description":"the data the block reads under this name (data[].as of the block spec)","type":"object","properties":{"$":{"type":"string","not":{"pattern":"^ui\\."}}},"required":["$"],"additionalProperties":false},"text":{"anyOf":[{"type":"string"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]},"uiRef":{"description":"a text of the ui dictionary, or a group of its texts for a record of labels","type":"object","properties":{"$":{"type":"string","pattern":"^ui\\."}},"required":["$"],"additionalProperties":false},"ArticleSection":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title","description"],"additionalProperties":false},"CaseStudy":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"client":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"result":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"ChapterItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","label","title"],"additionalProperties":false},"ChoiceItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","label","href"],"additionalProperties":false},"CollectionItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","title","href"],"additionalProperties":false},"CompareLine":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"first":{"$ref":"#/$defs/text"},"second":{"$ref":"#/$defs/text"}},"required":["id","title","first","second"],"additionalProperties":false},"ContactItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"actionLabel":{"$ref":"#/$defs/text"},"actionHref":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"CourseModule":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"meta":{"$ref":"#/$defs/text"}},"required":["id","label","title"],"additionalProperties":false},"DeliveryZone":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"time":{"$ref":"#/$defs/text"},"price":{"$ref":"#/$defs/text"},"minimum":{"$ref":"#/$defs/text"}},"required":["id","title","price"],"additionalProperties":false},"DigitalGood":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"format":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"price":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","title","price"],"additionalProperties":false},"SimpleQuestion":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title","description"],"additionalProperties":false},"ShowcaseItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"SimpleFeature":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"FooterLink":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","label","href"],"additionalProperties":false},"GalleryPhoto":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"imageAlt":{"$ref":"#/$defs/text"}},"required":["id","imageAlt"],"additionalProperties":false},"Guarantee":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"text":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"HeaderLink":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","label","href"],"additionalProperties":false},"OpeningHour":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"day":{"$ref":"#/$defs/text"},"time":{"$ref":"#/$defs/text"}},"required":["id","day","time"],"additionalProperties":false},"LocationItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"SimpleLogo":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"MenuDish":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"imageSrcset":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"weight":{"$ref":"#/$defs/text"},"price":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"badge":{"$ref":"#/$defs/text"}},"required":["id","title","price"],"additionalProperties":false},"OfferItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"actionLabel":{"$ref":"#/$defs/text"},"actionHref":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"SimplePhoto":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"imageAlt":{"$ref":"#/$defs/text"}},"required":["id","imageAlt"],"additionalProperties":false},"PricingPlan":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"price":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"badge":{"$ref":"#/$defs/text"},"actionLabel":{"$ref":"#/$defs/text"},"actionHref":{"$ref":"#/$defs/text"}},"required":["id","title","price"],"additionalProperties":false},"ReviewItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"rating":{"$ref":"#/$defs/text"},"quote":{"$ref":"#/$defs/text"},"avatar":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","rating","quote","title"],"additionalProperties":false},"ProductPhoto":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"}},"required":["id"],"additionalProperties":false},"ProductItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"imageSrcset":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"price":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","title","price"],"additionalProperties":false},"ProfileLink":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","label","href"],"additionalProperties":false},"Room":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"imageSrcset":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"guests":{"$ref":"#/$defs/text"},"price":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","title","price"],"additionalProperties":false},"Service":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"price":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"SpecItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title","description"],"additionalProperties":false},"SimpleStat":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"value":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","value","title"],"additionalProperties":false},"SimpleStep":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","label","title"],"additionalProperties":false},"PolicyItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"SimpleStory":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"SimpleMember":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"avatar":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"SimpleQuote":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"quote":{"$ref":"#/$defs/text"},"avatar":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"}},"required":["id","quote","title"],"additionalProperties":false},"TimelineStep":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"date":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"text":{"$ref":"#/$defs/text"}},"required":["id","date","title"],"additionalProperties":false},"TopicItem":{"type":"object","properties":{"id":{"$ref":"#/$defs/text"},"label":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"$ref":"#/$defs/text"},"href":{"$ref":"#/$defs/text"}},"required":["id","label","title"],"additionalProperties":false}},"items":{"amenities-simple":{"organism":"AmenitiesSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"AmenitiesSimpleProps","description":"The simple amenities (model amenities@1): the heading, a description and the amenities as a list of short names. Text only. Axes: layout (grid: muted rows in columns; pills: outlined pills in a wrapping row, placed by the align setting), cols (3, 2 columns of the grid from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the amenities, in the order they are shown (2 to 16)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/Amenity"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["grid","pills"],"default":"grid"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["Amenity","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["amenity"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}]}}},"article-lead":{"organism":"ArticleLead","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ArticleLeadProps","description":"The article lead (model article-lead@1): the heading, the lead paragraph, the byline (the portrait, the author, the date) and the cover picture. Axes: media (top: the cover over the copy, wide, start: the cover before the copy from md up, end: after it).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"image":{"description":"address of the picture; none: the placeholder","$ref":"#/$defs/text","default":""},"imageAlt":{"description":"alt text of the picture","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text","default":""},"author":{"description":"the name of the author","$ref":"#/$defs/text"},"avatar":{"description":"address of the portrait of the author; none: the placeholder","$ref":"#/$defs/text","default":""},"date":{"description":"the date as it is shown","$ref":"#/$defs/text"},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["top","start","end"],"default":"top"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","imageAlt","author","date"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/author":[{"k":"text"}],"/date":[{"k":"text"}]}}},"article-simple":{"organism":"ArticleSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ArticleSimpleProps","description":"The simple article (model article@1): the heading, a description and the sections of the text as a list, each a subheading and its paragraph. Axes: layout (column: one reading column, max-w-3xl, columns: two columns under the head from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"sections":{"description":"the sections, in the order they are read (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ArticleSection"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"layout":{"type":"string","enum":["column","columns"],"default":"column"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","sections"],"additionalProperties":false},"defs":["ArticleSection","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/sections":["article-section"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/sections/[]/title":[{"k":"text"}],"/sections/[]/description":[{"k":"text"}]}}},"cases-simple":{"organism":"CasesSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"CasesSimpleProps","description":"The simple case studies (model cases@1): the heading, a description and the cases as a list, each with a picture, the client (the primary token), the title (a link when the case has an address) and the result in one line. Axes: layout (cards: a card surface per case, the picture on top; rows: the picture at the start, a third of the row from md up), cols (3, 2 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the cases, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/CaseStudy"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["CaseStudy","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["case"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/client":[{"k":"text"}],"/items/[]/href":[{"k":"attr","a":"href"}],"/items/[]/title":[{"k":"text"}],"/items/[]/result":[{"k":"text"}]}}},"chapters-simple":{"organism":"ChaptersSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ChaptersSimpleProps","description":"The simple chapters (model chapters@1): the heading, a description and the chapters as a list, each with a picture, a short label (a badge), the title and a paragraph. Axes: layout (rows: the picture at the start of each row, a third of it, paired: two columns, the picture under the copy).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the chapters, in the order they are read (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ChapterItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["rows","paired"],"default":"rows"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["ChapterItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["chapter"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/label":[{"s":"badge","k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"choice-links":{"organism":"ChoiceLinks","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ChoiceLinksProps","description":"The choice links (model choices@1): the heading, a description and the options as a list of outline links (sizes, versions, plans). Axes: layout (row: a wrapping row placed by the align setting, grid: two columns, four from md up, each link the full width of its cell).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the options, in the order they are shown (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ChoiceItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["row","grid"],"default":"row"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["ChoiceItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["choice"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/href":[{"s":"button","k":"attr","a":"href"}],"/items/[]/label":[{"s":"button","k":"text"}]}}},"collections-simple":{"organism":"CollectionsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"CollectionsSimpleProps","description":"The simple collections (model collections@1): the heading, a description and the collections as a list, each a picture and the name inside one link. Axes: cols (2, 3, 4 columns from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the collections, in the order they are shown (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/CollectionItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"cols":{"type":"string","enum":["4","3","2"],"default":"4"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["CollectionItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["collection"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/href":[{"k":"attr","a":"href"}],"/items/[]/title":[{"k":"text"}]}}},"compare-simple":{"organism":"CompareSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"CompareSimpleProps","description":"The simple compare (model compare@1): the heading, a description, a header row with the names of the two options, then the rows as a list, each a feature with the value of each option, in three columns on a bordered surface. Axes: width (wide: the full container, narrow: max-w-3xl).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"firstLabel":{"description":"the name of the first option","$ref":"#/$defs/text"},"secondLabel":{"description":"the name of the second option","$ref":"#/$defs/text"},"rows":{"description":"the rows, in the order they are shown (1 to 12)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/CompareLine"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"width":{"type":"string","enum":["wide","narrow"],"default":"wide"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","firstLabel","secondLabel","rows"],"additionalProperties":false},"defs":["CompareLine","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/rows":["compare-row"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/firstLabel":[{"k":"text"}],"/secondLabel":[{"k":"text"}],"/rows/[]/title":[{"k":"text"}],"/rows/[]/first":[{"k":"text"}],"/rows/[]/second":[{"k":"text"}]}}},"contacts-simple":{"organism":"ContactsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ContactsSimpleProps","description":"The simple contacts (model contacts@1): the heading, a description and the contacts as a list on a card surface, each with an icon picture (a disc), the name, a line and an action. Axes: layout (cards: columns, the copy centred by the align setting, rows: the icon beside the copy), cols (2, 3 columns).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the contacts, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ContactItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["ContactItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["contact"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}],"/items/[]/actionHref":[{"s":"button","k":"attr","a":"href"}],"/items/[]/actionLabel":[{"s":"button","k":"text"}]}}},"course-outline":{"organism":"CourseOutline","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"CourseOutlineProps","description":"The course outline (model curriculum@1): the heading, a description and the modules as an ordered list, each with a short label (a badge), the title, a line and a meta line (the length). Axes: layout (rows: one under the other in a narrow column, cards: two columns on a card surface from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"modules":{"description":"the modules, in the order they are taken (1 to 12)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/CourseModule"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"layout":{"type":"string","enum":["rows","cards"],"default":"rows"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","modules"],"additionalProperties":false},"defs":["CourseModule","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/modules":["module"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/modules/[]/label":[{"s":"badge","k":"text"}],"/modules/[]/title":[{"k":"text"}],"/modules/[]/description":[{"k":"text"}],"/modules/[]/meta":[{"k":"text"}]}}},"cta-simple":{"organism":"CtaSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"CtaSimpleProps","description":"The simple call to action (model cta@1): one band with an optional badge, the heading, a description and up to two links styled as buttons (the first primary, the second secondary; each drawn when its label and its address are both set). Text only (a picture beside the copy is the split or the hero). Axes: layout (stack: the copy and the actions in one column, placed by the align setting; between: the copy at the start, the actions at the end from md up), surface (muted: a muted band, outline: a bordered card).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"badge":{"description":"a short pill above the heading; empty: no badge","$ref":"#/$defs/text","default":""},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"secondaryActionLabel":{"description":"the label of the second action (the secondary button after the first); drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"secondaryActionHref":{"description":"the address of the second action","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["stack","between"],"default":"stack"},"surface":{"type":"string","enum":["muted","outline"],"default":"muted"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/badge":[{"s":"badge","k":"text"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}],"/secondaryActionHref":[{"s":"button","k":"attr","a":"href"}],"/secondaryActionLabel":[{"s":"button","k":"text"}]}}},"delivery-simple":{"organism":"DeliverySimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"DeliverySimpleProps","description":"The simple delivery zones (model delivery@1): the heading, a description and the zones as a list, each with the area, the delivery time, the price and the minimum order as they are shown. Text only. Axes: layout (rows: one card row per zone, the price at the end from md up; cards: a card per zone in three columns).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the zones, nearest first (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/DeliveryZone"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["rows","cards"],"default":"rows"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["DeliveryZone","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["delivery-zone"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/time":[{"k":"text"}],"/items/[]/minimum":[{"k":"text"}],"/items/[]/price":[{"k":"text"}]}}},"digital-simple":{"organism":"DigitalSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"DigitalSimpleProps","description":"The simple digital goods (model digital@1): the heading, a description and the goods as a list, each with the format as a pill (PDF, Figma, video course), the name (a link when the good has an address), a line and the price as it is shown. Text only. Axes: layout (cards: a card surface per good in three columns; rows: one row per good, the price at the end from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the goods, in the order they are shown (1 to 9)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/DigitalGood"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["DigitalGood","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["digital-good"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/format":[{"s":"badge","k":"text"}],"/items/[]/href":[{"k":"attr","a":"href"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}],"/items/[]/price":[{"k":"text"}]}}},"error-simple":{"organism":"ErrorSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ErrorSimpleProps","description":"The simple error (model error@1): the code (large, the primary token), the heading, a description and one action back. Text only. The align setting places it: centred or at the start.","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"code":{"description":"the code as it is shown (404)","$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","code","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/code":[{"k":"text"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}]}}},"event-intro":{"organism":"EventIntro","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"EventIntroProps","description":"The event intro (model event@1): an optional badge, the name of the event as a large heading, a description, the date and the place as a list of two facts, and one action. Text only. The align setting places it: centred or at the start.","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"badge":{"description":"a short pill above the heading; empty: no badge","$ref":"#/$defs/text","default":""},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"date":{"description":"the date and the time as they are shown","$ref":"#/$defs/text"},"place":{"description":"the place or the city, or online","$ref":"#/$defs/text"},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","date","place"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/badge":[{"s":"badge","k":"text"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/date":[{"in":"event-date","k":"text"}],"/place":[{"in":"event-place","k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}]}}},"faq-simple":{"organism":"FaqSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"FaqSimpleProps","description":"The simple FAQ (model faq@1): the heading, a description and the questions as a list, each with its answer. Axes: columns (one, two from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the questions, in the order they are shown (1 to 12)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleQuestion"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"columns":{"type":"string","enum":["one","two"],"default":"two"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["SimpleQuestion","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["question"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"feature-showcase-simple":{"organism":"FeatureShowcaseSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"FeatureShowcaseSimpleProps","description":"The simple feature showcase (model feature-showcase@1): the heading, a description, one picture and the key points as a list (a title, a line). Axes: media (end: the picture after the copy, start: before it from md up, top: the head over a wide picture, the points in three columns under it).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"image":{"description":"address of the picture; none: the placeholder","$ref":"#/$defs/text","default":""},"imageAlt":{"description":"alt text of the picture","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text","default":""},"items":{"description":"the key points, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ShowcaseItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["end","start","top"],"default":"end"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","imageAlt","items"],"additionalProperties":false},"defs":["ShowcaseItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["point"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"features-simple":{"organism":"FeaturesSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"FeaturesSimpleProps","description":"The simple features (model features@1): the heading, a description and the features as a list, each with an icon picture (a disc), a title and a line. Axes: layout (stack: the head over the list, aside: the head beside it from md up), cols (2, 3, 4 columns), marker (top: the icon over the copy, inline: beside it).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the features, in the order they are shown (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleFeature"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["stack","aside"],"default":"stack"},"cols":{"type":"string","enum":["2","3","4"],"default":"3"},"marker":{"type":"string","enum":["top","inline"],"default":"top"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["SimpleFeature","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["feature"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"figure-simple":{"organism":"FigureSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"FigureSimpleProps","description":"The simple figure (model figure@1): one large picture with its caption in a figure: the title (it names the section), a line and the credit. Axes: layout (wide: the caption centred under the picture, end: the caption beside it at the end from md up, start: at the start).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"image":{"description":"address of the picture; none: the placeholder","$ref":"#/$defs/text","default":""},"imageAlt":{"description":"alt text of the picture","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text","default":""},"title":{"description":"the title of the caption (names the section)","$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"credit":{"description":"the credit of the picture; empty: none","$ref":"#/$defs/text","default":""},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"layout":{"type":"string","enum":["wide","end","start"],"default":"wide"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","imageAlt","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/credit":[{"k":"text"}]}}},"footer-simple":{"organism":"FooterSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"FooterSimpleProps","description":"The simple footer (model footer@1): the brand, one line about the site, the links as a list in a nav and the copyright line. Axes: layout (row: the brand beside a row of links, grid: the brand beside the links in two or three columns, centered: everything centred).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"brand":{"description":"the name of the site","$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"links":{"description":"the links, in the order they are shown (1 to 12)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/FooterLink"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"copyright":{"description":"the copyright line","$ref":"#/$defs/text"},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"compact"},"layout":{"type":"string","enum":["row","grid","centered"],"default":"row"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","brand","links","copyright"],"additionalProperties":false},"defs":["FooterLink","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/links":["footer-link"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/brand":[{"k":"text"}],"/description":[{"k":"text"}],"/links/[]/href":[{"k":"attr","a":"href"}],"/links/[]/label":[{"k":"text"}],"/copyright":[{"k":"text"}]}}},"gallery-hero":{"organism":"GalleryHero","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"GalleryHeroProps","description":"The gallery hero (model gallery@1): the heading, a description, up to two links as the actions and three or four photos as a list. Axes: media (end: the photos after the copy, start: before it from md up, bottom: in a row under it), count (3: three square photos in a row, 4: a 2 x 2 grid, a row of four under the copy).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"secondaryActionLabel":{"description":"the label of the second action (the secondary button after the first); drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"secondaryActionHref":{"description":"the address of the second action","$ref":"#/$defs/text","default":""},"photos":{"description":"the photos, in the order they are shown (3 or 4)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/GalleryPhoto"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["end","start","bottom"],"default":"end"},"count":{"type":"string","enum":["3","4"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","photos"],"additionalProperties":false},"defs":["GalleryPhoto","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/photos":["photo"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}],"/secondaryActionHref":[{"s":"button","k":"attr","a":"href"}],"/secondaryActionLabel":[{"s":"button","k":"text"}]}}},"guarantees-simple":{"organism":"GuaranteesSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"GuaranteesSimpleProps","description":"The simple guarantees (model guarantees@1): the heading, a description and the promises as a list, each with a short title and a line. Text only. Axes: layout (strip: the promises side by side on one muted band; cards: a card surface per promise), cols (4, 3 columns from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the promises, in the order they are shown (2 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/Guarantee"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["strip","cards"],"default":"strip"},"cols":{"type":"string","enum":["4","3"],"default":"4"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["Guarantee","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["guarantee"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/text":[{"k":"text"}]}}},"header-simple":{"organism":"HeaderSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"HeaderSimpleProps","description":"The simple header (model header@1): the brand as the link home, the navigation links as a list in a nav and one action. No menu button: the links wrap under the brand on a narrow screen. Axes: layout (inline: the links in the middle, end: the links beside the action, centered: the brand over the links).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"brand":{"description":"the name of the site (the link home)","$ref":"#/$defs/text"},"brandHref":{"description":"the address of the home page","$ref":"#/$defs/text"},"links":{"description":"the navigation links, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/HeaderLink"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"layout":{"type":"string","enum":["inline","end","centered"],"default":"inline"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","brand","brandHref","links"],"additionalProperties":false},"defs":["HeaderLink","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/links":["nav-link"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/brandHref":[{"k":"attr","a":"href"}],"/brand":[{"k":"text"}],"/links/[]/href":[{"k":"attr","a":"href"}],"/links/[]/label":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}]}}},"hero-simple":{"organism":"HeroSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"HeroSimpleProps","description":"The simple hero (model hero@1): an optional badge, the heading, a description, up to two links as the actions (links styled as buttons, the first primary, the second secondary: each drawn only when its label and its address are both set) and one picture. Axes: media (end: the picture after the copy, start: before it, top: above it, wide, bottom: under it, wide), ratio (landscape: 4/3 beside the copy, portrait: narrowed and tall, 3 by 4, beside the copy from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"badge":{"description":"a short pill above the heading; empty: no badge","$ref":"#/$defs/text","default":""},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"image":{"description":"address of the picture (an https URL or a path); none: the placeholder","$ref":"#/$defs/text"},"imageAlt":{"description":"alt text of the picture; none: the title","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text"},"imageDark":{"description":"address of the picture in the dark theme; none: image","$ref":"#/$defs/text"},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"secondaryActionLabel":{"description":"the label of the second action (the secondary button after the first); drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"secondaryActionHref":{"description":"the address of the second action","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["end","start","top","bottom"],"default":"end"},"ratio":{"type":"string","enum":["landscape","portrait"],"default":"landscape"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/badge":[{"s":"badge","k":"text"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}],"/secondaryActionHref":[{"s":"button","k":"attr","a":"href"}],"/secondaryActionLabel":[{"s":"button","k":"text"}]}}},"hours-simple":{"organism":"HoursSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"HoursSimpleProps","description":"The simple opening hours (model hours@1): the heading, a description, the address, the phone as a link, the address as a link to the map when it has one, and the opening hours as a list (the day or the days and the time per row). Axes: layout (columns: the address and the links at the start, the hours at the end from md up; stack: one narrow column, placed by the align setting), surface (plain, card: the address and the hours each on a card).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"address":{"description":"the address as it is shown","$ref":"#/$defs/text"},"phone":{"description":"the phone number as it is shown","$ref":"#/$defs/text"},"phoneHref":{"description":"the address of the phone link (tel:)","$ref":"#/$defs/text"},"mapHref":{"description":"the address of the map; set: the address is a link to it","$ref":"#/$defs/text","default":""},"items":{"description":"the opening hours, a row per day or per days (1 to 7)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/OpeningHour"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["columns","stack"],"default":"columns"},"surface":{"type":"string","enum":["plain","card"],"default":"plain"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","address","phone","phoneHref","items"],"additionalProperties":false},"defs":["OpeningHour","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["opening-hour"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/mapHref":[{"k":"attr","a":"href"}],"/address":[{"k":"text"}],"/phoneHref":[{"k":"attr","a":"href"}],"/phone":[{"k":"text"}],"/items/[]/day":[{"k":"text"}],"/items/[]/time":[{"k":"text"}]}}},"intro-simple":{"organism":"IntroSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"IntroSimpleProps","description":"The simple intro (model intro@1): an optional badge, a large heading, a description and up to two links as the actions (the first primary, the second secondary, each drawn only when its label and its address are both set). Text only. Axes: place (middle: the copy in the middle of the section, bottom: low in a tall section, min-h-96).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"badge":{"description":"a short pill above the heading; empty: no badge","$ref":"#/$defs/text","default":""},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"secondaryActionLabel":{"description":"the label of the second action (the secondary button after the first); drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"secondaryActionHref":{"description":"the address of the second action","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"place":{"type":"string","enum":["middle","bottom"],"default":"middle"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/badge":[{"s":"badge","k":"text"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}],"/secondaryActionHref":[{"s":"button","k":"attr","a":"href"}],"/secondaryActionLabel":[{"s":"button","k":"text"}]}}},"locations-simple":{"organism":"LocationsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"LocationsSimpleProps","description":"The simple locations (model locations@1): the heading, a description, the offices as a list (the name, the address) and one picture (a map or a place). Axes: media (start: the picture before the copy from md up, end: after it).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"image":{"description":"address of the picture; none: the placeholder","$ref":"#/$defs/text","default":""},"imageAlt":{"description":"alt text of the picture","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text","default":""},"items":{"description":"the offices, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/LocationItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["start","end"],"default":"start"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","imageAlt","items"],"additionalProperties":false},"defs":["LocationItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["location"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"logos-simple":{"organism":"LogosSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"LogosSimpleProps","description":"The simple logos (model logos@1): a short heading and the logos as a list, each a picture named by the company. Axes: surface (plain: a wrapping row, cards: a grid on a card surface).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"logos":{"description":"the logos, in the order they are shown (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleLogo"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"surface":{"type":"string","enum":["plain","cards"],"default":"plain"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","logos"],"additionalProperties":false},"defs":["SimpleLogo","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/logos":["logo"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}]}}},"menu-simple":{"organism":"MenuSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"MenuSimpleProps","description":"The simple menu (model menu@1): the heading, a description and the dishes as a list, each with a picture, an optional badge (a new or a spicy dish), the name, the weight or the portion, a line and the price as it is shown. Axes: layout (cards: a card surface per dish, the picture on top; rows: the picture at the start, the price at the end), cols (3, 2, 4 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the dishes, in the order they are shown (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/MenuDish"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2","4"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["MenuDish","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["dish"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/badge":[{"s":"badge","k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/weight":[{"k":"text"}],"/items/[]/description":[{"k":"text"}],"/items/[]/price":[{"k":"text"}]}}},"offers-simple":{"organism":"OffersSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"OffersSimpleProps","description":"The simple offers (model offers@1): the heading, a description and the offers as a list on a card surface, each with a title, a line and an action. Axes: cols (2, 3 columns from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the offers, in the order they are shown (1 to 3)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/OfferItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"cols":{"type":"string","enum":["2","3"],"default":"2"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["OfferItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["offer"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}],"/items/[]/actionHref":[{"s":"button","k":"attr","a":"href"}],"/items/[]/actionLabel":[{"s":"button","k":"text"}]}}},"photos-simple":{"organism":"PhotosSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"PhotosSimpleProps","description":"The simple photos (model photos@1): the heading, a description and the photos as a list. Axes: cols (2, 3, 4 columns from md up; a pair at 4/3, more as squares).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"photos":{"description":"the photos, in the order they are shown (1 to 12)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimplePhoto"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"cols":{"type":"string","enum":["2","3","4"],"default":"4"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","photos"],"additionalProperties":false},"defs":["SimplePhoto","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/photos":["photo"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}]}}},"pricing-simple":{"organism":"PricingSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"PricingSimpleProps","description":"The simple pricing (model pricing@1): the heading, a description and the plans as a list on a card surface, each with the name, an optional badge (the highlighted plan), a line, the price and an action. Axes: layout (cards: columns, rows: one under the other, a row each from md up), cols (2, 3 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"plans":{"description":"the plans, in the order they are shown (1 to 4)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/PricingPlan"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","plans"],"additionalProperties":false},"defs":["PricingPlan","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/plans":["plan"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/plans/[]/badge":[{"s":"badge","k":"text"}],"/plans/[]/title":[{"k":"text"}],"/plans/[]/description":[{"k":"text"}],"/plans/[]/price":[{"k":"text"}],"/plans/[]/actionHref":[{"s":"button","k":"attr","a":"href"}],"/plans/[]/actionLabel":[{"s":"button","k":"text"}]}}},"product-reviews":{"organism":"ProductReviews","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ProductReviewsProps","description":"The product reviews (model reviews@1): the heading, a description and the reviews as a list on a card surface, each with the rating as it is shown (the primary token), the words, then the reviewer: the portrait, the name and a line. Axes: layout (cards: columns, rows: one under the other in a narrow column), cols (2, 3 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the reviews, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ReviewItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["ReviewItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["review"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/rating":[{"k":"text"}],"/items/[]/quote":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"product-simple":{"organism":"ProductSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ProductSimpleProps","description":"The simple product (model product@1): the main picture and up to four thumbnails as a list (named by the product), beside the name as the heading, the price, a description and one action. Axes: media (start: the pictures before the copy from md up, end: after it, top: above it, wide).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"price":{"description":"the price as it is shown","$ref":"#/$defs/text"},"image":{"description":"address of the main picture; none: the placeholder","$ref":"#/$defs/text","default":""},"imageAlt":{"description":"alt text of the main picture","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text","default":""},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"photos":{"description":"more pictures, thumbnails under the main one (0 to 4)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ProductPhoto"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["start","end","top"],"default":"start"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","price","imageAlt","photos"],"additionalProperties":false},"defs":["ProductPhoto","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/photos":["thumb"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/price":[{"k":"text"}],"/description":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}]}}},"products-simple":{"organism":"ProductsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ProductsSimpleProps","description":"The simple products (model products@1): the heading, a description and the products as a list, each with a picture, the name (a link when the product has an address) and the price. Axes: layout (grid: columns, rows: the picture at the start of each row, a quarter of it), cols (3, 4 columns of the grid).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the products, in the order they are shown (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ProductItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["grid","rows"],"default":"grid"},"cols":{"type":"string","enum":["3","4"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["ProductItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["product"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/href":[{"k":"attr","a":"href"}],"/items/[]/title":[{"k":"text"}],"/items/[]/price":[{"k":"text"}]}}},"profile-intro":{"organism":"ProfileIntro","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ProfileIntroProps","description":"The profile intro (model profile@1): the name as the heading, the role (the primary token), a description, the links of the person as a list of small outline links, and the portrait. Axes: media (end: the portrait after the copy, start: before it from md up, top: a disc over the copy).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"description":"the name of the person (the heading)","$ref":"#/$defs/text"},"role":{"description":"the role and the company","$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"image":{"description":"address of the picture; none: the placeholder","$ref":"#/$defs/text","default":""},"imageAlt":{"description":"alt text of the picture","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text","default":""},"links":{"description":"the links of the person, in the order they are shown (0 to 4)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/ProfileLink"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["end","start","top"],"default":"end"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","role","imageAlt","links"],"additionalProperties":false},"defs":["ProfileLink","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/links":["profile-link"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/role":[{"k":"text"}],"/description":[{"k":"text"}],"/links/[]/href":[{"s":"button","k":"attr","a":"href"}],"/links/[]/label":[{"s":"button","k":"text"}]}}},"promo-simple":{"organism":"PromoSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"PromoSimpleProps","description":"The simple promo (model promo@1): one offer with the discount as a badge, the heading, the deadline as text (no countdown), a description, an optional promo code, one action and a picture. Axes: media (end: the picture after the copy from md up, start: before it, top: above it, wide).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"badge":{"description":"a short pill above the heading; empty: no badge","$ref":"#/$defs/text","default":""},"title":{"$ref":"#/$defs/text"},"deadline":{"description":"the deadline of the offer as it is shown (until 31 December)","$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"code":{"description":"a promo code; empty: none","$ref":"#/$defs/text","default":""},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"image":{"description":"address of the picture; none: the placeholder","$ref":"#/$defs/text","default":""},"imageAlt":{"description":"alt text of the picture","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"media":{"type":"string","enum":["end","start","top"],"default":"end"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","deadline","imageAlt"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/badge":[{"s":"badge","k":"text"}],"/title":[{"k":"text"}],"/deadline":[{"k":"text"}],"/description":[{"k":"text"}],"/code":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}]}}},"pull-quote-simple":{"organism":"PullQuoteSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"PullQuoteSimpleProps","description":"The simple pull quote (model pull-quote@1): the words in a blockquote, then the author (names the section), a role line and the source as a link, in a figure. Axes: layout (rule: a bar in the primary token at the start, centered: centred, no bar).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"quote":{"description":"the words that are quoted","$ref":"#/$defs/text"},"title":{"description":"the name of the author (names the section)","$ref":"#/$defs/text"},"description":{"description":"the role of the author; empty: none","$ref":"#/$defs/text","default":""},"sourceLabel":{"description":"the label of the source; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"sourceHref":{"description":"the address of the source","$ref":"#/$defs/text","default":""},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"layout":{"type":"string","enum":["rule","centered"],"default":"rule"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","quote","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/quote":[{"k":"text"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/sourceHref":[{"k":"attr","a":"href"}],"/sourceLabel":[{"k":"text"}]}}},"purchase-simple":{"organism":"PurchaseSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"PurchaseSimpleProps","description":"The simple purchase (model purchase@1): on a card surface, the heading and a description beside the price, one action and a note. Axes: layout (panel: the copy at the start, the price and the action at the end from md up, centered: one centred column).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"price":{"description":"the price as it is shown","$ref":"#/$defs/text"},"note":{"description":"a short note under the action; empty: none","$ref":"#/$defs/text","default":""},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"layout":{"type":"string","enum":["panel","centered"],"default":"panel"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","price"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/price":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}],"/note":[{"k":"text"}]}}},"rating-simple":{"organism":"RatingSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"RatingSimpleProps","description":"The simple rating (model rating@1): the score (large), the heading that names it, a line (the count, the scale) and the source as a link. Axes: layout (bar: one row on a card surface from md up, centered: centred, one under the other).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"value":{"description":"the score as it is shown (4.9, 98%)","$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"the count and the scale; empty: none","$ref":"#/$defs/text","default":""},"sourceLabel":{"description":"the label of the source; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"sourceHref":{"description":"the address of the source","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"layout":{"type":"string","enum":["bar","centered"],"default":"bar"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","value","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/value":[{"k":"text"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/sourceHref":[{"k":"attr","a":"href"}],"/sourceLabel":[{"k":"text"}]}}},"rooms-simple":{"organism":"RoomsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"RoomsSimpleProps","description":"The simple rooms (model rooms@1): the heading, a description and the rooms as a list, each with a picture, the name (a link when the room has an address), the guests or the size, a line and the price a night as it is shown. Axes: layout (cards: a card surface per room, the picture on top; rows: the picture at the start, a third of the row from md up), cols (3, 2 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the rooms, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/Room"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["Room","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["room"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/href":[{"k":"attr","a":"href"}],"/items/[]/title":[{"k":"text"}],"/items/[]/guests":[{"k":"text"}],"/items/[]/description":[{"k":"text"}],"/items/[]/price":[{"k":"text"}]}}},"services-simple":{"organism":"ServicesSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"ServicesSimpleProps","description":"The simple services (model services@1): the heading, a description and the services as a list, each with the name (a link when the service has an address), a line and the price as it is shown (from 90 000 per project). Text only. Axes: layout (cards: a card surface per service; rows: one row per service, the price at the end from md up), cols (3, 2 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the services, in the order they are shown (1 to 9)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/Service"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["Service","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["service"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/href":[{"k":"attr","a":"href"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}],"/items/[]/price":[{"k":"text"}]}}},"specs-simple":{"organism":"SpecsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"SpecsSimpleProps","description":"The simple specs (model specs@1): the heading, a description and the specifications as a list of rows on a muted surface, each the name and its value. Axes: layout (rows: one narrow column, columns: two columns from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the specifications, in the order they are shown (1 to 16)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SpecItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["rows","columns"],"default":"rows"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["SpecItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["spec"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"split-simple":{"organism":"SplitSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"SplitSimpleProps","description":"The simple split (model split@1): two halves of the section, the copy (the heading, a description, up to two links as the actions: the first primary, the second secondary, each drawn only when its label and its address are both set) and one picture that fills its half to the edge of the screen (no rounding). Axes: media (end: the picture after the copy, start: before it).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"image":{"description":"address of the picture (an https URL or a path); none: the placeholder","$ref":"#/$defs/text"},"imageAlt":{"description":"alt text of the picture; none: the title","$ref":"#/$defs/text"},"imageSrcset":{"description":"sizes of the picture as a srcset (`hero-960.webp 960w, hero-1280.webp 1280w`); none: `image` only","$ref":"#/$defs/text"},"imageDark":{"description":"address of the picture in the dark theme; none: image","$ref":"#/$defs/text"},"actionLabel":{"description":"the label of the action; the link is drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"actionHref":{"description":"the address of the action","$ref":"#/$defs/text","default":""},"secondaryActionLabel":{"description":"the label of the second action (the secondary button after the first); drawn when the label and the address are both set","$ref":"#/$defs/text","default":""},"secondaryActionHref":{"description":"the address of the second action","$ref":"#/$defs/text","default":""},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"media":{"type":"string","enum":["end","start"],"default":"end"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title"],"additionalProperties":false},"defs":["data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/actionHref":[{"s":"button","k":"attr","a":"href"}],"/actionLabel":[{"s":"button","k":"text"}],"/secondaryActionHref":[{"s":"button","k":"attr","a":"href"}],"/secondaryActionLabel":[{"s":"button","k":"text"}]}}},"stats-simple":{"organism":"StatsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"StatsSimpleProps","description":"The simple stats (model stats@1): the heading, a description and the figures as a list, each with the value (large, the primary token), a label and a note. Axes: cols (2, 3, 4 columns from md up), surface (plain, cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the figures, in the order they are shown (1 to 4)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleStat"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"cols":{"type":"string","enum":["2","3","4"],"default":"4"},"surface":{"type":"string","enum":["plain","cards"],"default":"plain"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["SimpleStat","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["stat"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/value":[{"in":"card","k":"text"},{"k":"text"}],"/items/[]/title":[{"in":"card","k":"text"},{"k":"text"}],"/items/[]/description":[{"in":"card","k":"text"},{"k":"text"}]}}},"steps-simple":{"organism":"StepsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"StepsSimpleProps","description":"The simple steps (model steps@1): the heading, a description and the steps as an ordered list, each with its short label (a badge), a title and a line. Axes: layout (row: the steps in columns, column: one under the other with the label at the side), cols (3, 4 columns of the row).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"steps":{"description":"the steps, in the order they are taken (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleStep"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["row","column"],"default":"row"},"cols":{"type":"string","enum":["3","4"],"default":"4"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","steps"],"additionalProperties":false},"defs":["SimpleStep","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/steps":["step"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/steps/[]/label":[{"s":"badge","k":"text"}],"/steps/[]/title":[{"k":"text"}],"/steps/[]/description":[{"k":"text"}]}}},"store-policies":{"organism":"StorePolicies","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"StorePoliciesProps","description":"The store policies (model store-policy@1): the heading, a description and the policies as a list, each with an icon picture (a small rounded square), a title and a line. Axes: layout (cards: columns on a card surface, rows: the icon beside the copy, two columns), cols (2, 3 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the policies, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/PolicyItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["3","2"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["PolicyItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["policy"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}},"stories-simple":{"organism":"StoriesSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"StoriesSimpleProps","description":"The simple stories (model stories@1): the heading, a description and the stories (posts) as a list, each with a cover picture, the title (a link when the story has an address) and a line. Axes: layout (grid: cards in columns, compact: small covers beside the copy on a card surface), cols (2, 3 columns).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"stories":{"description":"the stories, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleStory"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["grid","compact"],"default":"grid"},"cols":{"type":"string","enum":["2","3"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","stories"],"additionalProperties":false},"defs":["SimpleStory","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/stories":["story"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/stories/[]/href":[{"k":"attr","a":"href"}],"/stories/[]/title":[{"k":"text"}],"/stories/[]/description":[{"k":"text"}]}}},"team-simple":{"organism":"TeamSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"TeamSimpleProps","description":"The simple team (model team@1): the heading, a description and the members as a list, each with a portrait, the name and a line. Axes: layout (grid: the portrait over the copy, aside: the head beside large square portraits from md up, byline: a small disc beside the copy, list: a larger disc beside the copy, two columns), cols (2, 3, 4 columns from md up), surface (plain, cards: each member on a card surface).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"members":{"description":"the people, in the order they are shown (1 to 12)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleMember"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["grid","aside","byline","list"],"default":"grid"},"cols":{"type":"string","enum":["2","3","4"],"default":"3"},"surface":{"type":"string","enum":["plain","cards"],"default":"plain"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","members"],"additionalProperties":false},"defs":["SimpleMember","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/members":["member"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/members/[]/title":[{"k":"text"}],"/members/[]/description":[{"k":"text"}]}}},"testimonials-simple":{"organism":"TestimonialsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"TestimonialsSimpleProps","description":"The simple testimonials (model testimonials@1): the heading, a description and the quotes as a list, each with the words, then the author: the portrait, the name and a role line. Axes: layout (cards: the quotes on a card surface in columns, rows: the author beside the quote from md up, centered: the quotes centred, one under the other), cols (2, 3 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"quotes":{"description":"the quotes, in the order they are shown (1 to 6)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/SimpleQuote"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows","centered"],"default":"cards"},"cols":{"type":"string","enum":["2","3"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","quotes"],"additionalProperties":false},"defs":["SimpleQuote","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/quotes":["quote"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/quotes/[]/quote":[{"k":"text"}],"/quotes/[]/title":[{"k":"text"}],"/quotes/[]/description":[{"k":"text"}]}}},"timeline-simple":{"organism":"TimelineSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"TimelineSimpleProps","description":"The simple timeline (model timeline@1): the heading, a description and the steps of a process or a history as an ordered list, each with the date or the stage (the primary token), a title and a line. Text only. Axes: layout (column: one narrow column, a muted line at the start of each step; grid: the steps side by side), cols (2, 4 columns of the grid from md up).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the steps, in their order (2 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/TimelineStep"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"start"},"layout":{"type":"string","enum":["column","grid"],"default":"column"},"cols":{"type":"string","enum":["2","4"],"default":"2"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["TimelineStep","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["timeline-step"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/date":[{"k":"text"}],"/items/[]/title":[{"k":"text"}],"/items/[]/text":[{"k":"text"}]}}},"topics-simple":{"organism":"TopicsSimple","events":[],"slots":[],"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"TopicsSimpleProps","description":"The simple topics (model topics@1): the heading, a description and the topics as a list on a card surface, each with a short label (a badge), the title (a link when the topic has an address) and a line. Axes: layout (cards: columns, rows: one under the other), cols (2, 3 columns of the cards).","type":"object","properties":{"id":{"$ref":"#/$defs/text"},"title":{"$ref":"#/$defs/text"},"description":{"description":"one paragraph under the heading; empty: none","$ref":"#/$defs/text","default":""},"items":{"description":"the topics, in the order they are shown (1 to 8)","anyOf":[{"type":"array","items":{"anyOf":[{"$ref":"#/$defs/TopicItem"},{"$ref":"#/$defs/uiRef"},{"$ref":"#/$defs/data"}]}},{"$ref":"#/$defs/data"}]},"level":{"description":"the level of the heading (1 on the first section of a page)","enum":[1,2,3],"default":2},"padding":{"description":"the vertical padding of the section: compact (py-8 lg:py-16), standard (py-16 lg:py-32), spacious (py-24 lg:py-40)","type":"string","enum":["compact","standard","spacious"],"default":"standard"},"align":{"description":"the alignment of the copy: start, center or end (logical, follows the writing direction): items-* on the column, text-* on the text","type":"string","enum":["start","center","end"],"default":"center"},"layout":{"type":"string","enum":["cards","rows"],"default":"cards"},"cols":{"type":"string","enum":["2","3"],"default":"3"},"landmarkLabel":{"description":"accessible name of the landmark of this component when the page shows it more than once (a variant); replaces the heading name of the root landmark, follows the name of a nested one","$ref":"#/$defs/text"}},"required":["id","title","items"],"additionalProperties":false},"defs":["TopicItem","data","dataOp","dataRef","text","uiRef"],"viewMap":{"rows":{"/items":["topic"]},"fields":{"/landmarkLabel":[{"k":"attr","a":"aria-label"}],"/title":[{"k":"text"}],"/description":[{"k":"text"}],"/items/[]/label":[{"s":"badge","k":"text"}],"/items/[]/href":[{"k":"attr","a":"href"}],"/items/[]/title":[{"k":"text"}],"/items/[]/description":[{"k":"text"}]}}}}};
});

__def("packages/builder-core/src/catalog/props-schema.ts", function (exports) {
const { isImageName } = __req("packages/builder-core/src/catalog/image-url.ts");
const { isMoneyName } = __req("packages/builder-core/src/catalog/money.ts");
const raw = __req("packages/builder-core/src/catalog/props.json").default;
type CompactProps = {
	format: "buildy-props-compact";
	version: number;
	registry: string;
	propsVersion: string;
	digest: string;
	defs: Record<string, JsonSchema>;
	items: Record<string, { organism: string; events: string[]; slots: string[]; schema: JsonSchema; defs: string[]; viewMap?: ViewMap }>;
};

const props = raw as unknown as CompactProps;

/** The contract's shared $def of a Lucide icon name (an enum of the names the kit ships). */
const ICON_DEF = "lucideIcon";
/** Neutral placeholder of a required icon nobody filled; used only when the contract's enum contains it. */
const PLACEHOLDER_ICON = "circle-dot";
/** Strings the kit parses (Intl currency code, locale, link) need a valid value, not a label. */
const STRING_DEFAULTS: Record<string, string> = { currency: "USD", locale: "en", href: "#", id: "item" };

const propsDigest: string = props.digest;
function propsItems(): string[] {
	return Object.keys(props.items);
}

function hasPropsSchema(item: string): boolean {
	return Boolean(props.items[item]);
}

/** The published JSON Schema of an item's props, rebuilt with exactly its $defs (byte-equal to the pinned file). */
function propsSchemaFor(item: string): JsonSchema | null {
	const entry = props.items[item];
	if (!entry) return null;
	return { ...entry.schema, $defs: Object.fromEntries(entry.defs.map((name) => [name, props.defs[name]])) };
}

/** Events (callbacks the host wires, never data) and slots (snippets) of a block, next to its schema. */
function propsEventsFor(item: string): { events: string[]; slots: string[] } {
	const entry = props.items[item];
	return { events: entry?.events ?? [], slots: entry?.slots ?? [] };
}

/** The generated view map of a block, or null for an item (or an older registry pin) that carries none. */
function viewMapFor(item: string): ViewMap | null {
	return props.items[item]?.viewMap ?? null;
}

/** Lucide icon names of the contract (the published `lucideIcon` enum: every glyph of the registry's pinned Lucide). */
function lucideIcons(): string[] {
	const def = props.defs[ICON_DEF];
	return Array.isArray(def?.enum) ? (def.enum as string[]) : [];
}

/**
 * What the model is told about icons instead of the name list (about 1.9k names): any Lucide name in kebab-case. The
 * host checks it against lucideIcons(), maps spelling variants and drops what Lucide does not have (icon-name.ts).
 */
const LUCIDE_ICON_HINT = "any Lucide icon name in kebab-case (lucide.dev/icons); the host checks it against the full Lucide set and drops unknown names";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refName(node: JsonSchema): string | null {
	const ref = node.$ref;
	return typeof ref === "string" && ref.startsWith("#/$defs/") ? ref.slice("#/$defs/".length) : null;
}

function deref(node: JsonSchema): JsonSchema {
	let current = node;
	for (let depth = 0; depth < 16; depth += 1) {
		const name = refName(current);
		if (!name) return current;
		current = props.defs[name] ?? {};
	}
	return current;
}

/**
 * A reference shape of the contract (a ui-dictionary ref `{"$": "ui.*"}`, a data ref `{"$": name}` or a data op
 * `{op, args}`): the block reads the value from elsewhere. The page content never writes one.
 */
function isRefShape(node: JsonSchema): boolean {
	const target = deref(node);
	if (Array.isArray(target.anyOf)) return (target.anyOf as JsonSchema[]).every(isRefShape);
	const required = Array.isArray(target.required) ? (target.required as string[]) : [];
	return target.type === "object" && (required.includes("$") || (required.includes("op") && required.includes("args")));
}

/** $defs that are reference shapes; errors inside them are noise of an anyOf branch the content never takes. */
const refShapeDefs: ReadonlySet<string> = new Set(Object.keys(props.defs).filter((name) => isRefShape({ $ref: `#/$defs/${name}` })));

/** The value schema of a node: refs followed, reference-shape branches of an anyOf dropped. */
function valueOf(node: JsonSchema): JsonSchema {
	const target = deref(node);
	if (Array.isArray(target.anyOf)) {
		const branches = (target.anyOf as JsonSchema[]).filter((branch) => !isRefShape(branch));
		if (branches.length === 1) return valueOf(branches[0]!);
	}
	return target;
}

/** `map`: an object with free keys whose values are plain (strings, numbers, booleans, enum members): `badges: { sku: "Sale" }`. */
function kindOf(node: JsonSchema): FieldKind {
	if (refName(node) === ICON_DEF) return "icon";
	const value = valueOf(node);
	if (refName(value) === ICON_DEF) return "icon";
	if (Array.isArray(value.enum)) return "enum";
	if (value.type === "string") return "text";
	if (value.type === "number" || value.type === "integer") return "number";
	if (value.type === "boolean") return "boolean";
	if (value.type === "array") return "list";
	if (value.type === "object" && isObject(value.properties)) return "object";
	if (value.type === "object" && !isObject(value.properties) && isObject(value.additionalProperties) && ITEM_KINDS.has(kindOf(value.additionalProperties as JsonSchema))) return "map";
	return "other";
}

/** Fields of an object schema: name -> kind, and the required names. */
function fieldsOf(node: JsonSchema): { fields: Record<string, FieldKind>; required: string[] } {
	const value = valueOf(node);
	const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : {};
	return {
		fields: Object.fromEntries(Object.entries(properties).map(([name, inner]) => [name, kindOf(inner)])),
		required: Array.isArray(value.required) ? (value.required as string[]) : []
	};
}

const SHAPES = new Map<string, PropShape>();

/** The prop shape of a registry block, derived from its published schema. */
function propShapeFor(item: string): PropShape | null {
	const cached = SHAPES.get(item);
	if (cached) return cached;
	const schema = props.items[item]?.schema;
	if (!schema) return null;
	const top = fieldsOf(schema);
	const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
	const shape: PropShape = { props: Object.keys(properties), required: top.required, text: [], lists: {}, objects: {}, enums: {} };
	for (const [name, inner] of Object.entries(properties)) {
		const kind = top.fields[name];
		if (kind === "text") shape.text.push(name);
		else if (kind === "enum") shape.enums[name] = (valueOf(inner).enum as unknown[]).map(String);
		else if (kind === "list") {
			const items = valueOf(inner).items as JsonSchema | undefined;
			if (items && kindOf(items) === "object") {
				const record = fieldsOf(items);
				shape.lists[name] = { required: top.required.includes(name), record: record.fields, recordRequired: record.required };
			}
		} else if (kind === "object") shape.objects[name] = fieldsOf(inner).fields;
	}
	SHAPES.set(item, shape);
	return shape;
}

/** One entry of a list of plain values. */
const ITEM_KINDS = new Set<FieldKind>(["text", "number", "boolean", "enum"]);

/** What one list entry or map value is, when it is a plain value (undefined for records and anything else). */
function itemNodeOf(entry: JsonSchema): ListItemNode | undefined {
	const entryKind = kindOf(entry);
	if (!ITEM_KINDS.has(entryKind)) return undefined;
	const value = valueOf(entry);
	const item: ListItemNode = { kind: entryKind as ListItemNode["kind"] };
	if (entryKind === "enum") {
		item.enum = (value.enum as unknown[]).map(String);
		item.enumValues = value.enum as ListItemNode["enumValues"];
	}
	if (entryKind === "text" && typeof value.maxLength === "number") item.maxLength = value.maxLength;
	return item;
}

/** One prop of a block schema as a tree: its kind, whether it is required, enum values and nested fields. */
function fieldTree(node: JsonSchema, depth: number): PropsFieldNode[] {
	const value = valueOf(node);
	const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : {};
	const required = Array.isArray(value.required) ? (value.required as string[]) : [];
	const hasCurrency = Object.entries(properties).some(([other, entry]) => other === "currency" && kindOf(entry) === "text");
	return Object.entries(properties).map(([name, inner]) => {
		const kind = kindOf(inner);
		const target = valueOf(inner);
		const out: PropsFieldNode = { name, kind, required: required.includes(name) };
		if (kind === "number" && hasCurrency && isMoneyName(name)) out.money = true;
		if (kind === "text" && isImageName(name)) out.image = true;
		if (kind === "enum") {
			out.enum = (target.enum as unknown[]).map(String);
			out.enumValues = target.enum as Array<string | number | boolean | null>;
		}
		if (kind === "list" && typeof target.maxItems === "number") out.maxItems = target.maxItems;
		if (kind === "list" && typeof target.minItems === "number") out.minItems = target.minItems;
		if (kind === "text" && typeof target.maxLength === "number") out.maxLength = target.maxLength;
		if (depth < 6 && kind === "object") out.fields = fieldTree(inner, depth + 1);
		if (depth < 6 && kind === "list" && isObject(target.items)) {
			const entry = target.items as JsonSchema;
			if (kindOf(entry) === "object") out.fields = fieldTree(entry, depth + 1);
			else out.item = itemNodeOf(entry);
		}
		if (kind === "map") {
			out.item = itemNodeOf(target.additionalProperties as JsonSchema);
			if (typeof target.minProperties === "number") out.minItems = target.minProperties;
			if (typeof target.maxProperties === "number") out.maxItems = target.maxProperties;
			const names = target.propertyNames as JsonSchema | undefined;
			if (isObject(names) && typeof names.pattern === "string") out.keyPattern = names.pattern;
		}
		return out;
	});
}

/** Every prop of a registry block's published schema as a field tree (schema order), or null without a schema. */
function propsFieldTree(item: string): PropsFieldNode[] | null {
	const schema = props.items[item]?.schema;
	return schema ? fieldTree(schema, 0) : null;
}

/** The schema node of a prop pointer (`/content/features`), list indices stepping into the row schema. */
function schemaAt(item: string, pointer: string): JsonSchema | null {
	const schema = props.items[item]?.schema;
	if (!schema) return null;
	let node: JsonSchema = schema;
	for (const part of pointer.split("/").slice(1)) {
		const value = valueOf(node);
		if (value.type === "array" && /^\d+$/.test(part) && isObject(value.items)) {
			node = value.items as JsonSchema;
			continue;
		}
		const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : null;
		if (!properties?.[part]) return null;
		node = properties[part]!;
	}
	return node;
}

type PointerInfo = {
	/** What the prop is: an object with fields, a list, a free-form map (`additionalProperties`), or a plain value. */
	kind: "object" | "array" | "map" | "scalar";
	/** The prop is required by its parent object (a list row is). */
	required: boolean;
	minItems?: number;
	maxItems?: number;
	/** map: the pattern its keys must match. */
	keyPattern?: string;
};

/** What the schema says about a prop pointer (`/filter/tabs`, `/features/2/icon`), or null when the path is not in the schema. */
function pointerInfo(item: string, pointer: string): PointerInfo | null {
	const schema = props.items[item]?.schema;
	if (!schema) return null;
	let node: JsonSchema = schema;
	let required = true;
	for (const raw of pointer.split("/").slice(1)) {
		const part = raw.replace(/~1/g, "/").replace(/~0/g, "~");
		const value = valueOf(node);
		if (value.type === "array" && /^\d+$/.test(part) && isObject(value.items)) {
			node = value.items as JsonSchema;
			required = true;
			continue;
		}
		const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : null;
		if (properties?.[part]) {
			required = Array.isArray(value.required) && (value.required as string[]).includes(part);
			node = properties[part]!;
			continue;
		}
		if (value.type === "object" && !properties && value.additionalProperties) {
			required = false;
			node = value.additionalProperties === true ? {} : (value.additionalProperties as JsonSchema);
			continue;
		}
		return null;
	}
	const value = valueOf(node);
	const kind = value.type === "array" ? "array" : value.type === "object" ? (isObject(value.properties) ? "object" : "map") : "scalar";
	return {
		kind,
		required,
		...(typeof (value.minItems ?? value.minProperties) === "number" ? { minItems: (value.minItems ?? value.minProperties) as number } : {}),
		...(typeof (value.maxItems ?? value.maxProperties) === "number" ? { maxItems: (value.maxItems ?? value.maxProperties) as number } : {}),
		...(isObject(value.propertyNames) && typeof (value.propertyNames as JsonSchema).pattern === "string" ? { keyPattern: (value.propertyNames as JsonSchema).pattern as string } : {})
	};
}

function kindLabel(kind: FieldKind): string {
	return kind === "text" ? "" : `:${kind}`;
}

/**
 * Compact model view of a block's schema: the list prop the page rows become (`features[]: id title text icon href?`,
 * optional fields with `?`), the object props, and events / slots. Enums of layout axes are left to the variants
 * (each variant already names its axis values); icons are described once in catalogSources.icons (LUCIDE_ICON_HINT).
 */
function propsSummaryFor(item: string): Record<string, string> | null {
	const shape = propShapeFor(item);
	if (!shape) return null;
	const out: Record<string, string> = {};
	const lists = Object.entries(shape.lists).sort(([, a], [, b]) => Number(b.required) - Number(a.required));
	if (lists.length) {
		const [name, list] = lists[0]!;
		out.rows = `${name}[]: ${Object.entries(list.record)
			.map(([field, kind]) => `${field}${kindLabel(kind)}${list.recordRequired.includes(field) ? "" : "?"}`)
			.join(" ")}`;
	}
	const text = shape.text.filter((name) => name !== "id" && name !== "landmarkLabel");
	if (text.length) out.text = text.join(" ");
	const { events, slots } = propsEventsFor(item);
	if (events.length) out.events = events.join(" ");
	if (slots.length) out.slots = slots.join(" ");
	return out;
}

exports["props"] = props;
exports["PLACEHOLDER_ICON"] = PLACEHOLDER_ICON;
exports["STRING_DEFAULTS"] = STRING_DEFAULTS;
exports["propsDigest"] = propsDigest;
exports["propsItems"] = propsItems;
exports["hasPropsSchema"] = hasPropsSchema;
exports["propsSchemaFor"] = propsSchemaFor;
exports["propsEventsFor"] = propsEventsFor;
exports["viewMapFor"] = viewMapFor;
exports["lucideIcons"] = lucideIcons;
exports["LUCIDE_ICON_HINT"] = LUCIDE_ICON_HINT;
exports["isObject"] = isObject;
exports["refShapeDefs"] = refShapeDefs;
exports["valueOf"] = valueOf;
exports["kindOf"] = kindOf;
exports["propShapeFor"] = propShapeFor;
exports["propsFieldTree"] = propsFieldTree;
exports["schemaAt"] = schemaAt;
exports["pointerInfo"] = pointerInfo;
exports["propsSummaryFor"] = propsSummaryFor;

});

__def("packages/page-contract/src/types.ts", function (exports) {

const PAGE_BLOCK_KINDS = [
	"nav",
	"nav-link",
	"hero",
	"features",
	"feature",
	"menu",
	"dish",
	"hours",
	"cta",
	"footer",
	"pagehead",
	"overview",
	"metrics",
	"metric",
	"chart",
	"activity",
	"activity-item",
	"sidenav",
	"bottomnav"
] as const;


exports["PAGE_BLOCK_KINDS"] = PAGE_BLOCK_KINDS;

});

__def("packages/page-contract/src/clone.ts", function (exports) {

function cloneJson<T>(value: T): T {
	return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

exports["cloneJson"] = cloneJson;

});

__def("packages/page-contract/src/json-schema.ts", function (exports) {

type Schema = Record<string, unknown> | boolean;

const ANNOTATIONS = new Set(["$schema", "$id", "$defs", "title", "description", "default", "examples"]);
const ASSERTIONS = new Set([
	"$ref", "allOf", "anyOf", "oneOf", "not", "type", "enum", "const", "pattern", "minLength", "maxLength",
	"minimum", "maximum", "minItems", "maxItems", "items", "properties", "required", "additionalProperties",
	"maxProperties", "propertyNames"
]);

function typeOf(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
	return typeof value;
}

function typeMatches(value: unknown, type: string): boolean {
	const actual = typeOf(value);
	return actual === type || (type === "number" && actual === "integer");
}

function equal(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function expectedOf(keyword: string, schema: Record<string, unknown>): string | undefined {
	const has = (key: string) => schema[key] !== undefined;
	switch (keyword) {
		case "enum":
			return `one of ${JSON.stringify(schema.enum)}`;
		case "const":
			return `exactly ${JSON.stringify(schema.const)}`;
		case "type":
			return `type ${Array.isArray(schema.type) ? (schema.type as string[]).join(" | ") : String(schema.type)}`;
		case "pattern":
			return `a string matching /${String(schema.pattern)}/`;
		case "maxLength":
			return `at most ${String(schema.maxLength)} characters`;
		case "minLength":
			return `at least ${String(schema.minLength)} characters`;
		case "maxItems":
			return `at most ${String(schema.maxItems)} items`;
		case "minItems":
			return `at least ${String(schema.minItems)} items`;
		case "maxProperties":
			return `at most ${String(schema.maxProperties)} keys`;
		case "required":
			return `the key to be present (required: ${JSON.stringify(schema.required)})`;
		case "additionalProperties":
			return has("properties") ? `only the keys ${JSON.stringify(Object.keys(schema.properties as object))}` : "no other keys";
		case "minimum":
			return `a number >= ${String(schema.minimum)}`;
		case "maximum":
			return `a number <= ${String(schema.maximum)}`;
		case "propertyNames":
			return `key names matching ${JSON.stringify((schema.propertyNames as { pattern?: string }).pattern ?? "the schema")}`;
		default:
			return undefined;
	}
}

class SchemaRegistry {
	private roots = new Map<string, Record<string, unknown>>();
	private regex = new Map<string, RegExp>();

	add(schema: Record<string, unknown>): void {
		const id = schema.$id;
		if (typeof id !== "string" || !id) throw new Error("schema needs an $id");
		this.roots.set(id, schema);
	}

	/** Issues of `value` against `ref` (an $id, optionally with a #/json/pointer). Empty = valid. */
	check(value: unknown, ref: string): SchemaIssue[] {
		const out: SchemaIssue[] = [];
		const [base, schema] = this.resolve(ref, "");
		this.walk(value, schema, base, "$", out);
		return out;
	}

	private resolve(ref: string, currentBase: string): [string, Schema] {
		const hash = ref.indexOf("#");
		const base = hash === 0 ? currentBase : hash > 0 ? ref.slice(0, hash) : ref;
		const pointer = hash >= 0 ? ref.slice(hash + 1) : "";
		const root = this.roots.get(base);
		if (!root) throw new Error(`unknown schema ${base}`);
		let node: unknown = root;
		for (const raw of pointer.split("/").filter(Boolean)) {
			const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
			node = node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
		}
		if (node === undefined) throw new Error(`unresolved $ref ${ref}`);
		return [base, node as Schema];
	}

	private pattern(source: string): RegExp {
		let re = this.regex.get(source);
		if (!re) {
			re = new RegExp(source, "u");
			this.regex.set(source, re);
		}
		return re;
	}

	private walk(value: unknown, schema: Schema, base: string, path: string, out: SchemaIssue[]): void {
		if (schema === true) return;
		if (schema === false) {
			out.push({ path, keyword: "false" });
			return;
		}
		const fail = (keyword: string, at = path) => out.push({ path: at, keyword, expected: expectedOf(keyword, schema) });
		const sub = (v: unknown, s: unknown, at: string): SchemaIssue[] => {
			const issues: SchemaIssue[] = [];
			this.walk(v, s as Schema, base, at, issues);
			return issues;
		};
		for (const key of Object.keys(schema)) {
			if (!ASSERTIONS.has(key) && !ANNOTATIONS.has(key) && !key.startsWith("x-")) {
				throw new Error(`unsupported schema keyword ${key}`);
			}
		}
		if (typeof schema.$ref === "string") {
			const [refBase, target] = this.resolve(schema.$ref, base);
			this.walk(value, target, refBase, path, out);
		}
		if (Array.isArray(schema.allOf)) for (const s of schema.allOf) out.push(...sub(value, s, path));
		if (Array.isArray(schema.anyOf) && !schema.anyOf.some((s) => sub(value, s, path).length === 0)) fail("anyOf");
		if (Array.isArray(schema.oneOf)) {
			const branches = schema.oneOf.map((s) => sub(value, s, path));
			const passing = branches.filter((issues) => issues.length === 0).length;
			if (passing !== 1) {
				// Report the issues of the closest branch so the caller gets a useful path.
				const closest = [...branches].sort((a, b) => a.length - b.length)[0] ?? [];
				out.push(...(passing === 0 ? closest : []), { path, keyword: "oneOf" });
			}
		}
		if (schema.not !== undefined && sub(value, schema.not, path).length === 0) fail("not");
		if (schema.type !== undefined) {
			const types = Array.isArray(schema.type) ? schema.type : [schema.type];
			if (!types.some((t) => typeMatches(value, String(t)))) {
				fail("type");
				return;
			}
		}
		if (Array.isArray(schema.enum) && !schema.enum.some((e) => equal(e, value))) fail("enum");
		if ("const" in schema && !equal(schema.const, value)) fail("const");
		if (typeof value === "string") {
			const length = [...value].length;
			if (typeof schema.minLength === "number" && length < schema.minLength) fail("minLength");
			if (typeof schema.maxLength === "number" && length > schema.maxLength) fail("maxLength");
			if (typeof schema.pattern === "string" && !this.pattern(schema.pattern).test(value)) fail("pattern");
		}
		if (typeof value === "number" && typeof schema.minimum === "number" && value < schema.minimum) fail("minimum");
		if (typeof value === "number" && typeof schema.maximum === "number" && value > schema.maximum) fail("maximum");
		if (Array.isArray(value)) {
			if (typeof schema.minItems === "number" && value.length < schema.minItems) fail("minItems");
			if (typeof schema.maxItems === "number" && value.length > schema.maxItems) fail("maxItems");
			if (schema.items !== undefined) value.forEach((item, i) => out.push(...sub(item, schema.items, `${path}[${i}]`)));
		}
		if (value && typeof value === "object" && !Array.isArray(value)) {
			const obj = value as Record<string, unknown>;
			const props = (schema.properties ?? {}) as Record<string, unknown>;
			if (Array.isArray(schema.required)) {
				for (const key of schema.required) if (!(String(key) in obj)) fail("required", `${path}.${String(key)}`);
			}
			if (typeof schema.maxProperties === "number" && Object.keys(obj).length > schema.maxProperties) fail("maxProperties");
			if (schema.propertyNames !== undefined) {
				for (const key of Object.keys(obj)) if (sub(key, schema.propertyNames, `${path}.${key}`).length) fail("propertyNames", `${path}.${key}`);
			}
			for (const [key, v] of Object.entries(obj)) {
				if (key in props) out.push(...sub(v, props[key], `${path}.${key}`));
				else if (schema.additionalProperties === false) fail("additionalProperties", `${path}.${key}`);
				else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
					out.push(...sub(v, schema.additionalProperties, `${path}.${key}`));
				}
			}
		}
	}
}

exports["SchemaRegistry"] = SchemaRegistry;

});

__def("packages/page-contract/schema/page-spec-v2.schema.json", function (exports) {
  exports.default = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schema.buildy.tw/page-spec-v2.schema.json",
  "title": "Page spec page-spec/v2 — a page as registry items with their props",
  "x-page-spec-profile": "page-spec/v2",
  "x-page-spec-version": "2.0.0",
  "description": "A BuildY page as ONE document: { version: 2, title, slug, locale, seo, blocks: [{ id, item, variant, props }] }. `item` is the registry item of `npx ui8kit add`, `props` are exactly the props of its component, `variant` names the preset of its layout axes. An agent reads it, reads the props schema of an item and writes a new version or an RFC 6902 patch (page-patch-v2.schema.json); the host validates and answers with compiler-style errors { path, expected, got }. Replaces the kind / copy / children model of page-spec/v1 (still published). After the schema, consumers run x-program-checks, then the registry checks x-host-checks.",
  "x-program-checks": [
    "duplicate_id",
    "too_many_blocks",
    "too_large",
    "too_deep"
  ],
  "x-host-checks": [
    "unknown_item",
    "unknown_variant",
    "no_renderer",
    "props_invalid"
  ],
  "x-limits": {
    "maxBlocks": 64,
    "maxIdLength": 63,
    "maxSlugLength": 48,
    "maxTitleLength": 160,
    "maxItemLength": 80,
    "maxVariantLength": 40,
    "maxTextLength": 2000,
    "maxSeoLength": 200,
    "maxLocaleLength": 16,
    "maxJsonChars": 200000,
    "maxDatetimeLength": 40,
    "maxPropKeys": 64,
    "maxListItems": 24,
    "maxDepth": 8
  },
  "$ref": "#/$defs/page",
  "$defs": {
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{0,62}$",
      "maxLength": 63,
      "description": "Lowercase ASCII id of a block, unique in the whole page (page id included; program check duplicate_id). Safe in generated code (data-block-id)."
    },
    "item": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      "maxLength": 80,
      "description": "Registry item name as used by `npx ui8kit add <item>` (hero-split, feature-grid, site-footer). The host rejects an item its registry does not have (unknown_item) or cannot render (no_renderer)."
    },
    "variant": {
      "type": "string",
      "pattern": "^[A-Za-z][A-Za-z0-9-]*$",
      "maxLength": 40,
      "description": "A published variant of the item (registry.buildy.tw/variants/v0.json): a named preset of the layout axes of its props (extra, media, columns, tone). Optional: the item's default variant. The host rejects a variant the item does not have (unknown_variant)."
    },
    "propText": {
      "type": "string",
      "description": "Plain text of a prop. As safeText of page-spec/v1 (control characters, `<` `>`, dangerous URL schemes are rejected) except that `{` and `}` are allowed: registry presets carry templates such as `?paged={0}`.",
      "pattern": "^[^<>\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]*$",
      "not": {
        "anyOf": [
          {
            "pattern": "^[\\u0000-\\u0020]*[jJ][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*[vV][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*[sS][\\u0000-\\u0020]*[cC][\\u0000-\\u0020]*[rR][\\u0000-\\u0020]*[iI][\\u0000-\\u0020]*[pP][\\u0000-\\u0020]*[tT][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^[\\u0000-\\u0020]*[dD][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*[tT][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^[\\u0000-\\u0020]*[vV][\\u0000-\\u0020]*[bB][\\u0000-\\u0020]*[sS][\\u0000-\\u0020]*[cC][\\u0000-\\u0020]*[rR][\\u0000-\\u0020]*[iI][\\u0000-\\u0020]*[pP][\\u0000-\\u0020]*[tT][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^[\\u0000-\\u0020]*[fF][\\u0000-\\u0020]*[iI][\\u0000-\\u0020]*[lL][\\u0000-\\u0020]*[eE][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^\\s*(?![hH][tT][tT][pP][sS]?://)[A-Za-z][A-Za-z0-9+.\\-]*://"
          }
        ]
      },
      "maxLength": 2000
    },
    "propValue": {
      "description": "A prop value: plain JSON; strings are plain text (propText). The item's props schema (registry.buildy.tw/props/v0.json) decides what is valid for each prop (x-host-checks props_invalid).",
      "anyOf": [
        {
          "$ref": "#/$defs/propText"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        },
        {
          "type": "array",
          "maxItems": 24,
          "items": {
            "$ref": "#/$defs/propValue"
          }
        },
        {
          "type": "object",
          "maxProperties": 64,
          "propertyNames": {
            "pattern": "^[A-Za-z][A-Za-z0-9_]{0,47}$"
          },
          "additionalProperties": {
            "$ref": "#/$defs/propValue"
          }
        }
      ]
    },
    "props": {
      "type": "object",
      "maxProperties": 64,
      "propertyNames": {
        "pattern": "^[A-Za-z][A-Za-z0-9_]{0,47}$"
      },
      "additionalProperties": {
        "$ref": "#/$defs/propValue"
      },
      "description": "Exactly the props of the registry item's component (what `<Item {...props} />` receives, and what the exported code writes). Nothing else lives in a block: no copy slots, no rows, no children. A host that inserts a block without props fills the sample props of the variant (the preset of its layout axes plus the minimum the props schema requires); layout axes are props like any other."
    },
    "block": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "item"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "item": {
          "$ref": "#/$defs/item"
        },
        "variant": {
          "$ref": "#/$defs/variant"
        },
        "props": {
          "$ref": "#/$defs/props"
        }
      },
      "description": "One section of the page: a registry item, the variant it was picked as and its props."
    },
    "seo": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "title": {
          "allOf": [
            {
              "$ref": "https://schema.buildy.tw/page-spec.schema.json#/$defs/safeText"
            }
          ],
          "maxLength": 200
        },
        "description": {
          "allOf": [
            {
              "$ref": "https://schema.buildy.tw/page-spec.schema.json#/$defs/safeText"
            }
          ],
          "maxLength": 200
        }
      }
    },
    "page": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "version",
        "slug",
        "title",
        "locale",
        "blocks"
      ],
      "properties": {
        "version": {
          "const": 2,
          "description": "Document version: 2."
        },
        "id": {
          "$ref": "#/$defs/id"
        },
        "slug": {
          "type": "string",
          "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          "minLength": 1,
          "maxLength": 48,
          "description": "Ordinary page slug, no query or UTM variants."
        },
        "status": {
          "enum": [
            "draft",
            "pending",
            "scheduled",
            "published",
            "archived",
            "trashed"
          ],
          "description": "Lifecycle (optional; a host defaults a new page to draft)."
        },
        "title": {
          "allOf": [
            {
              "$ref": "https://schema.buildy.tw/page-spec.schema.json#/$defs/safeText"
            }
          ],
          "maxLength": 160,
          "minLength": 1,
          "pattern": "\\S"
        },
        "locale": {
          "type": "string",
          "pattern": "^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$",
          "maxLength": 16,
          "description": "BCP 47 language of the page copy; follows the language the author writes in."
        },
        "seo": {
          "$ref": "#/$defs/seo"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
          "maxLength": 40
        },
        "updatedAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
          "maxLength": 40
        },
        "blocks": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/block"
          },
          "maxItems": 64,
          "description": "Sections in render order. The exported project (page file + the block files `npx ui8kit add` writes) is generated from this list."
        }
      }
    },
    "record": {
      "type": "object",
      "additionalProperties": false,
      "description": "One chat's pages in the browser store: the applied page, the pending candidate and the last proposal (page-spec/v2 documents) with their provenance (page-spec/v1 provenance: the Stock screen the page started from and the advisory screen family, never a rule).",
      "properties": {
        "applied": {
          "anyOf": [
            {
              "$ref": "#/$defs/page"
            },
            {
              "type": "null"
            }
          ]
        },
        "candidate": {
          "anyOf": [
            {
              "$ref": "#/$defs/page"
            },
            {
              "type": "null"
            }
          ]
        },
        "lastProposed": {
          "anyOf": [
            {
              "$ref": "#/$defs/page"
            },
            {
              "type": "null"
            }
          ]
        },
        "appliedProvenance": {
          "anyOf": [
            {
              "$ref": "https://schema.buildy.tw/page-spec.schema.json#/$defs/provenance"
            },
            {
              "type": "null"
            }
          ]
        },
        "candidateProvenance": {
          "anyOf": [
            {
              "$ref": "https://schema.buildy.tw/page-spec.schema.json#/$defs/provenance"
            },
            {
              "type": "null"
            }
          ]
        },
        "lastProposedProvenance": {
          "anyOf": [
            {
              "$ref": "https://schema.buildy.tw/page-spec.schema.json#/$defs/provenance"
            },
            {
              "type": "null"
            }
          ]
        },
        "selectedBlockId": {
          "type": [
            "string",
            "null"
          ],
          "maxLength": 63
        },
        "revision": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        }
      }
    }
  }
};
});

__def("packages/page-contract/schema/page-patch-v2.schema.json", function (exports) {
  exports.default = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schema.buildy.tw/page-patch-v2.schema.json",
  "title": "Page patch page-patch/v2 — RFC 6902 JSON Patch on a page-spec/v2 document",
  "x-page-patch-profile": "page-patch/v2",
  "x-page-spec-version": "2.0.0",
  "description": "An edit of a page-spec/v2 document as an RFC 6902 JSON Patch: an ordered list of operations applied to a copy of the base page; one failing operation rejects the whole patch. Paths are pointers into the document (title, slug, locale, seo, blocks, blocks/<i>/props/...). The result must be a valid page-spec/v2 document; the host answers a failure with a list of { path, expected, got }. Blocks that no operation touches stay exactly as they are.",
  "x-limits": {
    "maxOps": 64,
    "maxPathLength": 200
  },
  "type": "array",
  "minItems": 1,
  "maxItems": 64,
  "items": {
    "$ref": "#/$defs/op"
  },
  "$defs": {
    "pointer": {
      "type": "string",
      "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
      "maxLength": 200
    },
    "op": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "op",
            "path",
            "value"
          ],
          "description": "Add value at path (blocks/- appends; blocks/<i> inserts before index i).",
          "properties": {
            "op": {
              "const": "add"
            },
            "path": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            },
            "value": {}
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "op",
            "path"
          ],
          "description": "Remove the value at path.",
          "properties": {
            "op": {
              "const": "remove"
            },
            "path": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "op",
            "path",
            "value"
          ],
          "description": "Replace the value at path.",
          "properties": {
            "op": {
              "const": "replace"
            },
            "path": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            },
            "value": {}
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "op",
            "path",
            "from"
          ],
          "description": "Move the value at from to path (reorder blocks).",
          "properties": {
            "op": {
              "const": "move"
            },
            "path": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            },
            "from": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "op",
            "path",
            "from"
          ],
          "description": "Copy the value at from to path.",
          "properties": {
            "op": {
              "const": "copy"
            },
            "path": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            },
            "from": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "op",
            "path",
            "value"
          ],
          "description": "Fail the whole patch unless the value at path equals value.",
          "properties": {
            "op": {
              "const": "test"
            },
            "path": {
              "type": "string",
              "pattern": "^/(?:title|slug|locale|seo(?:/(?:title|description))?|blocks(?:/(?:[0-9]{1,2}|-)(?:/(?:id|item|variant|props(?:/[^/]{1,48}){0,12}))?)?)$",
              "maxLength": 200
            },
            "value": {}
          }
        }
      ]
    }
  }
};
});

__def("packages/page-contract/schema/page-spec.schema.json", function (exports) {
  exports.default = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schema.buildy.tw/page-spec.schema.json",
  "title": "Page spec page-spec/v1 — a page as Stock catalog blocks with their copy",
  "x-page-spec-profile": "page-spec/v1",
  "x-page-spec-version": "1.5.0",
  "description": "The primary artifact of a BuildY page: an agent proposes it (propose_layout), the host validates it against the Stock catalog, saves it, and regenerates code from it for a UI8Kit target (Svelte today). History, edits (page-patch/v1) and rollback work on this JSON; code is never the source. Root: the page (identical to buildytech/chat Page DTO, layout.version 1: every saved page validates unchanged). $defs: provenance, record and store describe the browser page store. Not a Codex v0.4 entry. After the schema, consumers run x-program-checks (duplicate ids, block count, payload size). x-page-slots lists the copy keys each kind renders and the rows of list kinds; a saved page may hold other copy keys, a patch may only write slots.",
  "x-program-checks": [
    "duplicate_id",
    "too_many_blocks",
    "too_large"
  ],
  "x-host-checks": [
    "props_invalid"
  ],
  "x-limits": {
    "maxBlocks": 64,
    "maxDepth": 4,
    "maxIdLength": 63,
    "maxSlugLength": 48,
    "maxTitleLength": 160,
    "maxSummaryLength": 500,
    "maxCopyLength": 2000,
    "maxSeoLength": 200,
    "maxLocaleLength": 16,
    "maxJsonChars": 65536,
    "maxDatetimeLength": 40
  },
  "x-page-slots": {
    "nav": {
      "copy": [
        "brand",
        "badge"
      ],
      "items": {
        "kind": "nav-link",
        "max": 6,
        "fields": [
          "label",
          "group"
        ]
      }
    },
    "sidenav": {
      "copy": [
        "brand",
        "badge"
      ],
      "items": {
        "kind": "nav-link",
        "max": 8,
        "fields": [
          "label",
          "group"
        ]
      }
    },
    "bottomnav": {
      "copy": [
        "badge"
      ],
      "items": {
        "kind": "nav-link",
        "max": 5,
        "fields": [
          "label",
          "group"
        ]
      }
    },
    "hero": {
      "copy": [
        "eyebrow",
        "headline",
        "lede",
        "action",
        "badge"
      ]
    },
    "pagehead": {
      "copy": [
        "headline",
        "lede",
        "badge"
      ]
    },
    "overview": {
      "copy": [
        "lede",
        "badge"
      ],
      "items": {
        "kind": "metric",
        "max": 4,
        "fields": [
          "label",
          "value",
          "note"
        ]
      }
    },
    "metrics": {
      "copy": [
        "lede",
        "badge"
      ],
      "items": {
        "kind": "metric",
        "max": 6,
        "fields": [
          "label",
          "value",
          "note"
        ]
      }
    },
    "chart": {
      "copy": [
        "lede",
        "badge"
      ],
      "items": {
        "kind": "metric",
        "max": 12,
        "fields": [
          "label",
          "value",
          "note"
        ]
      }
    },
    "activity": {
      "copy": [
        "lede",
        "badge"
      ],
      "items": {
        "kind": "activity-item",
        "max": 8,
        "fields": [
          "label",
          "detail",
          "note"
        ]
      }
    },
    "features": {
      "copy": [
        "action",
        "href",
        "badge"
      ],
      "items": {
        "kind": "feature",
        "max": 6,
        "fields": [
          "label",
          "detail",
          "icon"
        ]
      }
    },
    "menu": {
      "copy": [
        "badge"
      ],
      "items": {
        "kind": "dish",
        "max": 8,
        "fields": [
          "label",
          "detail"
        ]
      }
    },
    "hours": {
      "copy": [
        "days",
        "address",
        "badge"
      ]
    },
    "cta": {
      "copy": [
        "lede",
        "action",
        "note",
        "badge"
      ]
    },
    "footer": {
      "copy": [
        "contact",
        "legal",
        "badge"
      ]
    },
    "nav-link": {
      "copy": [
        "eyebrow",
        "badge"
      ]
    },
    "feature": {
      "copy": [
        "icon",
        "badge"
      ]
    },
    "dish": {
      "copy": [
        "badge"
      ]
    },
    "metric": {
      "copy": [
        "value",
        "note",
        "badge"
      ]
    },
    "activity-item": {
      "copy": [
        "note",
        "badge"
      ]
    }
  },
  "$ref": "#/$defs/page",
  "$defs": {
    "safeText": {
      "type": "string",
      "description": "Plain text. Rejected (parsePage codes): control characters other than tab, LF and CR, and any of < > { } (unsafe_text); a value that starts with javascript:, data:, vbscript: or file: even with whitespace or control characters between the letters (unsafe_url); a value that starts with <scheme>:// other than http(s) (unsafe_url). mailto: is allowed. Prose with a colon (`Hours: 11:00`) is not a URL.",
      "pattern": "^[^<>{}\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]*$",
      "not": {
        "anyOf": [
          {
            "pattern": "^[\\u0000-\\u0020]*[jJ][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*[vV][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*[sS][\\u0000-\\u0020]*[cC][\\u0000-\\u0020]*[rR][\\u0000-\\u0020]*[iI][\\u0000-\\u0020]*[pP][\\u0000-\\u0020]*[tT][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^[\\u0000-\\u0020]*[dD][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*[tT][\\u0000-\\u0020]*[aA][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^[\\u0000-\\u0020]*[vV][\\u0000-\\u0020]*[bB][\\u0000-\\u0020]*[sS][\\u0000-\\u0020]*[cC][\\u0000-\\u0020]*[rR][\\u0000-\\u0020]*[iI][\\u0000-\\u0020]*[pP][\\u0000-\\u0020]*[tT][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^[\\u0000-\\u0020]*[fF][\\u0000-\\u0020]*[iI][\\u0000-\\u0020]*[lL][\\u0000-\\u0020]*[eE][\\u0000-\\u0020]*:"
          },
          {
            "pattern": "^\\s*(?![hH][tT][tT][pP][sS]?://)[A-Za-z][A-Za-z0-9+.\\-]*://"
          }
        ]
      }
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{0,62}$",
      "maxLength": 63,
      "description": "Lowercase ASCII id, unique in the whole page (page id included; checked by the program: duplicate_id). Safe in generated code (data-block-id)."
    },
    "kind": {
      "enum": [
        "nav",
        "nav-link",
        "hero",
        "features",
        "feature",
        "menu",
        "dish",
        "hours",
        "cta",
        "footer",
        "pagehead",
        "overview",
        "metrics",
        "metric",
        "chart",
        "activity",
        "activity-item",
        "sidenav",
        "bottomnav"
      ],
      "description": "Renderer kind a Stock catalog block maps onto."
    },
    "copy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "eyebrow": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "headline": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "lede": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "action": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "note": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "brand": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "contact": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "legal": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "days": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "address": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "value": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "badge": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        "icon": {
          "type": "string",
          "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          "maxLength": 64,
          "description": "Lucide icon name; the host checks it against the Lucide set of its pinned registry snapshot."
        },
        "href": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            },
            {
              "pattern": "^(?:#|/|https?://|mailto:)"
            }
          ],
          "maxLength": 2000,
          "description": "Link of the block action: #fragment, /path, http(s) URL or mailto."
        }
      },
      "description": "Copy of a block by closed key. Which keys a kind renders: x-page-slots."
    },
    "catalogBlock": {
      "type": "string",
      "pattern": "^block\\.[a-z0-9]+(?:-[a-z0-9]+)*$",
      "maxLength": 80,
      "description": "Stock catalog block asset the block was built from (block.<name>, the spec of the catalog block index). Optional (1.1.0). The host rejects a block its pinned catalog does not have."
    },
    "variant": {
      "type": "string",
      "pattern": "^[A-Za-z][A-Za-z0-9-]*$",
      "maxLength": 40,
      "description": "Catalog variant of catalogBlock (block.<name>/<variant> is the catalog asset id); the host renders the registry organism with the variant's props. Optional (1.1.0). The host rejects a variant its pinned catalog does not have."
    },
    "propValue": {
      "description": "A props override value (1.3.0): plain JSON (strings are safe text); the host checks it against the props schema of the block's registry item.",
      "anyOf": [
        {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 2000
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        },
        {
          "type": "array",
          "maxItems": 24,
          "items": {
            "$ref": "#/$defs/propValue"
          }
        },
        {
          "type": "object",
          "maxProperties": 32,
          "propertyNames": {
            "pattern": "^[A-Za-z][A-Za-z0-9_]{0,47}$"
          },
          "additionalProperties": {
            "$ref": "#/$defs/propValue"
          }
        }
      ]
    },
    "props": {
      "type": "object",
      "maxProperties": 64,
      "propertyNames": {
        "pattern": "^(?:/(?:[A-Za-z][A-Za-z0-9_]{0,47}|[0-9]{1,2}))+$",
        "maxLength": 200
      },
      "additionalProperties": {
        "$ref": "#/$defs/propValue"
      },
      "description": "Props overrides of a top-level block (1.3.0, optional): JSON Pointer of a prop of the registry item its catalog variant renders (registry.buildy.tw/props/v0.json: /actions/secondary, /content/card/title, /content/features) -> value. Merged over the variant preset and the page content (copy slots still carry the text they map); the host validates the merged props against the item's props schema (x-host-checks: props_invalid). Pointers do not overlap (no key is a prefix path of another)."
    },
    "block1": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "kind",
        "title",
        "summary"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "$ref": "#/$defs/kind"
        },
        "title": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 160,
          "minLength": 1,
          "pattern": "\\S"
        },
        "summary": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 500,
          "minLength": 1,
          "pattern": "\\S"
        },
        "catalogBlock": {
          "$ref": "#/$defs/catalogBlock"
        },
        "variant": {
          "$ref": "#/$defs/variant"
        },
        "copy": {
          "$ref": "#/$defs/copy"
        },
        "props": {
          "$ref": "#/$defs/props"
        },
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/block2"
          },
          "maxItems": 64
        }
      }
    },
    "block2": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "kind",
        "title",
        "summary"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "$ref": "#/$defs/kind"
        },
        "title": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 160,
          "minLength": 1,
          "pattern": "\\S"
        },
        "summary": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 500,
          "minLength": 1,
          "pattern": "\\S"
        },
        "catalogBlock": {
          "$ref": "#/$defs/catalogBlock"
        },
        "variant": {
          "$ref": "#/$defs/variant"
        },
        "copy": {
          "$ref": "#/$defs/copy"
        },
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/block3"
          },
          "maxItems": 64
        }
      }
    },
    "block3": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "kind",
        "title",
        "summary"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "$ref": "#/$defs/kind"
        },
        "title": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 160,
          "minLength": 1,
          "pattern": "\\S"
        },
        "summary": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 500,
          "minLength": 1,
          "pattern": "\\S"
        },
        "catalogBlock": {
          "$ref": "#/$defs/catalogBlock"
        },
        "variant": {
          "$ref": "#/$defs/variant"
        },
        "copy": {
          "$ref": "#/$defs/copy"
        },
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/block4"
          },
          "maxItems": 64
        }
      }
    },
    "block4": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "kind",
        "title",
        "summary"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "$ref": "#/$defs/kind"
        },
        "title": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 160,
          "minLength": 1,
          "pattern": "\\S"
        },
        "summary": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 500,
          "minLength": 1,
          "pattern": "\\S"
        },
        "catalogBlock": {
          "$ref": "#/$defs/catalogBlock"
        },
        "variant": {
          "$ref": "#/$defs/variant"
        },
        "copy": {
          "$ref": "#/$defs/copy"
        },
        "children": {
          "type": "array",
          "maxItems": 0,
          "description": "Depth 4 is the deepest level (too_deep)."
        }
      }
    },
    "page": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "slug",
        "status",
        "title",
        "layout",
        "seo",
        "locale",
        "createdAt",
        "updatedAt"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "slug": {
          "type": "string",
          "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          "minLength": 1,
          "maxLength": 48,
          "description": "Ordinary page slug, no query or UTM variants."
        },
        "status": {
          "enum": [
            "draft",
            "pending",
            "scheduled",
            "published",
            "archived",
            "trashed"
          ],
          "description": "Lifecycle. A new draft has status draft."
        },
        "title": {
          "allOf": [
            {
              "$ref": "#/$defs/safeText"
            }
          ],
          "maxLength": 160,
          "minLength": 1,
          "pattern": "\\S"
        },
        "layout": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "version",
            "blocks"
          ],
          "properties": {
            "version": {
              "const": 1
            },
            "blocks": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/block1"
              },
              "maxItems": 64,
              "description": "Blocks in render order. Code (page.svelte + one file per block) is generated from this tree."
            }
          }
        },
        "seo": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "title": {
              "allOf": [
                {
                  "$ref": "#/$defs/safeText"
                }
              ],
              "maxLength": 200
            },
            "description": {
              "allOf": [
                {
                  "$ref": "#/$defs/safeText"
                }
              ],
              "maxLength": 200
            }
          }
        },
        "locale": {
          "type": "string",
          "pattern": "^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$",
          "maxLength": 16,
          "description": "BCP 47 language of all copy."
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
          "maxLength": 40
        },
        "updatedAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
          "maxLength": 40
        }
      }
    },
    "provenance": {
      "type": "object",
      "additionalProperties": false,
      "description": "Where a saved spec came from. screenId is the Stock catalog screen the blocks were assembled from (null = not recorded).",
      "properties": {
        "screenId": {
          "type": [
            "string",
            "null"
          ],
          "maxLength": 200
        },
        "scenarioId": {
          "enum": [
            "dashboard",
            "landing",
            "website",
            null
          ]
        },
        "missing": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 200
          },
          "description": "Catalog block labels of the screen that the host cannot render."
        },
        "assembler": {
          "type": "string",
          "maxLength": 80
        },
        "family": {
          "enum": [
            "dashboard",
            "landing",
            "food-grill",
            "restaurant",
            "generic",
            null
          ],
          "description": "1.4.0, optional, advisory: the page's screen family, derived from its composition after every operation (role majority; mixed -> generic) unless familyPinned. Never rejects a block."
        },
        "familyPinned": {
          "type": "boolean",
          "description": "1.4.0, optional: the author pinned family; the host stops deriving it until the pin is reset."
        }
      }
    },
    "record": {
      "type": "object",
      "additionalProperties": false,
      "description": "One chat's pages in the browser store: the applied page, the pending candidate and the last proposal, each with its provenance.",
      "properties": {
        "applied": {
          "anyOf": [
            {
              "$ref": "#/$defs/page"
            },
            {
              "type": "null"
            }
          ]
        },
        "candidate": {
          "anyOf": [
            {
              "$ref": "#/$defs/page"
            },
            {
              "type": "null"
            }
          ]
        },
        "lastProposed": {
          "anyOf": [
            {
              "$ref": "#/$defs/page"
            },
            {
              "type": "null"
            }
          ]
        },
        "appliedProvenance": {
          "anyOf": [
            {
              "$ref": "#/$defs/provenance"
            },
            {
              "type": "null"
            }
          ]
        },
        "candidateProvenance": {
          "anyOf": [
            {
              "$ref": "#/$defs/provenance"
            },
            {
              "type": "null"
            }
          ]
        },
        "lastProposedProvenance": {
          "anyOf": [
            {
              "$ref": "#/$defs/provenance"
            },
            {
              "type": "null"
            }
          ]
        },
        "selectedBlockId": {
          "type": [
            "string",
            "null"
          ],
          "maxLength": 63
        },
        "revision": {
          "type": [
            "integer",
            "null"
          ],
          "minimum": 0
        }
      }
    },
    "store": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "version",
        "pages"
      ],
      "description": "The browser page store blob (localStorage key buildy:v1:pages; before session buildy:v1 the key buildytech-creator-pages-v1, migrated once): pages by chat id.",
      "properties": {
        "version": {
          "const": 1
        },
        "pages": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/$defs/record"
          }
        }
      }
    }
  }
};
});

__def("packages/page-contract/src/v2.ts", function (exports) {
const pageSpecV2Schema = __req("packages/page-contract/schema/page-spec-v2.schema.json").default;
const pagePatchV2Schema = __req("packages/page-contract/schema/page-patch-v2.schema.json").default;
const pageSpecSchema = __req("packages/page-contract/schema/page-spec.schema.json").default;
const { SchemaRegistry } = __req("packages/page-contract/src/json-schema.ts");
class PageContractError extends Error {
	code: string;
	path: string;

	constructor(code: string, path: string, message: string) {
		super(`${code} at ${path}: ${message}`);
		this.name = "PageContractError";
		this.code = code;
		this.path = path;
	}
}

const PAGE_SPEC_V2_SCHEMA_URL = "https://schema.buildy.tw/page-spec-v2.schema.json";
const PAGE_PATCH_V2_SCHEMA_URL = "https://schema.buildy.tw/page-patch-v2.schema.json";
const PAGE_DOCUMENT_VERSION = 2 as const;

const PAGE_V2_LIMITS = (pageSpecV2Schema as { "x-limits": { maxBlocks: number; maxJsonChars: number; maxDepth: number; maxIdLength: number; maxListItems: number; maxPropKeys: number } })["x-limits"];
const PAGE_PATCH_V2_LIMITS = (pagePatchV2Schema as { "x-limits": { maxOps: number } })["x-limits"];

const registry = new SchemaRegistry();
registry.add(pageSpecSchema as Record<string, unknown>);
registry.add(pageSpecV2Schema as Record<string, unknown>);
registry.add(pagePatchV2Schema as Record<string, unknown>);

function pageV2Issues(input: unknown): SchemaIssue[] {
	return registry.check(input, PAGE_SPEC_V2_SCHEMA_URL);
}

/** Schema issues against a page-spec/v2 $def (block, props, record, ...). */
function pageV2DefIssues(input: unknown, def: "block" | "props" | "record" | "page"): SchemaIssue[] {
	return registry.check(input, `${PAGE_SPEC_V2_SCHEMA_URL}#/$defs/${def}`);
}

/** Schema issues of an RFC 6902 page patch. */
function pagePatchV2Issues(input: unknown): SchemaIssue[] {
	return registry.check(input, PAGE_PATCH_V2_SCHEMA_URL);
}

function depthOf(value: unknown, depth = 0): number {
	if (value === null || typeof value !== "object") return depth;
	const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
	return children.reduce<number>((max, child) => Math.max(max, depthOf(child, depth + 1)), depth);
}

/** Program checks (x-program-checks) after the schema: duplicate ids, block count, size, props depth. */
function pageV2ProgramIssues(page: PageV2): SchemaIssue[] {
	const out: SchemaIssue[] = [];
	const seen = new Set<string>();
	if (page.id) seen.add(page.id);
	page.blocks.forEach((block, index) => {
		if (seen.has(block.id)) out.push({ path: `$.blocks[${index}].id`, keyword: "duplicate_id", expected: "an id no other block (or the page) uses" });
		seen.add(block.id);
		if (block.props && depthOf(block.props) > PAGE_V2_LIMITS.maxDepth) out.push({ path: `$.blocks[${index}].props`, keyword: "too_deep", expected: `props nested at most ${PAGE_V2_LIMITS.maxDepth} levels` });
	});
	if (page.blocks.length > PAGE_V2_LIMITS.maxBlocks) out.push({ path: "$.blocks", keyword: "too_many_blocks", expected: `at most ${PAGE_V2_LIMITS.maxBlocks} blocks` });
	if (JSON.stringify(page).length > PAGE_V2_LIMITS.maxJsonChars) out.push({ path: "$", keyword: "too_large", expected: `at most ${PAGE_V2_LIMITS.maxJsonChars} characters of JSON` });
	return out;
}

/** Strict gate of a page-spec/v2 document: the published schema, then the program checks (throws PageContractError). */
function parsePageV2(input: unknown): PageV2 {
	const issues = pageV2Issues(input);
	if (issues.length) throw new PageContractError("page_spec_invalid", issues[0]!.path, `page-spec/v2 ${issues[0]!.keyword} failed`);
	const page = input as PageV2;
	const program = pageV2ProgramIssues(page);
	if (program.length) throw new PageContractError(program[0]!.keyword, program[0]!.path, `page-spec/v2 ${program[0]!.keyword}`);
	return page;
}

exports["PageContractError"] = PageContractError;
exports["PAGE_SPEC_V2_SCHEMA_URL"] = PAGE_SPEC_V2_SCHEMA_URL;
exports["PAGE_PATCH_V2_SCHEMA_URL"] = PAGE_PATCH_V2_SCHEMA_URL;
exports["PAGE_DOCUMENT_VERSION"] = PAGE_DOCUMENT_VERSION;
exports["PAGE_V2_LIMITS"] = PAGE_V2_LIMITS;
exports["PAGE_PATCH_V2_LIMITS"] = PAGE_PATCH_V2_LIMITS;
exports["pagePatchV2Schema"] = pagePatchV2Schema;
exports["pageSpecV2Schema"] = pageSpecV2Schema;
exports["pageV2Issues"] = pageV2Issues;
exports["pageV2DefIssues"] = pageV2DefIssues;
exports["pagePatchV2Issues"] = pagePatchV2Issues;
exports["pageV2ProgramIssues"] = pageV2ProgramIssues;
exports["parsePageV2"] = parsePageV2;

});

__def("packages/page-contract/src/block-contract.ts", function (exports) {




});

__def("packages/page-contract/src/index.ts", function (exports) {
exports["PAGE_BLOCK_KINDS"] = __req("packages/page-contract/src/types.ts")["PAGE_BLOCK_KINDS"];
exports["cloneJson"] = __req("packages/page-contract/src/clone.ts")["cloneJson"];
exports["SchemaRegistry"] = __req("packages/page-contract/src/json-schema.ts")["SchemaRegistry"];
exports["PageContractError"] = __req("packages/page-contract/src/v2.ts")["PageContractError"];
exports["PAGE_DOCUMENT_VERSION"] = __req("packages/page-contract/src/v2.ts")["PAGE_DOCUMENT_VERSION"];
exports["PAGE_PATCH_V2_LIMITS"] = __req("packages/page-contract/src/v2.ts")["PAGE_PATCH_V2_LIMITS"];
exports["PAGE_PATCH_V2_SCHEMA_URL"] = __req("packages/page-contract/src/v2.ts")["PAGE_PATCH_V2_SCHEMA_URL"];
exports["PAGE_SPEC_V2_SCHEMA_URL"] = __req("packages/page-contract/src/v2.ts")["PAGE_SPEC_V2_SCHEMA_URL"];
exports["PAGE_V2_LIMITS"] = __req("packages/page-contract/src/v2.ts")["PAGE_V2_LIMITS"];
exports["pagePatchV2Issues"] = __req("packages/page-contract/src/v2.ts")["pagePatchV2Issues"];
exports["pagePatchV2Schema"] = __req("packages/page-contract/src/v2.ts")["pagePatchV2Schema"];
exports["pageV2DefIssues"] = __req("packages/page-contract/src/v2.ts")["pageV2DefIssues"];
exports["pageV2Issues"] = __req("packages/page-contract/src/v2.ts")["pageV2Issues"];
exports["pageV2ProgramIssues"] = __req("packages/page-contract/src/v2.ts")["pageV2ProgramIssues"];
exports["pageSpecV2Schema"] = __req("packages/page-contract/src/v2.ts")["pageSpecV2Schema"];
exports["parsePageV2"] = __req("packages/page-contract/src/v2.ts")["parsePageV2"];
{ const __m = __req("packages/page-contract/src/block-contract.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }



});

__def("packages/builder-core/src/catalog/props-fill.ts", function (exports) {
const { cloneJson } = __req("packages/page-contract/src/index.ts");
const { SAMPLE_MINOR, isMoneyName } = __req("packages/builder-core/src/catalog/money.ts");
const { PLACEHOLDER_ICON, STRING_DEFAULTS, isObject, kindOf, lucideIcons, props, schemaAt, valueOf } = __req("packages/builder-core/src/catalog/props-schema.ts");
function coerceEnumValue(item: string, pointer: string, value: unknown): unknown {
	if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return value;
	const node = schemaAt(item, pointer);
	const options = node ? valueOf(node).enum : undefined;
	if (!Array.isArray(options) || options.includes(value)) return value;
	const match = options.find((option) => typeof option !== typeof value && option !== null && typeof option !== "object" && String(option) === String(value));
	return match === undefined ? value : match;
}

/**
 * Every enum value of a block's props in the schema's type (`coerceEnumValue` at each pointer, lists and records
 * included): the agent write path runs it on every block a write touches, as the Inspector does per field. Returns the
 * props (a copy only when something changed) and the pointers it changed, with the value before.
 */
function coerceEnumProps<T extends Record<string, unknown>>(item: string, value: T): { props: T; changed: Array<{ pointer: string; from: unknown; to: unknown }> } {
	const changed: Array<{ pointer: string; from: unknown; to: unknown }> = [];
	const copy = cloneJson(value);
	const visit = (parent: Record<string, unknown> | unknown[], key: string | number, pointer: string): void => {
		const node: unknown = Array.isArray(parent) ? parent[Number(key)] : parent[String(key)];
		if (Array.isArray(node)) node.forEach((_, index) => visit(node, index, `${pointer}/${index}`));
		else if (isObject(node)) for (const name of Object.keys(node)) visit(node, name, `${pointer}/${name.replace(/~/g, "~0").replace(/\//g, "~1")}`);
		else {
			const next = coerceEnumValue(item, pointer, node);
			if (next === node) return;
			changed.push({ pointer, from: node, to: next });
			if (Array.isArray(parent)) parent[Number(key)] = next;
			else parent[String(key)] = next;
		}
	};
	for (const name of Object.keys(copy)) visit(copy, name, `/${name.replace(/~/g, "~0").replace(/\//g, "~1")}`);
	return { props: changed.length ? copy : value, changed };
}

/**
 * A new row for the list prop at `pointer` (`/content/features`): every required field from the schema (defaults,
 * first enum value, readable placeholders "Title" / "Text", the placeholder icon), a fresh `id` when the row has one.
 * Null when the pointer is not a list of records.
 */
function newPropsListRow(item: string, pointer: string, taken: unknown[] = []): Record<string, unknown> | null {
	const node = schemaAt(item, pointer);
	if (!node) return null;
	const value = valueOf(node);
	if (value.type !== "array" || !isObject(value.items) || valueOf(value.items as JsonSchema).type !== "object") return null;
	const row = fill(value.items as JsonSchema, {}, 1, true);
	if (!isObject(row)) return null;
	if (typeof row.id === "string") {
		const ids = new Set(taken.map((entry) => (isObject(entry) ? entry.id : undefined)));
		let n = taken.length + 1;
		while (ids.has(`item-${n}`)) n += 1;
		row.id = `item-${n}`;
	}
	return row;
}

function plainEntry(entry: JsonSchema, n: number, taken: unknown[]): string | number | boolean | undefined {
	if (Array.isArray(entry.enum)) {
		const members = entry.enum as unknown[];
		const free = members.find((member) => !taken.includes(member)) ?? members[0];
		return typeof free === "string" || typeof free === "number" || typeof free === "boolean" ? free : undefined;
	}
	if (entry.type === "number" || entry.type === "integer") return typeof entry.minimum === "number" ? entry.minimum : 0;
	if (entry.type === "boolean") return false;
	if (entry.type === "string") {
		const text = `Item ${n}`;
		return typeof entry.maxLength === "number" ? text.slice(0, entry.maxLength) : text;
	}
	return undefined;
}

/**
 * A new entry for the list of plain values at `pointer` (`/plan/features`): the first enum member not used yet, 0, false,
 * or a readable "Item n" for text (cut to the schema's maxLength). Undefined when the pointer is not a list of plain values.
 */
function newPropsListValue(item: string, pointer: string, taken: unknown[] = []): string | number | boolean | undefined {
	const node = schemaAt(item, pointer);
	if (!node) return undefined;
	const list = valueOf(node);
	if (list.type !== "array" || !isObject(list.items)) return undefined;
	return plainEntry(valueOf(list.items as JsonSchema), taken.length + 1, taken);
}

/** A new value for the free-form map at `pointer` (`/badges`), as a new list entry is made; undefined when it is not such a map. */
function newPropsMapValue(item: string, pointer: string, taken: unknown[] = []): string | number | boolean | undefined {
	const node = schemaAt(item, pointer);
	if (!node) return undefined;
	const map = valueOf(node);
	if (map.type !== "object" || isObject(map.properties) || !isObject(map.additionalProperties)) return undefined;
	return plainEntry(valueOf(map.additionalProperties as JsonSchema), taken.length + 1, taken);
}

/** The keys a page may write inside props (`propertyNames` of the page-spec v2 schema: a letter first, then letters, digits, `_`; 48 at most). */
const PAGE_KEY_PATTERN = "^[A-Za-z][A-Za-z0-9_]{0,47}$";

/** Why a key cannot name an entry of a map (non-empty, unique, a key a page may write, matches the schema's pattern), or null when it can. */
function mapKeyIssue(key: string, others: string[], pattern?: string): "empty_key" | "duplicate_key" | "bad_key" | null {
	if (!key.trim()) return "empty_key";
	if (others.includes(key)) return "duplicate_key";
	if (key === "__proto__" || key === "constructor" || key === "prototype") return "bad_key";
	if (!new RegExp(PAGE_KEY_PATTERN).test(key)) return "bad_key";
	if (pattern) {
		try {
			if (!new RegExp(pattern, "u").test(key)) return "bad_key";
		} catch {
			return null;
		}
	}
	return null;
}

/** "addToCart" -> "Add to cart": a readable placeholder for a required label the content does not fill. */
function humanizeName(name: string): string {
	const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The smallest valid value of a required prop: the schema default, else the first enum value, else by type. */
function defaultFor(node: JsonSchema, name: string, depth: number, blank: boolean, rows = 0): unknown {
	if (node.default !== undefined) return cloneJson(node.default);
	const value = valueOf(node);
	if (value.default !== undefined) return cloneJson(value.default);
	if (kindOf(node) === "icon") {
		const icons = lucideIcons();
		return icons.includes(PLACEHOLDER_ICON) ? PLACEHOLDER_ICON : icons[0];
	}
	if (Array.isArray(value.enum)) return cloneJson(value.enum[0]);
	if (value.type === "string") return STRING_DEFAULTS[name] ?? (blank && rows === 0 ? "" : humanizeName(name));
	if (value.type === "number" || value.type === "integer") return 0;
	if (value.type === "boolean") return false;
	if (value.type === "array") return rows > 0 && depth < 8 ? placeholderRows(value, name, depth, rows) : [];
	if (value.type === "object" && depth < 8) return fill(value, {}, depth + 1, blank, rows);
	return undefined;
}

/**
 * A new block's required list starts with a few neutral rows (English "Label 1", ISO currency, the neutral icon) so the
 * block shows something; the row schema decides the shape. Nested lists inside a row stay empty.
 */
function placeholderRows(list: JsonSchema, name: string, depth: number, rows: number): unknown[] {
	const count = Math.min(typeof list.maxItems === "number" ? list.maxItems : rows, Math.max(rows, typeof list.minItems === "number" ? list.minItems : 0));
	const items = isObject(list.items) ? list.items : null;
	const entry = items ? valueOf(items) : null;
	const word = humanizeName(name.replace(/s$/, ""));
	return Array.from({ length: count }, (_, index) => {
		const n = index + 1;
		if (!entry) return `${word} ${n}`;
		if (entry.type === "string") return Array.isArray(entry.enum) ? entry.enum[0] : `${word} ${n}`;
		if (entry.type !== "object") return defaultFor(items!, name, depth + 1, false);
		const row = fill(entry, {}, depth + 1, false);
		if (!isObject(row)) return row;
		const properties = isObject(entry.properties) ? entry.properties : {};
		for (const [field, value] of Object.entries(row)) {
			const schema = properties[field];
			if (field === "id") row[field] = `${name}-${n}`;
			else if (typeof value === "string" && value !== "" && isObject(schema) && kindOf(schema) === "text" && STRING_DEFAULTS[field] === undefined) row[field] = `${value} ${n}`;
		}
		return row;
	});
}

function fill(node: JsonSchema, current: unknown, depth: number, blank: boolean, rows = 0): unknown {
	const value = valueOf(node);
	if (value.type === "array" && Array.isArray(current) && isObject(value.items)) {
		return current.map((entry) => fill(value.items as JsonSchema, entry, depth + 1, blank));
	}
	if (value.type !== "object" || !isObject(current) || "$" in current || depth > 8) return current;
	const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : {};
	const required = Array.isArray(value.required) ? (value.required as string[]) : [];
	const out: Record<string, unknown> = {};
	for (const name of required) {
		if (current[name] !== undefined || !properties[name]) continue;
		const fallback = defaultFor(properties[name]!, name, depth, blank, rows);
		// A money prop beside a currency starts from a sample amount in minor units (not 0: "$0"); a blank write keeps 0.
		if (fallback === 0 && !blank && isMoneyName(name) && "currency" in properties) out[name] = SAMPLE_MINOR;
		else if (fallback !== undefined) out[name] = fallback;
	}
	for (const [name, inner] of Object.entries(current)) out[name] = properties[name] ? fill(properties[name]!, inner, depth + 1, blank, rows) : inner;
	return out;
}

/**
 * Required props (and required fields of every record and object present) filled from the schema: its `default`,
 * the first enum value, or the smallest value of the type. Values that are present are kept as they are, so the
 * validator still sees what the variant and the page content set.
 */
function fillProps(item: string, value: Record<string, unknown>, options: { blank?: boolean; rows?: number } = {}): Record<string, unknown> {
	const schema = props.items[item]?.schema;
	if (!schema) return value;
	return fill(schema, value, 0, options.blank === true, options.rows ?? 0) as Record<string, unknown>;
}

exports["coerceEnumValue"] = coerceEnumValue;
exports["coerceEnumProps"] = coerceEnumProps;
exports["newPropsListRow"] = newPropsListRow;
exports["newPropsListValue"] = newPropsListValue;
exports["newPropsMapValue"] = newPropsMapValue;
exports["PAGE_KEY_PATTERN"] = PAGE_KEY_PATTERN;
exports["mapKeyIssue"] = mapKeyIssue;
exports["humanizeName"] = humanizeName;
exports["fillProps"] = fillProps;

});

__def("packages/builder-core/src/catalog/view-map.ts", function (exports) {
const { viewMapFor } = __req("packages/builder-core/src/catalog/props-schema.ts");
function viewMapOf(item: string): ViewMap | null {
	return viewMapFor(item);
}

/** A concrete pointer (`/features/2/title`) split into its map key (`/features/[]/title`) and the list rows it indexes. */
function mapKey(pointer: string): { key: string; rows: Array<{ list: string; index: number }> } {
	const rows: Array<{ list: string; index: number }> = [];
	let key = "";
	for (const seg of pointer.split("/").slice(1)) {
		if (/^\d+$/.test(seg)) {
			rows.push({ list: key, index: Number(seg) });
			key += "/[]";
		} else key += `/${seg}`;
	}
	return { key, rows };
}

/** The leaf value a pointer reads from props as a string, or undefined when it is missing or not a primitive. */
function valueAt(props: unknown, pointer: string): string | undefined {
	let cur: unknown = props;
	for (const seg of pointer.split("/").slice(1)) {
		if (cur == null || typeof cur !== "object") return undefined;
		cur = /^\d+$/.test(seg) ? (cur as unknown[])[Number(seg)] : (cur as Record<string, unknown>)[seg];
	}
	return typeof cur === "string" || typeof cur === "number" || typeof cur === "boolean" ? String(cur) : undefined;
}

/** Every concrete field pointer the map holds given the props (list keys expanded over the lists actually present). */
function mappedPointers(map: ViewMap, props: unknown): string[] {
	const out: string[] = [];
	for (const key of Object.keys(map.fields)) {
		let prefixes: Array<{ ptr: string; ctx: unknown }> = [{ ptr: "", ctx: props }];
		for (const seg of key.split("/").slice(1)) {
			const next: Array<{ ptr: string; ctx: unknown }> = [];
			for (const { ptr, ctx } of prefixes) {
				if (seg === "[]") {
					if (Array.isArray(ctx)) for (let i = 0; i < ctx.length; i++) next.push({ ptr: `${ptr}/${i}`, ctx: ctx[i] });
				} else {
					const ctxObj = ctx != null && typeof ctx === "object" ? (ctx as Record<string, unknown>) : undefined;
					next.push({ ptr: `${ptr}/${seg}`, ctx: ctxObj ? ctxObj[seg] : undefined });
				}
			}
			prefixes = next;
		}
		for (const { ptr } of prefixes) out.push(ptr);
	}
	return out;
}

const slotOf = (el: ViewElement): string | null => el.getAttribute("data-slot");
const text = (el: ViewElement): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();

/** Elements at or below `el` whose `data-slot` is `slot`, outermost only (a match is not searched for nested matches). */
function withSlot(el: ViewElement, slot: string, out: ViewElement[] = []): ViewElement[] {
	if (slotOf(el) === slot) {
		out.push(el);
		return out;
	}
	for (const child of el.children) withSlot(child, slot, out);
	return out;
}

/** The row elements of a list under a scope: the outermost descendants that carry one of the list's row slots. */
function rowsUnder(scope: ViewElement, slots: string[], out: ViewElement[] = []): ViewElement[] {
	if (slots.includes(slotOf(scope) ?? "\0")) {
		out.push(scope);
		return out;
	}
	for (const child of scope.children) rowsUnder(child, slots, out);
	return out;
}

/** The scope a field sits in: the block root, then into each list row the pointer indexes. Null if a row is missing. */
function rowScope(root: ViewElement, map: ViewMap, rows: Array<{ list: string; index: number }>): ViewElement | null {
	let scope = root;
	for (const { list, index } of rows) {
		const slots = map.rows[list];
		if (!slots || slots.length === 0) return null;
		const row = rowsUnder(scope, slots)[index];
		if (!row) return null;
		scope = row;
	}
	return scope;
}

/** The row elements of a (concrete) list pointer in a rendered block, in document order. */
function listRows(root: ViewElement, map: ViewMap, pointer: string): ViewElement[] {
	const { key, rows } = mapKey(pointer);
	const scope = rowScope(root, map, rows);
	const slots = map.rows[key];
	if (!scope || !slots || slots.length === 0) return [];
	return rowsUnder(scope, slots);
}

/** Candidate elements of one place within a scope: narrowed by `in`, then its own slot `s`, else the frame or the scope. */
function placeElements(scope: ViewElement, place: ViewField): ViewElement[] {
	const frames = place.in ? withSlot(scope, place.in) : [scope];
	const out: ViewElement[] = [];
	for (const frame of frames) {
		if (place.s) out.push(...withSlot(frame, place.s));
		else out.push(frame);
	}
	return out;
}

const iconName = (el: ViewElement): string | null => {
	const cls = el.getAttribute("class") ?? "";
	const hit = cls.match(/\blucide-([a-z0-9-]+)/);
	return hit ? hit[1]! : el.getAttribute("data-icon") ?? el.getAttribute("data-lucide");
};

/** The value a place shows on an element: an attribute, a Lucide icon name, or its (whitespace-collapsed) text. */
function shown(el: ViewElement, place: ViewField): string | null {
	if (place.k === "attr") return place.a ? el.getAttribute(place.a) : null;
	if (place.k === "icon") return iconName(el);
	return text(el);
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * The element of a rendered block that shows `pointer`, or null. Among the pointer's places, the first whose element
 * exists; when the value is a known non-empty string (a text, html or attribute), the element whose rendered value is
 * or contains it, so sibling variants and repeats disambiguate. A pointer the current props do not render has no element.
 */
function locateField(root: ViewElement, map: ViewMap, props: unknown, pointer: string): ViewElement | null {
	const { key, rows } = mapKey(pointer);
	const places = map.fields[key];
	if (!places) return null;
	const scope = rowScope(root, map, rows);
	if (!scope) return null;
	const want = valueAt(props, pointer);
	const strict = want != null && want !== "" && typeof want === "string";
	let fallback: ViewElement | null = null;
	for (const place of places) {
		for (const el of placeElements(scope, place)) {
			const v = shown(el, place);
			if (strict && (place.k === "text" || place.k === "html" || place.k === "attr") && v != null) {
				const a = norm(v);
				const b = norm(want);
				if (a === b || (place.k !== "attr" && b.length > 0 && a.includes(b))) return el;
			}
			// A fallback element must actually bear a value (a non-empty text, a present attribute, a resolved icon),
			// so a place the current props do not render does not claim the scope.
			if (!fallback && v != null && v !== "") fallback = el;
		}
	}
	return fallback;
}

const contains = (a: ViewElement, b: ViewElement): boolean => {
	if (a === b) return true;
	for (const child of a.children) if (contains(child, b)) return true;
	return false;
};

/**
 * The pointer whose element the target is in, or null. The best match is the one whose element is the smallest (a field
 * before the row or the list that holds it); on one element a shown text before an attribute or an icon.
 */
function fieldAtElement(root: ViewElement, map: ViewMap, props: unknown, target: ViewElement): string | null {
	const rank = (pointer: string): number => {
		const places = map.fields[mapKey(pointer).key];
		if (!places) return 3;
		return places.some((p) => p.k === "text" || p.k === "html") ? 0 : places.some((p) => p.k === "icon") ? 1 : 2;
	};
	let best: { pointer: string; el: ViewElement; rank: number } | null = null;
	for (const pointer of mappedPointers(map, props)) {
		const el = locateField(root, map, props, pointer);
		if (!el || !contains(el, target)) continue;
		const r = rank(pointer);
		if (!best || (best.el !== el && contains(best.el, el)) || (best.el === el && r < best.rank)) best = { pointer, el, rank: r };
	}
	return best?.pointer ?? null;
}

exports["viewMapOf"] = viewMapOf;
exports["mapKey"] = mapKey;
exports["valueAt"] = valueAt;
exports["mappedPointers"] = mappedPointers;
exports["listRows"] = listRows;
exports["locateField"] = locateField;
exports["fieldAtElement"] = fieldAtElement;

});

__def("packages/builder-core/src/brief.ts", function (exports) {
const { SCENARIO_IDS } = __req("packages/builder-core/src/copy.ts");
function isScenarioId(value: unknown): value is ScenarioId {
	return typeof value === "string" && (SCENARIO_IDS as string[]).includes(value);
}

exports["isScenarioId"] = isScenarioId;

});

__def("packages/builder-core/src/policy.ts", function (exports) {

const ALLOWED_TOOLS = ["list_blocks", "get_block", "get_page", "write_page"] as const;


exports["ALLOWED_TOOLS"] = ALLOWED_TOOLS;

});

__def("packages/builder-core/src/catalog/lucide-aliases.json", function (exports) {
  exports.default = {
 "activitysquare": "square-activity",
 "alarmcheck": "alarm-clock-check",
 "alarmminus": "alarm-clock-minus",
 "alarmplus": "alarm-clock-plus",
 "album": "square-bookmark",
 "alertcircle": "circle-exclamation-point",
 "alertoctagon": "octagon-exclamation-point",
 "alerttriangle": "triangle-exclamation-point",
 "aligncenter": "text-align-center",
 "alignjustify": "text-align-justify",
 "alignleft": "text-align-start",
 "alignright": "text-align-end",
 "angry": "face-angry",
 "annoyed": "face-expressionless",
 "archiverestore": "archive-arrow-up",
 "areachart": "chart-area",
 "arrowdowncircle": "circle-arrow-down",
 "arrowdownleftfromcircle": "circle-arrow-down-left-exit",
 "arrowdownleftfromsquare": "square-arrow-down-left-exit",
 "arrowdownleftsquare": "square-arrow-down-left",
 "arrowdownrightfromcircle": "circle-arrow-down-right-exit",
 "arrowdownrightfromsquare": "square-arrow-down-right-exit",
 "arrowdownrightsquare": "square-arrow-down-right",
 "arrowdownsquare": "square-arrow-down",
 "arrowleftcircle": "circle-arrow-left",
 "arrowleftsquare": "square-arrow-left",
 "arrowrightcircle": "circle-arrow-right",
 "arrowrightsquare": "square-arrow-right",
 "arrowupcircle": "circle-arrow-up",
 "arrowupleftfromcircle": "circle-arrow-up-left-exit",
 "arrowupleftfromsquare": "square-arrow-up-left-exit",
 "arrowupleftsquare": "square-arrow-up-left",
 "arrowuprightfromcircle": "circle-arrow-up-right-exit",
 "arrowuprightfromsquare": "square-arrow-up-right-exit",
 "arrowuprightsquare": "square-arrow-up-right",
 "arrowupsquare": "square-arrow-up",
 "asterisksquare": "square-asterisk",
 "badgealert": "badge-exclamation-point",
 "badgehelp": "badge-question-mark",
 "barchart": "chart-no-axes-column-increasing",
 "barchart2": "chart-no-axes-column",
 "barchart3": "chart-column",
 "barchart4": "chart-column-increasing",
 "barchartbig": "chart-column-big",
 "barcharthorizontal": "chart-bar",
 "barcharthorizontalbig": "chart-bar-big",
 "batterywarning": "battery-exclamation-point",
 "betweenhorizonalend": "between-horizontal-end",
 "betweenhorizonalstart": "between-horizontal-start",
 "bold": "letter-b",
 "bookalert": "book-exclamation-point",
 "bookmarked": "book-bookmark",
 "booktemplate": "book-dashed",
 "boxselect": "square-dashed",
 "building2": "building-complex",
 "candlestickchart": "chart-candlestick",
 "checkcircle": "circle-check-big",
 "checkcircle2": "circle-check",
 "checksquare": "square-check-big",
 "checksquare2": "square-check",
 "chevrondowncircle": "circle-chevron-down",
 "chevrondownsquare": "square-chevron-down",
 "chevronleftcircle": "circle-chevron-left",
 "chevronleftsquare": "square-chevron-left",
 "chevronrightcircle": "circle-chevron-right",
 "chevronrightsquare": "square-chevron-right",
 "chevronupcircle": "circle-chevron-up",
 "chevronupsquare": "square-chevron-up",
 "circlealert": "circle-exclamation-point",
 "circlearrowoutdownleft": "circle-arrow-down-left-exit",
 "circlearrowoutdownright": "circle-arrow-down-right-exit",
 "circlearrowoutupleft": "circle-arrow-up-left-exit",
 "circlearrowoutupright": "circle-arrow-up-right-exit",
 "circlehelp": "circle-question-mark",
 "circleparking": "circle-letter-p",
 "circleparkingoff": "circle-letter-p-off",
 "circleslashed": "circle-slash-2",
 "clipboardedit": "clipboard-pen",
 "clipboardsignature": "clipboard-pen-line",
 "clockalert": "clock-exclamation-point",
 "cloudalert": "cloud-exclamation-point",
 "code2": "code-xml",
 "codesquare": "square-code",
 "columns": "columns-2",
 "columnssettings": "columns-3-cog",
 "contact2": "contact-round",
 "copyright": "circle-letter-c",
 "curlybraces": "braces",
 "dividecircle": "circle-divide",
 "dividesquare": "square-divide",
 "dotsquare": "square-dot",
 "downloadcloud": "cloud-download",
 "edit": "square-pen",
 "edit2": "pen",
 "edit3": "pen-line",
 "equalsquare": "square-equal",
 "fileaudio": "file-headphone",
 "fileaudio2": "file-headphone",
 "filebadge2": "file-badge",
 "filebarchart": "file-chart-column-increasing",
 "filebarchart2": "file-chart-column",
 "filecheck2": "file-check-corner",
 "filecode2": "file-code-corner",
 "filecog2": "file-cog",
 "fileedit": "file-pen",
 "filejson": "file-braces",
 "filejson2": "file-braces-corner",
 "filekey2": "file-key",
 "filelinechart": "file-chart-line",
 "filelock2": "file-lock",
 "fileminus2": "file-minus-corner",
 "filepiechart": "file-chart-pie",
 "fileplus2": "file-plus-corner",
 "filequestion": "file-question-mark",
 "filesearch2": "file-search-corner",
 "filesignature": "file-pen-line",
 "filetype2": "file-type-corner",
 "filevideo": "file-play",
 "filevideo2": "file-video-camera",
 "filevolume2": "file-signal",
 "filewarning": "file-exclamation-point",
 "filex2": "file-x-corner",
 "filter": "funnel",
 "filterx": "funnel-x",
 "fingerprint": "fingerprint-pattern",
 "fliphorizontal": "square-centerline-dashed-horizontal",
 "fliphorizontal2": "triangles-centerline-dashed-horizontal",
 "flipvertical": "square-centerline-dashed-vertical",
 "flipvertical2": "triangles-centerline-dashed-vertical",
 "foldercog2": "folder-cog",
 "folderedit": "folder-pen",
 "forkknife": "utensils",
 "forkknifecrossed": "utensils-crossed",
 "forminput": "rectangle-ellipsis",
 "frown": "face-slightly-frowning",
 "functionsquare": "square-function",
 "ganttchart": "chart-no-axes-gantt",
 "ganttchartsquare": "square-chart-gantt",
 "gaugecircle": "circle-gauge",
 "gitcommit": "git-commit-horizontal",
 "globe2": "earth",
 "grab": "hand-grab",
 "grid": "grid-3x3",
 "heading": "letter-h",
 "helpcircle": "circle-question-mark",
 "helpinghand": "hand-helping",
 "history": "rotate-ccw-clock",
 "home": "house",
 "icecream": "ice-cream-cone",
 "icecream2": "ice-cream-bowl",
 "indent": "list-indent-increase",
 "indentdecrease": "list-indent-decrease",
 "indentincrease": "list-indent-increase",
 "inspect": "square-mouse-pointer",
 "kanbansquare": "square-kanban",
 "kanbansquaredashed": "square-dashed-kanban",
 "laptop2": "laptop-minimal",
 "laugh": "face-grinning",
 "layers3": "layers",
 "layout": "panels-top-left",
 "lettertext": "text-initial",
 "librarysquare": "square-library",
 "linechart": "chart-line",
 "loader2": "loader-circle",
 "locationedit": "map-pin-pen",
 "mailalert": "mail-exclamation-point",
 "mailquestion": "mail-question-mark",
 "mailwarning": "mail-exclamation-point",
 "meh": "face-neutral",
 "menusquare": "square-menu",
 "messagecirclealert": "message-circle-exclamation-point",
 "messagecirclequestion": "message-circle-question-mark",
 "messagecirclewarning": "message-circle-exclamation-point",
 "messagesquarealert": "message-square-exclamation-point",
 "messagesquarewarning": "message-square-exclamation-point",
 "mic2": "mic-vocal",
 "minuscircle": "circle-minus",
 "minussquare": "square-minus",
 "morehorizontal": "ellipsis",
 "morevertical": "ellipsis-vertical",
 "mousepointersquaredashed": "square-dashed-mouse-pointer",
 "msquare": "square-letter-m",
 "music": "eighth-notes",
 "music2": "eighth-note",
 "music3": "half-note",
 "music4": "sixteenth-notes",
 "octagonalert": "octagon-exclamation-point",
 "outdent": "list-indent-decrease",
 "paintbrush2": "paintbrush-vertical",
 "palmtree": "tree-palm",
 "panelbottominactive": "panel-bottom-dashed",
 "panelleftinactive": "panel-left-dashed",
 "panelrightinactive": "panel-right-dashed",
 "panelsleftright": "columns-3",
 "panelstopbottom": "rows-3",
 "paneltopinactive": "panel-top-dashed",
 "parkingcircle": "circle-letter-p",
 "parkingcircleoff": "circle-letter-p-off",
 "parkingsquare": "square-letter-p",
 "parkingsquareoff": "square-letter-p-off",
 "pausecircle": "circle-pause",
 "pauseoctagon": "octagon-pause",
 "penbox": "square-pen",
 "pensquare": "square-pen",
 "percentcircle": "circle-percent",
 "percentdiamond": "diamond-percent",
 "percentsquare": "square-percent",
 "piechart": "chart-pie",
 "pilcrowsquare": "square-pilcrow",
 "pisquare": "square-pi",
 "playcircle": "circle-play",
 "playsquare": "square-play",
 "plugzap2": "plug-zap",
 "pluscircle": "circle-plus",
 "plussquare": "square-plus",
 "podcast": "mic-signal",
 "powercircle": "circle-power",
 "powersquare": "square-power",
 "rows": "rows-2",
 "scatterchart": "chart-scatter",
 "school2": "university",
 "scissorssquare": "square-scissors",
 "scissorssquaredashedbottom": "square-bottom-dashed-scissors",
 "searchalert": "search-exclamation-point",
 "sendhorizonal": "send-horizontal",
 "shieldalert": "shield-exclamation-point",
 "shieldclose": "shield-x",
 "shieldquestion": "shield-question-mark",
 "sidebar": "panel-left",
 "sidebarclose": "panel-left-close",
 "sidebaropen": "panel-left-open",
 "sigmasquare": "square-sigma",
 "slashsquare": "square-slash",
 "sliders": "sliders-vertical",
 "smile": "face-slightly-smiling",
 "smileplus": "face-slightly-smiling-plus",
 "sortasc": "arrow-up-narrow-wide",
 "sortdesc": "arrow-down-wide-narrow",
 "splitsquarehorizontal": "square-split-horizontal",
 "splitsquarevertical": "square-split-vertical",
 "squarearrowoutdownleft": "square-arrow-down-left-exit",
 "squarearrowoutdownright": "square-arrow-down-right-exit",
 "squarearrowoutupleft": "square-arrow-up-left-exit",
 "squarearrowoutupright": "square-arrow-up-right-exit",
 "squareganttchart": "square-chart-gantt",
 "squarem": "square-letter-m",
 "squareparking": "square-letter-p",
 "squareparkingoff": "square-letter-p-off",
 "stars": "sparkles",
 "stopcircle": "circle-stop",
 "subtitles": "captions",
 "tableconfig": "columns-3-cog",
 "terminalsquare": "square-terminal",
 "testtube2": "test-tube-diagonal",
 "text": "text-align-start",
 "textselect": "square-dashed-text",
 "textselection": "square-dashed-text",
 "train": "tram-front",
 "trash2": "trash",
 "trianglealert": "triangle-exclamation-point",
 "tv2": "tv-minimal",
 "unlock": "lock-open",
 "unlockkeyhole": "lock-keyhole-open",
 "uploadcloud": "cloud-upload",
 "user2": "user-round",
 "usercheck2": "user-round-check",
 "usercircle": "circle-user",
 "usercircle2": "circle-user-round",
 "usercog2": "user-round-cog",
 "userminus2": "user-round-minus",
 "userplus2": "user-round-plus",
 "users2": "users-round",
 "usersquare": "square-user",
 "usersquare2": "square-user-round",
 "userx2": "user-round-x",
 "verified": "badge-check",
 "wallet2": "wallet-minimal",
 "wand2": "wand-sparkles",
 "waves": "waves-horizontal",
 "wraptext": "text-wrap",
 "xcircle": "circle-x",
 "xoctagon": "octagon-x",
 "xsquare": "square-x"
};
});

__def("packages/builder-core/src/icon-name.ts", function (exports) {
const { lucideIcons } = __req("packages/builder-core/src/catalog/props-schema.ts");
const aliasTable = __req("packages/builder-core/src/catalog/lucide-aliases.json").default;
const ALIASES: Record<string, string> = aliasTable;

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

/** The published icon an old Lucide name stands for (smile -> face-slightly-smiling), when the enum has it. */
function aliasOf(aliases: Record<string, string>, names: Set<string>, name: string): string | undefined {
	const target = aliases[key(name)];
	return target && names.has(target) ? target : undefined;
}

/** The published icon name for a model's name, or null when none is close enough. */
function resolveIconName(raw: string): string | null {
	const { names, byKey } = index();
	if (!names.size) return raw;
	if (names.has(raw)) return raw;
	const name = kebab(raw);
	if (names.has(name)) return name;
	const hit = byKey.get(key(name)) ?? aliasOf(ALIASES, names, name) ?? (name.endsWith("s") ? byKey.get(key(name.slice(0, -1))) : undefined);
	if (hit) return hit;
	// Typos only: one edit from 5 characters, two from 8; never a short or loose guess.
	const max = name.length >= 8 ? 2 : name.length >= 5 ? 1 : 0;
	if (!max) return null;
	const near = [...names].filter((candidate) => distance(name, candidate, max) <= max);
	return near.length === 1 ? near[0]! : null;
}

/** Published icon names closest to a name that matched nothing: substring matches first, then edit distance (for the error the agent reads). */
function closestIconNames(raw: string, limit = 6): string[] {
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
function iconFixWarning(fixes: IconFix[]): string | null {
	if (!fixes.length) return null;
	const mapped = fixes.filter((fix) => fix.to);
	const dropped = [...new Set(fixes.filter((fix) => !fix.to).map((fix) => fix.from))];
	const parts: string[] = [];
	if (mapped.length) parts.push(`row icons mapped to the published Lucide names: ${[...new Set(mapped.map((fix) => `${fix.from} -> ${fix.to}`))].join(", ")}`);
	if (dropped.length) parts.push(`row icons not in the published Lucide names were dropped (those rows render without an icon): ${dropped.join(", ")}`);
	const text = parts.join("; ");
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

exports["resolveIconName"] = resolveIconName;
exports["closestIconNames"] = closestIconNames;
exports["iconFixWarning"] = iconFixWarning;

});

__def("packages/builder-core/src/page-doc/items.ts", function (exports) {
const { catalogSources } = __req("packages/builder-core/src/catalog/sources.ts");
const { catalogBlock } = __req("packages/builder-core/src/catalog/blocks.ts");
const { hasPropsSchema } = __req("packages/builder-core/src/catalog/props-schema.ts");
const CACHE = new Map<string, ItemInfo | null>();

/** What the registry says about an item, or null when the registry snapshot has no such renderable item. */
function itemInfo(item: string): ItemInfo | null {
	if (CACHE.has(item)) return CACHE.get(item)!;
	const block = Object.hasOwn(catalogSources.blocks, item) ? catalogSources.blocks[item] : undefined;
	let info: ItemInfo | null = null;
	const catalog = catalogBlock(item);
	if (block && catalog && hasPropsSchema(item)) {
		info = {
			item,
			title: catalog.title,
			category: catalog.category,
			organism: block.organism,
			defaultVariant: block.defaultVariant,
			variants: Object.keys(block.variants)
		};
	}
	CACHE.set(item, info);
	return info;
}

/** Every renderable registry item of the catalog, in catalog order. */
function allItems(): string[] {
	return Object.keys(catalogSources.blocks).filter((item) => itemInfo(item) !== null);
}

/** The variant of an item the page document calls `variant` (default variant when null / empty). */
function variantOrDefault(item: string, variant: string | null | undefined): string | null {
	const info = itemInfo(item);
	if (!info) return null;
	if (!variant) return info.defaultVariant;
	return info.variants.includes(variant) ? variant : null;
}

exports["itemInfo"] = itemInfo;
exports["allItems"] = allItems;
exports["variantOrDefault"] = variantOrDefault;

});

__def("packages/builder-core/src/page-doc/macros.ts", function (exports) {

type Macro = {
	/** What the token stands for (the agent's prompt and the docs list it). */
	description: string;
	/** The value; `argument` is the part after `:`, absent when the token has none. Null: the token stays as written. */
	value: (context: MacroContext, argument: string | undefined) => string | null;
};

/** The registry of macros. A new one is one entry here plus a test; the agent rule lists the names from `macroNames`. */
const MACROS: ReadonlyMap<string, Macro> = new Map<string, Macro>([
	[
		"year",
		{
			description: "the current year (four digits), for the copyright line",
			value: ({ now }, argument) => (argument === undefined ? String(now.getFullYear()) : null)
		}
	]
]);

/** Every `{name}` / `{name:argument}` token; the name decides whether it is a macro. */
const TOKEN = /\{([a-z][a-z0-9-]*)(?::([a-z0-9_-]+))?\}/g;

function macroNames(): string[] {
	return [...MACROS.keys()];
}

/** `text` with every known macro replaced; unknown tokens and stray braces are kept. */
function expandMacros(text: string, context: MacroContext = { now: new Date() }): string {
	if (!text.includes("{")) return text;
	return text.replace(TOKEN, (token, name: string, argument: string | undefined) => {
		return MACROS.get(name)?.value(context, argument) ?? token;
	});
}

/** A copy of `props` with the macros of every string inside them (object values and list items, at any depth) expanded. */
function expandMacrosDeep(props: Record<string, unknown>, context: MacroContext = { now: new Date() }): Record<string, unknown> {
	const walk = (inner: unknown): unknown => {
		if (typeof inner === "string") return expandMacros(inner, context);
		if (Array.isArray(inner)) return inner.map(walk);
		if (inner && typeof inner === "object") return Object.fromEntries(Object.entries(inner).map(([key, entry]) => [key, walk(entry)]));
		return inner;
	};
	return Object.fromEntries(Object.entries(props).map(([key, entry]) => [key, walk(entry)]));
}

exports["MACROS"] = MACROS;
exports["macroNames"] = macroNames;
exports["expandMacros"] = expandMacros;
exports["expandMacrosDeep"] = expandMacrosDeep;

});

__def("packages/builder-core/src/page-doc/render.ts", function (exports) {
const { cloneJson } = __req("packages/page-contract/src/index.ts");
const { fillProps, humanizeName } = __req("packages/builder-core/src/catalog/props-fill.ts");
const { propShapeFor, propsEventsFor, propsFieldTree } = __req("packages/builder-core/src/catalog/props-schema.ts");
const { variantPreset } = __req("packages/builder-core/src/catalog/organism.ts");
const { variantColumns } = __req("packages/builder-core/src/catalog/blocks.ts");
const { isImageUrl } = __req("packages/builder-core/src/catalog/image-url.ts");
const { itemInfo } = __req("packages/builder-core/src/page-doc/items.ts");
const { expandMacrosDeep } = __req("packages/builder-core/src/page-doc/macros.ts");
type Json = unknown;
const isObject = (value: Json): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);

function merge(base: Json, over: Json): Json {
	if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
	const out: Record<string, Json> = { ...base };
	for (const [key, value] of Object.entries(over)) out[key] = merge(base[key], value);
	return out;
}

/** props = fill(merge(variant preset, block props)): what `<Item {...props} />` receives. */
function effectiveProps(item: string, variant: string | null | undefined, props: Record<string, PropValueV2> | undefined, options: { blank?: boolean; rows?: number } = {}): Record<string, unknown> {
	const info = itemInfo(item);
	const name = variant && info?.variants.includes(variant) ? variant : (info?.defaultVariant ?? "");
	return fillProps(item, merge(variantPreset(item, name), cloneJson(props ?? {})) as Record<string, unknown>, options);
}

/** Props with every picture field (`image`, `imageDark`, `avatar` at any depth) that is not a picture address set to "" (the placeholder). */
function blankBadPictures(item: string, props: Record<string, unknown>): Record<string, unknown> {
	const walk = (value: Record<string, unknown>, nodes: PropsFieldNode[]): Record<string, unknown> => {
		const out: Record<string, unknown> = { ...value };
		for (const node of nodes) {
			const inner = value[node.name];
			const fields = node.fields ?? [];
			if (node.image && typeof inner === "string" && !isImageUrl(inner.trim())) out[node.name] = "";
			else if (node.kind === "list" && Array.isArray(inner)) out[node.name] = inner.map((row) => (isObject(row) ? walk(row, fields) : row));
			else if (node.kind === "object" && isObject(inner)) out[node.name] = walk(inner, fields);
		}
		return out;
	};
	const tree = propsFieldTree(item);
	return tree ? walk(props, tree) : props;
}

/** The registry block a v2 block renders as, or null when the registry has no such item (the host rejects those on write). */
function renderBlock(block: Pick<BlockV2, "item" | "variant" | "props">, macros?: MacroContext): BlockRender | null {
	const info = itemInfo(block.item);
	if (!info) return null;
	const variant = block.variant && info.variants.includes(block.variant) ? block.variant : info.defaultVariant;
	const { events, slots } = propsEventsFor(block.item);
	return { item: block.item, variant, organism: info.organism, props: expandMacrosDeep(blankBadPictures(block.item, effectiveProps(block.item, variant, block.props)), macros), events, slots };
}

/** Rows a new block's required list starts with, so the block shows something: one per column of the variant (cols4: 4,
 *  so no column stands empty), else 2. */
const SAMPLE_ROWS = 2;
const SAMPLE_TITLE_PROPS = ["title", "heading", "name"];

/**
 * The sample props of a new block (ADR 0034): the preset of the variant's layout axes plus the minimum the props schema
 * requires (required text blank, required icons the neutral glyph), with the catalog title of the block as its heading when the schema has a heading prop. The registry
 * publishes structure, not copy: a new block starts empty of invented text (no "Why this page"); the agent or the author
 * writes the content. The block id fills the item's `id` prop when it has one.
 */
function sampleProps(item: string, variant: string | null | undefined, id: string): Record<string, PropValueV2> {
	const info = itemInfo(item);
	const shape = propShapeFor(item);
	const seed: Record<string, PropValueV2> = {};
	if (shape?.props.includes("id")) seed.id = id;
	const heading = shape?.text.find((name) => SAMPLE_TITLE_PROPS.includes(name));
	if (heading && info) seed[heading] = info.title;
	const rows = (info && variantColumns(item, variant && info.variants.includes(variant) ? variant : info.defaultVariant)) || SAMPLE_ROWS;
	return effectiveProps(item, variant, seed, { blank: true, rows }) as Record<string, PropValueV2>;
}

/** UI label dictionaries (`labels`, aria strings) are component chrome: reported as one path while none of their words is written. */
/** A text the sample left as its neutral placeholder (the humanized key, "Home") is as unwritten as an empty one. */
const unwritten = (key: string, value: unknown) => value === "" || value === humanizeName(key);
const CHROME_OBJECTS = new Set(["labels", "aria", "a11y"]);

/**
 * Required text props a block leaves empty (JSON Pointers into its props): the places its component would show nothing or
 * its own placeholder. A write reports them so the content goes in with the structure (ADR 0034: props are the single source).
 */
function blankRequired(block: Pick<BlockV2, "item" | "props">, limit = 12): string[] {
	const tree = propsFieldTree(block.item);
	const out: string[] = [];
	const walk = (value: unknown, nodes: PropsFieldNode[] | undefined, base: string) => {
		if (!nodes || out.length >= limit) return;
		const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
		for (const node of nodes) {
			if (node.name === "id") continue;
			const here = `${base}/${node.name}`;
			const inner = record[node.name];
			if (CHROME_OBJECTS.has(node.name)) {
				// The UI words of the block (button and aria labels): reported once when none of them is written.
				const words = inner && typeof inner === "object" ? Object.entries(inner as Record<string, unknown>) : [];
				if (node.required && !words.some(([key, word]) => typeof word === "string" && !unwritten(key, word))) out.push(here);
				continue;
			}
			if (node.kind === "text") {
				if (node.required && (inner === undefined || unwritten(node.name, inner))) out.push(here);
			} else if (node.kind === "object") walk(inner, node.fields, here);
			else if (node.kind === "list" && Array.isArray(inner)) inner.forEach((row, index) => walk(row, node.fields, `${here}/${index}`));
			if (out.length >= limit) return;
		}
	};
	walk(block.props ?? {}, tree ?? undefined, "");
	return out;
}

exports["effectiveProps"] = effectiveProps;
exports["renderBlock"] = renderBlock;
exports["sampleProps"] = sampleProps;
exports["blankRequired"] = blankRequired;

});

__def("packages/builder-core/src/page-doc/gate.ts", function (exports) {
const { closestIconNames } = __req("packages/builder-core/src/icon-name.ts");
const { pageV2Issues, pageV2ProgramIssues } = __req("packages/page-contract/src/index.ts");
const { validateItemProps } = __req("packages/builder-core/src/catalog/validator.ts");
const { itemInfo, allItems } = __req("packages/builder-core/src/page-doc/items.ts");
const { effectiveProps } = __req("packages/builder-core/src/page-doc/render.ts");
function pointerOfSchemaPath(path: string): string {
	return (
		"/" +
		path
			.replace(/^\$\.?/, "")
			.replace(/\[(\d+)\]/g, ".$1")
			.split(".")
			.filter(Boolean)
			.map((part) => part.replace(/~/g, "~0").replace(/\//g, "~1"))
			.join("/")
	).replace(/\/$/, "") || "/";
}

function valueAtPointer(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
	}
	return current;
}

function short(value: unknown): unknown {
	if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}...` : value;
	if (value && typeof value === "object") {
		const text = JSON.stringify(value);
		return text.length > 120 ? `${text.slice(0, 117)}...` : value;
	}
	return value;
}

function schemaIssue(issue: SchemaIssue, doc: unknown): DocIssue {
	const path = pointerOfSchemaPath(issue.path);
	const inProps = /^\/blocks\/\d+\/props(\/|$)/.test(path);
	const expected =
		issue.expected ?? (inProps ? "a plain-text string, number, boolean, null, list or object whose keys are prop names (no markup, no { } < >)" : `a value the page-spec/v2 schema accepts (${issue.keyword})`);
	return { path, code: "schema_invalid", expected, got: issue.keyword === "required" ? undefined : short(valueAtPointer(doc, path)) };
}

/** Allowed values of a props enum, cut for a long list (Lucide icons). */
function allowedText(allowed: unknown[] | undefined, value?: unknown): string {
	if (!allowed?.length) return "";
	if (allowed.length > 40 && typeof value === "string" && value) {
		const near = closestIconNames(value);
		return `one of ${allowed.length} Lucide icon names; "${value}" is not one${near.length ? `, nearest: ${near.join(", ")}` : ""}; any other real name works (e.g. house, star, utensils, truck)`;
	}
	const shown = allowed.slice(0, 12).map(String).join(" | ");
	return allowed.length > 12 ? `one of ${allowed.length} values, e.g. ${shown}` : `one of ${shown}`;
}

const GATE_MISSING: DocIssue = { path: "/", code: "props_gate_unavailable", expected: "the props schema gate to be loaded", got: undefined };

/** Registry and chrome checks of a schema-valid page. */
function registryIssues(page: PageV2): DocIssue[] {
	const out: DocIssue[] = [];
	page.blocks.forEach((block, index) => {
		const at = `/blocks/${index}`;
		const info = itemInfo(block.item);
		if (!info) {
			const near = allItems().filter((name) => name.includes(block.item) || block.item.includes(name)).slice(0, 6);
			out.push({ path: `${at}/item`, code: "unknown_item", expected: `a block of the catalog (list_blocks and get_block name them)${near.length ? `; similar: ${near.join(", ")}` : ""}`, got: block.item });
			return;
		}
		if (block.variant !== undefined && !info.variants.includes(block.variant)) {
			out.push({ path: `${at}/variant`, code: "unknown_variant", expected: `one of ${info.variants.join(" | ")}`, got: block.variant });
		}
		const issues = validateItemProps(block.item, effectiveProps(block.item, block.variant, block.props));
		if (issues === null) {
			out.push({ ...GATE_MISSING, path: `${at}/props` });
			return;
		}
		for (const issue of issues.slice(0, 8)) {
			out.push({
				path: `${at}/props${issue.pointer}`,
				code: "props_invalid",
				expected: issue.allowed?.length ? allowedText(issue.allowed, issue.value) : `${issue.message} (props schema of ${block.item})`,
				got: issue.keyword === "required" ? undefined : issue.value
			});
		}
	});
	return out;
}

/** Schema + program + registry checks of a document (no normalization: see writePage). */
function checkPageDoc(input: unknown): DocGate {
	const schema = pageV2Issues(input);
	if (schema.length) return { ok: false, issues: schema.slice(0, 12).map((issue) => schemaIssue(issue, input)) };
	const page = input as PageV2;
	const program = pageV2ProgramIssues(page);
	if (program.length) return { ok: false, issues: program.slice(0, 12).map((issue) => ({ path: pointerOfSchemaPath(issue.path), code: issue.keyword, expected: issue.expected ?? issue.keyword, got: undefined })) };
	const issues = registryIssues(page);
	return issues.length ? { ok: false, issues: issues.slice(0, 16) } : { ok: true, page };
}

exports["pointerOfSchemaPath"] = pointerOfSchemaPath;
exports["valueAtPointer"] = valueAtPointer;
exports["registryIssues"] = registryIssues;
exports["checkPageDoc"] = checkPageDoc;

});

__def("packages/builder-core/src/page-doc/jsonpatch.ts", function (exports) {
const { cloneJson } = __req("packages/page-contract/src/index.ts");
type Json = unknown;
const isObject = (value: Json): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);

function parts(pointer: string): string[] {
	return pointer.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function same(a: Json, b: Json): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

type Failure = { code: string; expected: string; got?: unknown };

/** The container and key a pointer names (the parent must exist). */
function locate(doc: Json, pointer: string): { parent: Json; key: string } | Failure {
	const keys = parts(pointer);
	if (!keys.length) return { code: "path_invalid", expected: "a pointer below the document root" };
	let current = doc;
	for (const key of keys.slice(0, -1)) {
		if (Array.isArray(current)) {
			if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length) return { code: "path_not_found", expected: `an existing array index (${current.length ? `0..${current.length - 1}` : "the list is empty: add a whole row at its path with /-"})`, got: key };
			current = current[Number(key)];
		} else if (isObject(current) && Object.hasOwn(current, key)) current = current[key];
		else return { code: "path_not_found", expected: `an existing key (${isObject(current) ? Object.keys(current).slice(0, 12).join(", ") : "an object"})`, got: key };
	}
	return { parent: current, key: keys.at(-1)! };
}

function isFailure(value: { parent: Json; key: string } | Failure): value is Failure {
	return "code" in value;
}

function read(parent: Json, key: string): { found: boolean; value?: Json } {
	if (Array.isArray(parent)) {
		if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= parent.length) return { found: false };
		return { found: true, value: parent[Number(key)] };
	}
	if (isObject(parent) && Object.hasOwn(parent, key)) return { found: true, value: parent[key] };
	return { found: false };
}

function insert(parent: Json, key: string, value: Json, replace: boolean): Failure | null {
	if (Array.isArray(parent)) {
		if (key === "-") {
			if (replace) return { code: "path_not_found", expected: "an existing array index (replace takes no '-')", got: key };
			parent.push(value);
			return null;
		}
		if (!/^(0|[1-9]\d*)$/.test(key)) return { code: "path_invalid", expected: "an array index or '-'", got: key };
		const at = Number(key);
		if (replace) {
			if (at >= parent.length) return { code: "path_not_found", expected: `an existing array index (0..${parent.length - 1})`, got: key };
			parent[at] = value;
			return null;
		}
		if (at > parent.length) return { code: "index_out_of_range", expected: `an index 0..${parent.length} (or '-')`, got: key };
		parent.splice(at, 0, value);
		return null;
	}
	if (isObject(parent)) {
		if (replace && !Object.hasOwn(parent, key)) return { code: "path_not_found", expected: `an existing key (${Object.keys(parent).slice(0, 12).join(", ")}); use add to create one`, got: key };
		parent[key] = value;
		return null;
	}
	return { code: "path_invalid", expected: "an object or array parent", got: typeof parent };
}

function remove(parent: Json, key: string): { removed: Json } | Failure {
	const hit = read(parent, key);
	if (!hit.found) return { code: "path_not_found", expected: Array.isArray(parent) ? `an existing array index (0..${parent.length - 1})` : `an existing key (${isObject(parent) ? Object.keys(parent).slice(0, 12).join(", ") : "an object"})`, got: key };
	if (Array.isArray(parent)) parent.splice(Number(key), 1);
	else delete (parent as Record<string, Json>)[key];
	return { removed: hit.value };
}

/** Applies the patch to a copy of `doc`; `issues` name the first failing operation (index and path in `path`). */
function applyJsonPatch<T>(doc: T, ops: PatchOpLike[]): { ok: true; doc: T } | { ok: false; issues: DocIssue[] } {
	const work = cloneJson(doc) as Json;
	let root: Json = work;
	for (const [index, op] of ops.entries()) {
		const at = (failure: Failure, path = op.path): { ok: false; issues: DocIssue[] } => ({
			ok: false,
			issues: [{ path, code: failure.code, expected: `ops[${index}] (${op.op} ${op.path}): ${failure.expected}`, got: failure.got }]
		});
		const target = locate(root, op.path);
		if (isFailure(target)) return at(target);
		if (op.op === "add" || op.op === "replace") {
			const failure = insert(target.parent, target.key, cloneJson(op.value), op.op === "replace");
			if (failure) return at(failure);
		} else if (op.op === "remove") {
			const out = remove(target.parent, target.key);
			if ("code" in out) return at(out);
		} else if (op.op === "test") {
			const hit = read(target.parent, target.key);
			if (!hit.found || !same(hit.value, op.value)) return at({ code: "test_failed", expected: `the value at ${op.path} to equal ${JSON.stringify(op.value)}`, got: hit.found ? hit.value : undefined });
		} else if (op.op === "move" || op.op === "copy") {
			const from = typeof op.from === "string" ? locate(root, op.from) : ({ code: "from_missing", expected: "a from pointer" } as Failure);
			if (isFailure(from)) return at(from, op.from ?? op.path);
			const hit = read(from.parent, from.key);
			if (!hit.found) return at({ code: "path_not_found", expected: `an existing value at from ${op.from}`, got: undefined }, op.from);
			const value = cloneJson(hit.value);
			if (op.op === "move") {
				if (op.path.startsWith(`${op.from}/`)) return at({ code: "path_invalid", expected: "a path outside the value being moved", got: op.path });
				const out = remove(from.parent, from.key);
				if ("code" in out) return at(out, op.from);
				// A move within one array lands at the index after the removal (RFC 6902 evaluates path on the shortened document).
				const after = locate(root, op.path);
				if (isFailure(after)) return at(after);
				const failure = insert(after.parent, after.key, value, false);
				if (failure) return at(failure);
			} else {
				const failure = insert(target.parent, target.key, value, false);
				if (failure) return at(failure);
			}
		} else return at({ code: "unknown_op", expected: "add, remove, replace, move, copy or test", got: op.op });
		root = work;
	}
	return { ok: true, doc: root as T };
}

exports["applyJsonPatch"] = applyJsonPatch;

});

__def("packages/builder-core/src/page-doc/diff.ts", function (exports) {

const MAX_PATHS = 40;

function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const esc = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

/** Pointers where two JSON values differ (a list that changes length is one pointer: the list). */
function changedPointers(before: unknown, after: unknown, at = "", out: string[] = []): string[] {
	if (out.length >= MAX_PATHS || same(before, after)) return out;
	if (isObject(before) && isObject(after)) {
		for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) changedPointers(before[key], after[key], `${at}/${esc(key)}`, out);
		return out;
	}
	if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
		before.forEach((entry, index) => changedPointers(entry, after[index], `${at}/${index}`, out));
		return out;
	}
	out.push(at || "/");
	return out;
}

/** Longest increasing subsequence of `values` (indices into it), to find the blocks that did not move. */
function lis(values: number[]): Set<number> {
	const tails: number[] = [];
	const prev: number[] = new Array(values.length).fill(-1);
	const at: number[] = [];
	values.forEach((value, i) => {
		let lo = 0;
		let hi = tails.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (values[tails[mid]!]! < value) lo = mid + 1;
			else hi = mid;
		}
		if (lo > 0) prev[i] = tails[lo - 1]!;
		tails[lo] = i;
		at[lo] = i;
	});
	const keep = new Set<number>();
	let k = tails.at(-1);
	while (k !== undefined && k >= 0) {
		keep.add(k);
		k = prev[k];
	}
	return keep;
}

function diffPages(base: PageV2 | null | undefined, next: PageV2): DiffEntry[] {
	const out: DiffEntry[] = [];
	const pagePaths: string[] = [];
	if (base) {
		if (base.title !== next.title) pagePaths.push("/title");
		if (base.slug !== next.slug) pagePaths.push("/slug");
		if (base.locale !== next.locale) pagePaths.push("/locale");
		if ((base.seo?.title ?? "") !== (next.seo?.title ?? "")) pagePaths.push("/seo/title");
		if ((base.seo?.description ?? "") !== (next.seo?.description ?? "")) pagePaths.push("/seo/description");
	}
	if (pagePaths.length) out.push({ scope: "page", change: "changed", paths: pagePaths });
	const before = new Map((base?.blocks ?? []).map((block, index) => [block.id, { block, index }]));
	const after = new Map(next.blocks.map((block, index) => [block.id, { block, index }]));
	for (const [id, { block, index }] of before) {
		if (!after.has(id)) out.push({ scope: "block", change: "removed", id, item: block.item, from: index });
	}
	const kept = next.blocks.map((block, index) => ({ block, index })).filter(({ block }) => before.has(block.id));
	const unmoved = lis(kept.map(({ block }) => before.get(block.id)!.index));
	kept.forEach(({ block, index }, rank) => {
		const prior = before.get(block.id)!;
		const paths: string[] = [];
		if (prior.block.item !== block.item) paths.push("/item");
		if ((prior.block.variant ?? "") !== (block.variant ?? "")) paths.push("/variant");
		if (prior.block.item === block.item) paths.push(...changedPointers(prior.block.props ?? {}, block.props ?? {}).map((pointer) => `/props${pointer === "/" ? "" : pointer}`));
		else if (!same(prior.block.props, block.props)) paths.push("/props");
		if (!unmoved.has(rank)) out.push({ scope: "block", change: "moved", id: block.id, item: block.item, from: prior.index, to: index });
		if (paths.length) out.push({ scope: "block", change: "changed", id: block.id, item: block.item, ...(block.variant ? { variant: block.variant } : {}), paths: paths.slice(0, MAX_PATHS) });
	});
	for (const { block, index } of next.blocks.map((entry, i) => ({ block: entry, index: i }))) {
		if (!before.has(block.id)) out.push({ scope: "block", change: "added", id: block.id, item: block.item, ...(block.variant ? { variant: block.variant } : {}), to: index });
	}
	return out;
}

function diffIsEmpty(diff: DiffEntry[]): boolean {
	return diff.length === 0;
}

exports["changedPointers"] = changedPointers;
exports["diffPages"] = diffPages;
exports["diffIsEmpty"] = diffIsEmpty;

});

__def("packages/builder-core/src/page-doc/probe.ts", function (exports) {
const { renderBlock } = __req("packages/builder-core/src/page-doc/render.ts");
function probeFromModule(mod: RenderModule): RenderProbe {
	return (organism, props) => {
		const component = mod.blocks[organism];
		if (!component) return { ok: false, error: `no compiled block ${organism}` };
		try {
			return { ok: true, html: mod.render(component as never, { props }).body };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	};
}

/** What a render result amounts to for the page: it threw, shows nothing, or shows content. */
function probeOutcome(result: ProbeResult): ProbeOutcome {
	return !result.ok ? "throws" : showsContent(result.html) ? "content" : "empty";
}

let probe: RenderProbe | null = null;
let required = false;
/** "reject": a block that shows nothing fails the write (the agent host). "allow": it passes and the preview says so (the browser: a freshly added block with registry sample props is a placeholder the author fills in). A block that throws fails either way. */
let emptyPolicy: "reject" | "allow" = "reject";
const CACHE = new Map<string, ProbeIssue | null>();

function installRenderProbe(fn: RenderProbe | null, options: { required?: boolean; empty?: "reject" | "allow" } = {}): void {
	probe = fn;
	required = Boolean(options.required);
	emptyPolicy = options.empty ?? "reject";
	CACHE.clear();
}

/**
 * Switch the empty policy and return the one it replaces. The desktop webview runs the agent loop next to the preview:
 * the loop judges its own writes strictly ("reject", like the agent host) and puts the page's policy back while it waits
 * for the model (ADR 0065). The cache holds raw outcomes, so a switch never clears it.
 */
function setRenderEmptyPolicy(policy: "reject" | "allow"): "reject" | "allow" {
	const previous = emptyPolicy;
	emptyPolicy = policy;
	return previous;
}

function renderProbeInstalled(): boolean {
	return probe !== null;
}

/** HTML without comments and styles. */
function visible(html: string): { html: string; text: string } {
	const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
	return { html: clean.trim(), text: clean.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() };
}

/** What the rendered markup shows: any text, or an image, icon, media or control. */
function showsContent(html: string): boolean {
	const { html: clean, text } = visible(html);
	return clean !== "" && (text !== "" || /<(img|svg|video|picture|canvas|iframe|input|textarea|select|button)\b/i.test(clean));
}

/** UTF-8 bytes of a string, one per character (what V8 writes into some Intl errors); no Node `Buffer`, so it runs in the browser. */
function latin1Bytes(value: string): string {
	return Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join("");
}

/** A string whose characters are all bytes (< 256) read as UTF-8; null when it is not one. */
function fromLatin1Bytes(value: string): string | null {
	const bytes = new Uint8Array(value.length);
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code > 255) return null;
		bytes[i] = code;
	}
	return new TextDecoder("utf-8").decode(bytes);
}

/**
 * V8 writes the argument of some Intl errors ("Invalid currency code : ...") one byte per character, so a non-Latin-1 value
 * comes back as its UTF-8 bytes read as Latin-1 (a rouble sign as "a" + two more characters). Undo that when it round-trips.
 */
function readable(message: string): string {
	const back = fromLatin1Bytes(message);
	return back !== null && back !== message && !back.includes("\ufffd") ? back : message;
}

/** JSON Pointer of the first string leaf whose value appears in an error message (the prop the component choked on). */
function culprit(props: unknown, message: string): string | null {
	let found: string | null = null;
	const walk = (value: unknown, path: string): void => {
		if (found) return;
		if (typeof value === "string") {
			if (value.length > 0 && value.length <= 40 && (message.includes(value) || message.includes(latin1Bytes(value)))) found = path;
		} else if (Array.isArray(value)) value.forEach((entry, i) => walk(entry, `${path}/${i}`));
		else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) walk(entry, `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`);
	};
	walk(props, "");
	return found;
}

/** Props that are empty lists: what a block with no content most likely lacks. */
function emptyLists(props: Record<string, unknown>): string[] {
	return Object.entries(props).filter(([, value]) => Array.isArray(value) && value.length === 0).map(([key]) => key);
}

function probeBlock(item: string, variant: string | undefined, props: Record<string, unknown> | undefined, at: string): ProbeIssue | null {
	const rendered = renderBlock({ item, variant, props: props as BlockV2["props"] });
	if (!rendered) return null;
	const key = `${rendered.organism}\n${JSON.stringify(rendered.props)}`;
	const hit = CACHE.get(key);
	if (hit !== undefined) return hit && { ...hit, path: `${at}${hit.path}` };
	let issue: ProbeIssue | null = null;
	let result: ProbeResult;
	try {
		result = probe!(rendered.organism, rendered.props);
	} catch (err) {
		result = { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
	if (!result.ok) {
		const raw = result.error.split("\n")[0]!.slice(0, 200);
		const where = culprit(rendered.props, raw);
		const message = readable(raw);
		issue = {
			path: `/props${where ?? ""}`,
			code: "render_failed",
			expected: `props ${item} can render: its component threw "${message}" while rendering${where ? " with this value" : ""}`,
			got: where ? undefined : "see the error above"
		};
		if (where) issue.got = message;
	} else if (!showsContent(result.html)) {
		const lists = emptyLists(rendered.props);
		issue = {
			path: "/props",
			code: "render_empty",
			expected: `props that make ${item}/${rendered.variant} show content: it renders nothing now${lists.length ? ` (empty lists: ${lists.join(", ")})` : ""}; write its texts, rows and images`,
			got: lists.length ? lists.map((name) => `${name}: []`).join(", ") : "nothing visible"
		};
	}
	CACHE.set(key, issue);
	return issue && { ...issue, path: `${at}${issue.path}` };
}

/** Render issues of a (schema-valid) page; `at` indexes are the block indexes of the page. Blocks whose props already failed are skipped by the caller. */
function renderIssues(page: PageV2, skip: ReadonlySet<number> = new Set()): ProbeIssue[] {
	const todo = page.blocks.flatMap((block, index) => (skip.has(index) ? [] : [{ block, index }]));
	// Nothing to render (a rename, a move, a removal): nothing was left unchecked, so a missing probe is not a failure.
	if (todo.length === 0) return [];
	if (!probe) {
		return required ? [{ path: "/", code: "render_probe_unavailable", expected: "the render probe (api/runtime/_render/blocks.mjs, `npm run bundle:runtime`) to be loaded" }] : [];
	}
	const out: ProbeIssue[] = [];
	for (const { block, index } of todo) {
		const issue = probeBlock(block.item, block.variant, block.props as Record<string, unknown> | undefined, `/blocks/${index}`);
		if (issue && !(emptyPolicy === "allow" && issue.code === "render_empty")) out.push(issue);
	}
	return out;
}

/** Blocks of the page that throw or show nothing in the preview now (what get_page tells the agent); empty without a probe. */
function renderProblems(page: PageV2): ProbeIssue[] {
	return renderIssues(page).filter((issue) => issue.code !== "render_probe_unavailable");
}

exports["probeFromModule"] = probeFromModule;
exports["probeOutcome"] = probeOutcome;
exports["installRenderProbe"] = installRenderProbe;
exports["setRenderEmptyPolicy"] = setRenderEmptyPolicy;
exports["renderProbeInstalled"] = renderProbeInstalled;
exports["showsContent"] = showsContent;
exports["renderIssues"] = renderIssues;
exports["renderProblems"] = renderProblems;

});

__def("packages/builder-core/src/page-doc/layout.ts", function (exports) {
const { layoutAxes, variantAxisValues, variantSettingDefault, variantSettingNames } = __req("packages/builder-core/src/catalog/blocks.ts");
const { itemInfo } = __req("packages/builder-core/src/page-doc/items.ts");
type Props = Record<string, PropValueV2>;
type LayoutResult = { ok: true; variant: string | undefined; props: Props | undefined; notes: string[] } | { ok: false; issues: DocIssue[] };

const show = (axes: Record<string, string>) => Object.entries(axes).map(([axis, value]) => `${axis} ${JSON.stringify(value)}`).join(", ");

function variantsText(item: string, variants: string[]): string {
	return variants.map((name) => `${name} (${show(variantAxisValues(item, name) ?? {})})`).join("; ");
}

/**
 * The variant and props of one written block after the layout rule. `prior` is the block as it was (same id and item),
 * absent for a new block or an item change. Blocks without axes, and unknown variants (the gate says so), pass through.
 */
function reconcileLayout(item: string, at: string, prior: Pick<BlockV2, "variant" | "props"> | undefined, variant: string | undefined, props: Props | undefined): LayoutResult {
	const info = itemInfo(item);
	const axes = layoutAxes(item);
	if (!info || !axes.length || (variant !== undefined && !info.variants.includes(variant))) return { ok: true, variant, props, notes: [] };
	const priorVariant = prior ? (prior.variant && info.variants.includes(prior.variant) ? prior.variant : info.defaultVariant) : undefined;
	const named = variant !== undefined && (priorVariant === undefined || variant !== priorVariant);
	const current = variant ?? priorVariant ?? info.defaultVariant;
	const written: Record<string, string> = {};
	for (const axis of axes) {
		const value = props?.[axis];
		if (value !== undefined && value !== null) written[axis] = String(value);
	}
	const target = variantAxisValues(item, current) ?? {};
	let chosen = current;
	const notes: string[] = [];
	if (named) {
		const priorAxes = priorVariant ? (variantAxisValues(item, priorVariant) ?? {}) : {};
		const stale = (axis: string, value: string) => prior !== undefined && (value === String(prior.props?.[axis] ?? "") || value === priorAxes[axis]);
		const clash = axes.filter((axis) => written[axis] !== undefined && written[axis] !== target[axis] && !stale(axis, written[axis]!));
		if (clash.length) {
			return {
				ok: false,
				issues: clash.map((axis) => ({
					path: `${at}/props/${axis}`,
					code: "props_invalid",
					expected: `${JSON.stringify(target[axis])}: variant ${current} sets ${axis}. Leave ${axes.join(", ")} out (the variant sets them) or pick the variant with that layout: ${variantsText(item, info.variants)}`,
					got: written[axis]
				}))
			};
		}
	} else if (axes.some((axis) => written[axis] !== undefined && written[axis] !== target[axis])) {
		const wanted = { ...target, ...written };
		const matches = info.variants.filter((name) => {
			const values = variantAxisValues(item, name) ?? {};
			return axes.every((axis) => values[axis] === wanted[axis]);
		});
		if (matches.length !== 1) {
			const axis = axes.find((name) => written[name] !== undefined && written[name] !== target[name])!;
			return {
				ok: false,
				issues: [{
					path: `${at}/props/${axis}`,
					code: "props_invalid",
					expected: `a layout of one variant: ${show(wanted)} is none. Set variant instead of the axes: ${variantsText(item, info.variants)}`,
					got: written[axis]
				}]
			};
		}
		chosen = matches[0]!;
		notes.push(`variant ${current} -> ${chosen} (the layout axes ${show(written)} written).`);
	}
	if (!props) return { ok: true, variant: chosen === current ? variant : chosen, props, notes };
	const out: Props = { ...props };
	const axisValues = variantAxisValues(item, chosen) ?? {};
	for (const axis of axes) if (axisValues[axis] !== undefined) out[axis] = axisValues[axis]!;
	const from = priorVariant ?? (named ? undefined : current);
	if (prior && from !== undefined && from !== chosen) {
		const kept: string[] = [];
		for (const name of variantSettingNames(item)) {
			const value = out[name];
			const before = variantSettingDefault(item, from, name);
			if (value === undefined || value === before) {
				const next = variantSettingDefault(item, chosen, name);
				if (next === undefined) delete out[name];
				else out[name] = next;
			} else kept.push(`${name} ${JSON.stringify(value)}`);
		}
		if (kept.length) notes.push(`variant ${from} -> ${chosen}: ${kept.join(", ")} kept (set by hand).`);
	}
	return { ok: true, variant: chosen === current ? variant : chosen, props: out, notes };
}

exports["reconcileLayout"] = reconcileLayout;

});

__def("packages/builder-core/src/page-doc/write.ts", function (exports) {
const { cloneJson, pagePatchV2Issues } = __req("packages/page-contract/src/index.ts");
const { pointerInfo, propsFieldTree, propShapeFor } = __req("packages/builder-core/src/catalog/props-schema.ts");
const { resolveIconName } = __req("packages/builder-core/src/icon-name.ts");
const { isImageUrl } = __req("packages/builder-core/src/catalog/image-url.ts");
const { coerceEnumProps } = __req("packages/builder-core/src/catalog/props-fill.ts");
const { diffPages } = __req("packages/builder-core/src/page-doc/diff.ts");
const { renderIssues } = __req("packages/builder-core/src/page-doc/probe.ts");
const { checkPageDoc, pointerOfSchemaPath, valueAtPointer } = __req("packages/builder-core/src/page-doc/gate.ts");
const { applyJsonPatch } = __req("packages/builder-core/src/page-doc/jsonpatch.ts");
const { itemInfo } = __req("packages/builder-core/src/page-doc/items.ts");
const { reconcileLayout } = __req("packages/builder-core/src/page-doc/layout.ts");
const { effectiveProps, sampleProps } = __req("packages/builder-core/src/page-doc/render.ts");
const BLANK = { blank: true } as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function failure(issues: DocIssue[]): WriteFailure {
	const first = issues[0]!;
	return {
		ok: false,
		code: "write_invalid",
		message: `The page was not written: ${issues.length} problem${issues.length > 1 ? "s" : ""}, first at ${first.path} (${first.code}). Nothing changed; fix the listed paths and call write_page again.`,
		issues
	};
}

/** `block-<item>`, made unique against `taken` within the id length. */
function freshBlockId(item: string, taken: Set<string>): string {
	const base = `block-${item}`.slice(0, 56).replace(/-+$/, "");
	let id = base;
	for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
	taken.add(id);
	return id;
}

/**
 * Icon props (fields of kind icon, in lists and objects) mapped to the published Lucide names, and picture addresses (image) kept only when valid. A name Lucide does not have:
 * an optional icon is dropped, a required one takes the icon of the same field in the block's sample props (both noted);
 * with no such icon it stays and fails the gate, which names the path and the nearest real icons.
 */
function repairIcons(item: string, props: Record<string, unknown>, sample: Record<string, unknown>, notes: string[], at: string): Record<string, unknown> {
	const tree = propsFieldTree(item);
	if (!tree) return props;
	const walk = (value: unknown, nodes: PropsFieldNode[] | undefined, path: string, model: unknown): unknown => {
		if (!nodes || !isObject(value)) return value;
		const out: Record<string, unknown> = {};
		const modelOf = (key: string): unknown => (isObject(model) ? model[key] : undefined);
		for (const [key, inner] of Object.entries(value)) {
			const node = nodes.find((entry) => entry.name === key);
			const here = `${path}/${key}`;
			if (node?.kind === "icon" && typeof inner === "string") {
				const fixed = resolveIconName(inner);
				const stand = modelOf(key);
				const fallback = typeof stand === "string" ? resolveIconName(stand) : null;
				if (fixed !== null) {
					if (fixed !== inner) notes.push(`${here}: icon "${inner}" written as "${fixed}".`);
					out[key] = fixed;
				} else if (!node.required) notes.push(`${here}: icon "${inner}" is not a Lucide icon; dropped (the element renders without an icon).`);
				else if (fallback) {
					notes.push(`${here}: icon "${inner}" is not a Lucide icon; the sample icon "${fallback}" is used.`);
					out[key] = fallback;
				} else out[key] = inner;
			} else if (node?.image && typeof inner === "string") {
				if (isImageUrl(inner)) out[key] = inner;
				else notes.push(`${here}: image "${inner.length > 48 ? `${inner.slice(0, 48)}...` : inner}" is not an https URL or a relative path; dropped (the placeholder shows).`);
			} else if (node?.kind === "list" && Array.isArray(inner)) {
				const rows = modelOf(key);
				out[key] = inner.map((row, index) => walk(row, node.fields, `${here}/${index}`, Array.isArray(rows) ? rows[0] : undefined));
			} else if (node?.kind === "object") out[key] = walk(inner, node.fields, here, modelOf(key));
			else out[key] = inner;
		}
		return out;
	};
	return walk(props, tree, `${at}/props`, sample) as Record<string, unknown>;
}

/** Text props both items have (the same name, a string in the old props): kept when an item is swapped for another. */
function carriedText(oldProps: Record<string, unknown> | undefined, item: string): Record<string, PropValueV2> {
	const shape = propShapeFor(item);
	const out: Record<string, PropValueV2> = {};
	if (!oldProps || !shape) return out;
	for (const name of shape.text) if (name !== "id" && typeof oldProps[name] === "string" && oldProps[name] !== "") out[name] = oldProps[name] as string;
	return out;
}

/** Fill, carry and repair the blocks a write touched; blocks identical to the base keep their bytes. */
function normalizeBlocks(base: PageV2, next: PageV2, notes: string[], issues: DocIssue[] = []): void {
	const before = new Map(base.blocks.map((block) => [block.id, block]));
	const taken = new Set<string>([...(next.id ? [next.id] : []), ...next.blocks.map((block) => block.id).filter((id): id is string => typeof id === "string")]);
	next.blocks = next.blocks.map((block, index) => {
		if (!isObject(block) || typeof (block as { item?: unknown }).item !== "string") return block;
		const out: BlockV2 = { ...block } as BlockV2;
		if (typeof out.id !== "string" || out.id === "") out.id = freshBlockId(out.item, taken);
		const prior = before.get(out.id);
		const at = `/blocks/${index}`;
		if (prior && same(prior, out)) return prior;
		const info = itemInfo(out.item);
		if (!info) return out;
		// Enum values in the schema's type (`cols: 3` -> "3", `level: "2"` -> 2), as the Inspector writes them.
		if (isObject(out.props)) {
			const coerced = coerceEnumProps(out.item, out.props);
			if (coerced.changed.length) {
				out.props = coerced.props;
				notes.push(`${out.id}: ${coerced.changed.map((c) => `${c.pointer.slice(1)} ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`).join(", ")} (enum values are written in the type the schema declares).`);
			}
		}
		// The variant of the old item does not exist on the new one: its default variant (said in the notes).
		if (prior && prior.item !== out.item && out.variant !== undefined && out.variant === prior.variant && !info.variants.includes(out.variant)) {
			notes.push(`${out.id}: variant ${out.variant} is not a variant of ${out.item}; its default variant ${info.defaultVariant} is used.`);
			out.variant = info.defaultVariant;
		}
		// The variant is the source of truth of the layout axes (layout.ts): stale axes follow it, contradictions are rejected.
		const kept = prior && prior.item === out.item ? prior : undefined;
		const layout = reconcileLayout(out.item, at, kept, out.variant, kept ? (out.props ?? kept.props) : out.props);
		if (!layout.ok) {
			issues.push(...layout.issues);
			return out;
		}
		if (layout.variant !== undefined) out.variant = layout.variant;
		for (const note of layout.notes) notes.push(`${out.id}: ${note}`);
		const written = layout.props;
		let props: Record<string, unknown>;
		if (!prior) {
			// A new block: the sample props of its variant under what the write gave it.
			props = effectiveProps(out.item, out.variant, { ...sampleProps(out.item, out.variant, out.id), ...(written ?? {}) }, BLANK);
		} else if (prior.item !== out.item) {
			const wrote = out.props !== undefined && !same(out.props, prior.props);
			props = wrote
				? effectiveProps(out.item, out.variant, written ?? out.props, BLANK)
				: effectiveProps(out.item, out.variant, { ...sampleProps(out.item, out.variant, out.id), ...carriedText(prior.props, out.item) }, BLANK);
			if (!wrote) notes.push(`${out.id}: item ${prior.item} -> ${out.item}; sample props of the new item, text carried over: ${Object.keys(carriedText(prior.props, out.item)).join(", ") || "none"}.`);
		} else {
			if ((prior.variant ?? "") !== (out.variant ?? "") && !layout.notes.length) notes.push(`${out.id}: variant ${prior.variant ?? "default"} -> ${out.variant ?? "default"}; layout axes taken from the new variant.`);
			props = effectiveProps(out.item, out.variant, written ?? prior.props ?? {}, BLANK);
		}
		out.props = repairIcons(out.item, props, sampleProps(out.item, out.variant, out.id), notes, at) as Record<string, PropValueV2>;
		return out;
	});
}

const PROPS_PATH = /^\/blocks\/(\d+)\/props(\/.+)$/;

/** A patch operation whose path is not in the props schema of its block (the block of the base page at that index). */
function unknownPropsPath(base: PageV2, path: string): boolean {
	const hit = PROPS_PATH.exec(path);
	const item = hit ? base.blocks[Number(hit[1])]?.item : undefined;
	return Boolean(hit && item && itemInfo(item) && !pointerInfo(item, hit[2]!.replace(/\/-(?=\/|$)/g, "/0")));
}

/** Props the schema does not have (the gate's "has no prop X"): removed from the document, their paths returned. */
function dropUnknownProps(doc: PageV2): string[] {
	const dropped: string[] = [];
	for (let round = 0; round < 4; round += 1) {
		const gate = checkPageDoc(doc);
		if (gate.ok) break;
		const found = gate.issues.flatMap((issue) => {
			const key = issue.code === "props_invalid" ? /^has no prop (\S+) \(props schema of/.exec(issue.expected)?.[1] : undefined;
			return key === undefined ? [] : [{ path: issue.path, key }];
		});
		if (!found.length) break;
		for (const { path, key } of found) {
			let node: unknown = doc;
			for (const part of path.split("/").slice(1)) node = isObject(node) || Array.isArray(node) ? Reflect.get(node, part.replace(/~1/g, "/").replace(/~0/g, "~")) : undefined;
			if (isObject(node) && key in node) {
				delete node[key];
				dropped.push(`${path}/${key}`);
			}
		}
	}
	return dropped;
}

const HOST_FIELDS = ["id", "status", "createdAt", "updatedAt"] as const;

/** One write: a full document or an RFC 6902 patch against `base`; the result is gated, normalized and diffed. */
function writePage(base: PageV2, input: WriteInput, options: { now?: string } = {}): WriteResult {
	const notes: string[] = [];
	let next: unknown;
	if (input.patch !== undefined && input.page !== undefined) {
		return failure([{ path: "/", code: "write_ambiguous", expected: "either page (a full document) or patch (RFC 6902 operations), not both", got: "both" }]);
	}
	if (input.patch !== undefined) {
		const ops = Array.isArray(input.patch) ? input.patch : isObject(input.patch) && Array.isArray(input.patch.ops) ? input.patch.ops : input.patch;
		const issues = pagePatchV2Issues(ops);
		if (issues.length) {
			return failure(
				issues.slice(0, 12).map((issue) => ({
					path: pointerOfSchemaPath(issue.path),
					code: "patch_invalid",
					expected: issue.expected ?? `an RFC 6902 operation of page-patch/v2 (${issue.keyword})`,
					got: valueAtPointer(ops, pointerOfSchemaPath(issue.path).replace(/^\/(\d+)/, "/$1"))
				}))
			);
		}
		let list = ops as Array<{ op: string; path: string }>;
		let applied = applyJsonPatch(base, list);
		const skipped: string[] = [];
		// An operation on a props path the schema does not have is dropped (said in the notes); every other failure rejects.
		while (!applied.ok && applied.issues[0]!.code === "path_not_found" && unknownPropsPath(base, applied.issues[0]!.path)) {
			const at = Number(/^ops\[(\d+)\]/.exec(applied.issues[0]!.expected)?.[1]);
			if (!Number.isInteger(at)) break;
			skipped.push(applied.issues[0]!.path);
			list = list.filter((_, index) => index !== at);
			applied = applyJsonPatch(base, list);
		}
		if (!applied.ok) return failure(applied.issues);
		if (skipped.length) notes.push(`Dropped (not in the props schema of the block): ${skipped.join(", ")}.`);
		next = applied.doc;
	} else if (input.page !== undefined) {
		if (!isObject(input.page)) return failure([{ path: "/", code: "schema_invalid", expected: "a page-spec/v2 document (an object)", got: typeof input.page }]);
		next = cloneJson(input.page);
	} else {
		return failure([{ path: "/", code: "write_empty", expected: "page (a full document) or patch (RFC 6902 operations)", got: undefined }]);
	}
	const doc = next as PageV2;
	if (isObject(doc) && doc.version === undefined) doc.version = 2;
	for (const key of HOST_FIELDS) {
		if (base[key] !== undefined) (doc as Record<string, unknown>)[key] = base[key];
		else delete (doc as Record<string, unknown>)[key];
	}
	const layoutIssues: DocIssue[] = [];
	if (Array.isArray(doc.blocks)) normalizeBlocks(base, doc, notes, layoutIssues);
	if (layoutIssues.length) return failure(layoutIssues);
	if (Array.isArray(doc.blocks)) {
		const dropped = dropUnknownProps(doc);
		if (dropped.length) notes.push(`Dropped (not in the props schema of the block): ${dropped.join(", ")}.`);
	}
	const gate = checkPageDoc(doc);
	if (!gate.ok) return failure(gate.issues);
	// Render probe (ADR 0035): the blocks this write adds or changes must show something in the preview (server side only).
	const before = new Map(base.blocks.map((block) => [block.id, JSON.stringify(block)]));
	const unchanged = new Set(gate.page.blocks.flatMap((block, index) => (before.get(block.id) === JSON.stringify(block) ? [index] : [])));
	const rendering = renderIssues(gate.page, unchanged);
	if (rendering.length) return failure(rendering);
	const diff = diffPages(base, gate.page);
	if (diff.length > 0 && base.updatedAt !== undefined) gate.page.updatedAt = options.now ?? new Date().toISOString();
	return { ok: true, page: gate.page, diff, warnings: notes, changed: diff.length > 0 };
}

exports["freshBlockId"] = freshBlockId;
exports["normalizeBlocks"] = normalizeBlocks;
exports["writePage"] = writePage;

});

__def("packages/builder-core/src/page-doc/slots.ts", function (exports) {

function addSlotCheck(blocks: Pick<BlockV2, "item">[], at: number): SlotCheck {
	if (!Number.isInteger(at) || at < 0 || at > blocks.length) return { ok: false, code: "index_out_of_range", message: `A block goes to slot 0..${blocks.length}.` };
	return { ok: true };
}

/** Whether a block may move from `from` to final index `to`: the index must exist. */
function moveSlotCheck(blocks: Pick<BlockV2, "item">[], from: number, to: number): SlotCheck {
	if (!blocks[from] || !Number.isInteger(to) || to < 0 || to >= blocks.length) return { ok: false, code: "index_out_of_range", message: `A block moves to 0..${blocks.length - 1}.` };
	return { ok: true };
}

/** Where a new item goes when nobody said: the end of the page (a default, not a rule; an explicit slot is always honoured). */
function naturalIndex(blocks: Pick<BlockV2, "item">[], _item: string): number {
	return blocks.length;
}

exports["addSlotCheck"] = addSlotCheck;
exports["moveSlotCheck"] = moveSlotCheck;
exports["naturalIndex"] = naturalIndex;

});

__def("packages/builder-core/src/page-doc/empty.ts", function (exports) {

function emptyPage(input: { title: string; locale?: string | null; now?: Date | string; id?: string }): PageV2 {
	const stamp = (input.now ? new Date(input.now) : new Date()).toISOString();
	const title = input.title.trim().slice(0, 160) || "New page";
	return {
		version: 2,
		id: input.id ?? "page-draft",
		slug: "home",
		status: "draft",
		title,
		locale: input.locale && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.locale) ? input.locale : "en",
		seo: { title: title.slice(0, 200), description: "" },
		createdAt: stamp,
		updatedAt: stamp,
		blocks: []
	};
}

exports["emptyPage"] = emptyPage;

});

__def("packages/builder-core/src/page-doc/ops-core.ts", function (exports) {
const { cloneJson } = __req("packages/page-contract/src/index.ts");
const { pointerInfo } = __req("packages/builder-core/src/catalog/props-schema.ts");
const { effectiveProps } = __req("packages/builder-core/src/page-doc/render.ts");
const { writePage } = __req("packages/builder-core/src/page-doc/write.ts");
const MAX_ROWS = 24;

/** What a session history entry says an edit did (session 1.6.0 `op`). */
const fail = (code: string, message: string, pointer = ""): OpResult => ({ ok: false, code, message, pointer, issues: [{ path: pointer || "/", code, expected: message }] });

function done(result: WriteResult, blockId: string, op: OpName, path?: string): OpResult {
	if (!result.ok) return { ok: false, code: result.issues[0]?.code ?? "write_invalid", message: `${result.issues[0]?.path ?? "/"}: ${result.issues[0]?.expected ?? result.message}`, pointer: result.issues[0]?.path, issues: result.issues };
	return { ok: true, page: result.page, blockId, op, ...(path ? { path } : {}), diff: result.diff, warnings: result.warnings };
}


function pointerParts(pointer: string): string[] {
	return pointer.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** A copy of `props` with `value` written at `pointer` (undefined removes it); null when the path does not exist above the last key. */
function setAtPointer(props: Record<string, unknown>, pointer: string, value: unknown): Record<string, unknown> | null {
	const parts = pointerParts(pointer);
	if (!parts.length) return null;
	const root = cloneJson(props);
	let at: unknown = root;
	for (const part of parts.slice(0, -1)) {
		if (at === null || typeof at !== "object") return null;
		at = (at as Record<string, unknown>)[part];
	}
	if (at === null || typeof at !== "object") return null;
	const last = parts[parts.length - 1]!;
	if (Array.isArray(at)) {
		const index = Number(last);
		if (!Number.isInteger(index) || index < 0 || index > at.length) return null;
		if (value === undefined) at.splice(index, 1);
		else at[index] = value;
	} else if (value === undefined) delete (at as Record<string, unknown>)[last];
	else (at as Record<string, unknown>)[last] = value;
	return root;
}

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointerParts(pointer)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

/**
 * A copy of `props` where every optional object above `pointer` exists (`{}`; the write fills what the schema requires of it),
 * so an edit under an absent optional object creates just the path it needs. Null when a missing parent is not an object
 * of the schema (a missing list has no row to step into).
 */
function ensureParents(item: string, props: Record<string, unknown>, pointer: string): Record<string, unknown> | null {
	const parts = pointerParts(pointer);
	let next = props;
	for (let depth = 1; depth < parts.length; depth += 1) {
		const prefix = `/${parts.slice(0, depth).map((part) => part.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
		const here = valueAt(next, prefix);
		if (here !== undefined && here !== null) continue;
		if (pointerInfo(item, prefix)?.kind !== "object") return null;
		const made = setAtPointer(next, prefix, {});
		if (!made) return null;
		next = made;
	}
	return next;
}

/** `props` without the optional objects `pointer` leaves empty once its own value is gone (a cleared edit never leaves `{}` behind). */
function pruneEmpty(item: string, props: Record<string, unknown>, pointer: string): Record<string, unknown> {
	let next = props;
	const parts = pointerParts(pointer);
	for (let depth = parts.length - 1; depth >= 1; depth -= 1) {
		const prefix = `/${parts.slice(0, depth).join("/")}`;
		const here = valueAt(next, prefix);
		const info = pointerInfo(item, prefix);
		if (!info || info.required || (info.kind !== "object" && info.kind !== "map") || !here || typeof here !== "object" || Array.isArray(here) || Object.keys(here).length) break;
		next = setAtPointer(next, prefix, undefined) ?? next;
	}
	return next;
}

/** The effective props of a block (what the component renders) as the base of an edit. */
function liveProps(block: BlockV2): Record<string, unknown> {
	return effectiveProps(block.item, block.variant, block.props);
}

function replaceProps(page: PageV2, index: number, props: Record<string, unknown>, op: OpName, path?: string): OpResult {
	const block = page.blocks[index]!;
	return done(writePage(page, { patch: [{ op: "replace", path: `/blocks/${index}/props`, value: props }] }), block.id, op, path);
}

exports["MAX_ROWS"] = MAX_ROWS;
exports["fail"] = fail;
exports["done"] = done;
exports["setAtPointer"] = setAtPointer;
exports["valueAt"] = valueAt;
exports["ensureParents"] = ensureParents;
exports["pruneEmpty"] = pruneEmpty;
exports["liveProps"] = liveProps;
exports["replaceProps"] = replaceProps;

});

__def("packages/builder-core/src/page-doc/inspect.ts", function (exports) {
const { propsEventsFor, propsFieldTree } = __req("packages/builder-core/src/catalog/props-schema.ts");
const { toMajor, toMinor } = __req("packages/builder-core/src/catalog/money.ts");
const { layoutAxes } = __req("packages/builder-core/src/catalog/blocks.ts");
const { itemInfo } = __req("packages/builder-core/src/page-doc/items.ts");
const { effectiveProps } = __req("packages/builder-core/src/page-doc/render.ts");
const HIDDEN = new Set(["id", "class", "className", "imageSrcset"]);
const LONG_TEXT = 200;
const LONG_NAMES = /^(?:lede|summary|description|text|body|answer|quote)$/;
const MAX_ROWS = 24;

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function widgetFor(node: PropsFieldNode): InspectorWidget {
	switch (node.kind) {
		case "text":
			return LONG_NAMES.test(node.name) || (node.maxLength ?? 0) > LONG_TEXT ? "longtext" : "text";
		case "icon":
		case "enum":
		case "boolean":
		case "number":
		case "object":
			return node.kind;
		case "list":
			return node.fields ? "list" : node.item ? "values" : "other";
		case "map":
			return node.item ? "map" : "other";
		default:
			return "other";
	}
}

function fieldsOf(props: Record<string, unknown>, nodes: PropsFieldNode[], base: string, hidden: ReadonlySet<string>): InspectorField[] {
	const out: InspectorField[] = [];
	for (const node of nodes) {
		if (HIDDEN.has(node.name) || hidden.has(node.name)) continue;
		const pointer = `${base}/${node.name}`;
		const field: InspectorField = { pointer, name: node.name, widget: widgetFor(node), required: node.required, value: valueAt(props, pointer) };
		if (node.enum) field.options = node.enum;
		if (node.enumValues?.some((value) => typeof value !== "string")) field.optionValues = node.enumValues;
		if (node.maxLength !== undefined) field.maxLength = node.maxLength;
		if (node.money) {
			const owner = valueAt(props, base === "" ? "" : base);
			const currency = owner && typeof owner === "object" && "currency" in owner ? owner.currency : undefined;
			if (typeof currency === "string" && currency) field.money = { currency };
		}
		if (field.widget === "object" && node.fields) field.fields = fieldsOf(props, node.fields, pointer, new Set());
		if (field.widget === "list" && node.fields) {
			const rows = Array.isArray(field.value) ? field.value : [];
			field.list = { max: Math.min(node.maxItems ?? MAX_ROWS, MAX_ROWS), min: node.minItems ?? 0 };
			field.rows = rows.map((_, index) => ({ pointer: `${pointer}/${index}`, fields: fieldsOf(props, node.fields!, `${pointer}/${index}`, new Set()) }));
		}
		if (field.widget === "values" && node.item) {
			const entries = Array.isArray(field.value) ? field.value : [];
			field.list = { max: Math.min(node.maxItems ?? MAX_ROWS, MAX_ROWS), min: node.minItems ?? 0 };
			field.items = entries.map((entry, index) => entryField(node.item!, `${pointer}/${index}`, `${node.name} ${index + 1}`, entry));
		}
		if (field.widget === "map" && node.item) {
			const map = field.value && typeof field.value === "object" && !Array.isArray(field.value) ? (field.value as Record<string, unknown>) : {};
			field.list = { max: Math.min(node.maxItems ?? MAX_ROWS, MAX_ROWS), min: node.minItems ?? 0 };
			if (node.keyPattern) field.keyPattern = node.keyPattern;
			field.entries = Object.entries(map).map(([key, entry]) => ({ key, field: entryField(node.item!, `${pointer}/${pointerKey(key)}`, key, entry) }));
		}
		out.push(field);
	}
	return out;
}

/** A map key as one part of a JSON Pointer. */
const pointerKey = (key: string): string => key.replace(/~/g, "~0").replace(/\//g, "~1");

/** One entry of a list of plain values as a field of its own (so it edits like any scalar prop). */
function entryField(item: ListItemNode, pointer: string, name: string, value: unknown): InspectorField {
	const field: InspectorField = { pointer, name, widget: item.kind, required: true, value };
	if (item.enum) field.options = item.enum;
	if (item.enumValues?.some((entry) => typeof entry !== "string")) field.optionValues = item.enumValues;
	if (item.maxLength !== undefined) field.maxLength = item.maxLength;
	return field;
}

/** The inspector fields of a block, or an honest stub when its item is not in the registry or has no published schema. */
function inspectorModel(block: Pick<BlockV2, "id" | "item" | "variant" | "props">): InspectorModel {
	const info = itemInfo(block.item);
	const head = { blockId: block.id, title: info?.title ?? block.item };
	if (!info) return { ok: false, ...head, reason: "not_in_registry" };
	const tree = propsFieldTree(block.item);
	if (!tree) return { ok: false, ...head, reason: "no_schema" };
	const { events, slots } = propsEventsFor(block.item);
	const variant = block.variant && info.variants.includes(block.variant) ? block.variant : info.defaultVariant;
	const props = effectiveProps(block.item, variant, block.props);
	// One layout control: the Variant select. The axes it sets (media, cols, surface) are not fields of their own.
	return { ok: true, ...head, item: block.item, variant, variants: info.variants, fields: fieldsOf(props, tree, "", new Set([...events, ...slots, ...layoutAxes(block.item)])) };
}

/**
 * The JSON value a field widget typed as text, as `block.props` holds it (undefined: the prop is removed). The one place
 * the Inspector turns widget text into a typed value: a boolean from a checkbox, a number, an enum member in the type
 * the schema declares (1 | 2 stays a number, not "2").
 */
function inspectorValue(field: Pick<InspectorField, "widget" | "required" | "optionValues" | "money">, text: string): string | number | boolean | null | undefined {
	switch (field.widget) {
		case "boolean":
			return text === "true";
		case "number": {
			if (text.trim() === "") return field.required ? 0 : undefined;
			const n = Number(text);
			if (!Number.isFinite(n)) return text as unknown as number;
			// Money: the author types major units (650), the document holds minor units (65000).
			return field.money ? toMinor(n, field.money.currency) : n;
		}
		case "enum": {
			if (text === "") return undefined;
			const typed = field.optionValues?.find((value) => String(value) === text);
			return typed === undefined ? text : typed;
		}
		default:
			return text === "" && !field.required ? undefined : text;
	}
}

/** The text a number widget shows: major units for a money field (65000 RUB -> "650"), the value as it is otherwise. */
function inspectorShown(field: Pick<InspectorField, "value" | "money">): string {
	const value = field.value;
	if (value === undefined || value === null) return "";
	if (field.money && typeof value === "number") return String(toMajor(value, field.money.currency));
	return typeof value === "string" ? value : JSON.stringify(value);
}

exports["pointerKey"] = pointerKey;
exports["inspectorModel"] = inspectorModel;
exports["inspectorValue"] = inspectorValue;
exports["inspectorShown"] = inspectorShown;

});

__def("packages/builder-core/src/page-doc/ops-rows.ts", function (exports) {
const { cloneJson } = __req("packages/page-contract/src/index.ts");
const { mapKeyIssue, newPropsListRow, newPropsListValue, newPropsMapValue } = __req("packages/builder-core/src/catalog/props-fill.ts");
const { pointerInfo } = __req("packages/builder-core/src/catalog/props-schema.ts");
const { pointerKey } = __req("packages/builder-core/src/page-doc/inspect.ts");
const { MAX_ROWS, ensureParents, fail, liveProps, pruneEmpty, replaceProps, setAtPointer, valueAt } = __req("packages/builder-core/src/page-doc/ops-core.ts");
function mapEntryOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "map_entry" }>): OpResult {
		let props = liveProps(block);
		const shape = pointerInfo(block.item, input.pointer);
		if (shape?.kind !== "map") return fail("not_a_map", `${input.pointer} is not a map of values.`, input.pointer);
		let map = valueAt(props, input.pointer);
		// an optional map that is absent: `add` creates it (and the optional objects above it)
		if (map === undefined || map === null) {
			const parents = input.action === "add" ? ensureParents(block.item, props, input.pointer) : null;
			if (!parents) return fail("not_a_map", `${input.pointer} has no entries.`, input.pointer);
			props = parents;
			map = {};
		}
		if (typeof map !== "object" || Array.isArray(map)) return fail("not_a_map", `${input.pointer} is not a map of values.`, input.pointer);
		const entries = Object.entries(map as Record<string, unknown>);
		const keys = entries.map(([key]) => key);
		const max = Math.min(shape.maxItems ?? MAX_ROWS, MAX_ROWS);
		const issue = (code: "empty_key" | "duplicate_key" | "bad_key", key: string) =>
			fail(code, code === "empty_key" ? "A key is not empty." : code === "duplicate_key" ? `The key "${key}" is already used.` : `"${key}" is not a key a page may write here: a letter first, then letters, digits or _ (48 at most)${shape.keyPattern ? `, and ${shape.keyPattern}` : ""}.`, input.pointer);
		let next: Array<[string, unknown]>;
		let touched = input.key ?? "";
		let name: OpName = "set_field";
		if (input.action === "add") {
			if (keys.length >= max) return fail("max_rows", `${input.pointer} holds at most ${max} entries.`, input.pointer);
			let key = input.key;
			if (key === undefined) {
				let n = keys.length + 1;
				while (keys.includes(`key${n}`)) n += 1;
				key = `key${n}`;
			}
			const bad = mapKeyIssue(key, keys, shape.keyPattern);
			if (bad) return issue(bad, key);
			const value = newPropsMapValue(block.item, input.pointer, Object.values(map as Record<string, unknown>));
			if (value === undefined) return fail("not_a_map", `${input.pointer} is not a map the Inspector adds to.`, input.pointer);
			next = [...entries, [key, value]];
			touched = key;
			name = "add";
		} else {
			const key = input.key ?? "";
			if (!keys.includes(key)) return fail("unknown_key", `${input.pointer} has no key "${key}".`, input.pointer);
			if (input.action === "remove") {
				if (keys.length - 1 < (shape.minItems ?? 0) && !(keys.length === 1 && shape.required === false)) return fail("min_rows", `${input.pointer} needs at least ${shape.minItems} entries.`, input.pointer);
				next = entries.filter(([k]) => k !== key);
				name = "remove";
			} else {
				const to = input.to ?? "";
				const bad = to === key ? null : mapKeyIssue(to, keys.filter((k) => k !== key), shape.keyPattern);
				if (bad) return issue(bad, to);
				next = entries.map(([k, v]) => (k === key ? [to, v] : [k, v]));
				touched = to;
			}
		}
		const emptied = !next.length && shape.required === false;
		const written = setAtPointer(props, input.pointer, emptied ? undefined : Object.fromEntries(next));
		const result = written && emptied ? pruneEmpty(block.item, written, input.pointer) : written;
		if (!result) return fail("path_not_found", `${input.pointer} does not exist.`, input.pointer);
		return replaceProps(page, index, result, name, `${input.pointer}/${pointerKey(touched)}`);
}

function listRowOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "list_row" }>): OpResult {
		let props = liveProps(block);
		let rows = valueAt(props, input.pointer);
		// an optional list that is absent: `add` creates it (and the optional objects above it), the other actions have no row
		if (rows === undefined && input.action === "add" && pointerInfo(block.item, input.pointer)?.kind === "array") {
			const parents = ensureParents(block.item, props, input.pointer);
			if (parents) {
				props = parents;
				rows = [];
			}
		}
		if (!Array.isArray(rows)) return fail("not_a_list", `${input.pointer} is not a list.`, input.pointer);
		const row = input.row ?? rows.length - 1;
		const list = [...rows];
		let name: OpName;
		const shape = pointerInfo(block.item, input.pointer);
		const max = Math.min(shape?.maxItems ?? MAX_ROWS, MAX_ROWS);
		if ((input.action === "add" || input.action === "duplicate") && list.length >= max) return fail("max_rows", `${input.pointer} holds at most ${max} entries.`, input.pointer);
		if (input.action === "add") {
			// a list of records adds a row of its required fields, a list of plain values one new entry
			const fresh = newPropsListRow(block.item, input.pointer, rows) ?? newPropsListValue(block.item, input.pointer, rows);
			if (fresh === undefined || fresh === null) return fail("not_a_record_list", `${input.pointer} is not a list the Inspector adds to.`, input.pointer);
			list.push(fresh);
			name = "add";
		} else if (input.action === "remove" && list.length - 1 < (shape?.minItems ?? 0) && !(list.length === 1 && shape?.required === false)) {
			return fail("min_rows", `${input.pointer} needs at least ${shape?.minItems} entries.`, input.pointer);
		} else if (!Number.isInteger(row) || row < 0 || row >= list.length) return fail("index_out_of_range", `Row ${row + 1} is not in the list.`, input.pointer);
		else if (input.action === "remove") {
			list.splice(row, 1);
			name = "remove";
		} else if (input.action === "duplicate") {
			const copy = cloneJson(list[row]) as Record<string, unknown>;
			if (copy && typeof copy.id === "string") copy.id = `${copy.id}-copy`.slice(0, 64);
			list.splice(row + 1, 0, copy);
			name = "insert";
		} else {
			const to = input.action === "up" ? row - 1 : row + 1;
			if (to < 0 || to >= list.length) return fail("index_out_of_range", `Row ${row + 1} cannot move ${input.action}.`, input.pointer);
			[list[row], list[to]] = [list[to], list[row]];
			name = "move";
		}
		// the last row of an optional list taken away leaves the list absent, not an empty (maybe invalid) one
		const emptied = !list.length && pointerInfo(block.item, input.pointer)?.required === false;
		const written = setAtPointer(props, input.pointer, emptied ? undefined : list);
		const next = written && emptied ? pruneEmpty(block.item, written, input.pointer) : written;
		if (!next) return fail("path_not_found", `${input.pointer} does not exist.`, input.pointer);
		return replaceProps(page, index, next, name, `${input.pointer}/${input.action === "add" ? list.length - 1 : row}`);
}

exports["mapEntryOp"] = mapEntryOp;
exports["listRowOp"] = listRowOp;

});

__def("packages/builder-core/src/page-doc/ops.ts", function (exports) {
const { cloneJson } = __req("packages/page-contract/src/index.ts");
const { coerceEnumValue } = __req("packages/builder-core/src/catalog/props-fill.ts");
const { addSlotCheck, moveSlotCheck, naturalIndex } = __req("packages/builder-core/src/page-doc/slots.ts");
const { itemInfo } = __req("packages/builder-core/src/page-doc/items.ts");
const { sampleProps } = __req("packages/builder-core/src/page-doc/render.ts");
const { freshBlockId, writePage } = __req("packages/builder-core/src/page-doc/write.ts");
const { ensureParents, fail, done, liveProps, pruneEmpty, replaceProps, setAtPointer } = __req("packages/builder-core/src/page-doc/ops-core.ts");
const { listRowOp, mapEntryOp } = __req("packages/builder-core/src/page-doc/ops-rows.ts");
function checkAdd(item: string, variant?: string | null): AddCheck {
	const info = itemInfo(item);
	if (!info) return { ok: false, code: "unknown_item", message: `${item} is not a block of the catalog.` };
	const want = variant || info.defaultVariant;
	if (!info.variants.includes(want)) return { ok: false, code: "unknown_variant", message: `${item} has no variant ${want}.` };
	return { ok: true, item, variant: want };
}

const indexOfBlock = (page: PageV2, id: string) => page.blocks.findIndex((block) => block.id === id);

/** One page operation. An operation that changes nothing returns the very same page object (no step, no revision). */
function applyOp(page: PageV2, input: PageOp): OpResult {
	const result = applyOpInner(page, input);
	return result.ok && result.diff.length === 0 ? { ...result, page } : result;
}

/** The registry item and variant an add or replace names, or why not. */
function itemAndVariant(item: string, variant: string | null | undefined): { ok: true; variant: string } | { ok: false; result: OpResult } {
	const info = itemInfo(item);
	if (!info) return { ok: false, result: fail("unknown_item", `${item} is not a registry item that renders.`) };
	const want = variant ?? info.defaultVariant;
	if (!info.variants.includes(want)) return { ok: false, result: fail("unknown_variant", `${item} has no variant ${want}.`) };
	return { ok: true, variant: want };
}

function pageFieldOp(page: PageV2, input: Extract<PageOp, { op: "page" }>): OpResult {
	const path = input.field === "seo.title" ? "/seo/title" : input.field === "seo.description" ? "/seo/description" : `/${input.field}`;
	const patch: Array<{ op: "add" | "replace"; path: string; value: unknown }> = [];
	if (path.startsWith("/seo/") && !page.seo) patch.push({ op: "add", path: "/seo", value: {} });
	patch.push({ op: path.startsWith("/seo/") && (page.seo as Record<string, unknown> | undefined)?.[path.slice(5)] === undefined ? "add" : "replace", path, value: input.value });
	return done(writePage(page, { patch }), "", "set_field", path);
}

function addOp(page: PageV2, input: Extract<PageOp, { op: "add" }>): OpResult {
	const named = itemAndVariant(input.item, input.variant);
	if (!named.ok) return named.result;
	const at = input.at ?? naturalIndex(page.blocks, input.item);
	const slot = addSlotCheck(page.blocks, at);
	if (!slot.ok) return fail(slot.code, slot.message);
	const result = writePage(page, { patch: [{ op: "add", path: `/blocks/${at}`, value: { item: input.item, variant: named.variant } }] });
	return done(result, result.ok ? result.page.blocks[at]!.id : "", input.at === undefined ? "add" : "insert");
}

function setOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "set" }>): OpResult {
	if (!input.pointer.startsWith("/")) return fail("bad_pointer", "A prop pointer starts with /.", input.pointer);
	const live = liveProps(block);
	const base = input.value === undefined ? live : ensureParents(block.item, live, input.pointer);
	const written = base ? setAtPointer(base, input.pointer, coerceEnumValue(block.item, input.pointer, input.value)) : null;
	const next = written && input.value === undefined ? pruneEmpty(block.item, written, input.pointer) : written;
	if (!next) return fail("path_not_found", `${input.pointer} does not exist in the props of ${block.item}.`, input.pointer);
	return replaceProps(page, index, next, "set_field", input.pointer);
}

function setVariantOp(page: PageV2, index: number, block: BlockV2, variant: string): OpResult {
	if (!itemInfo(block.item)?.variants.includes(variant)) return fail("unknown_variant", `${block.item} has no variant ${variant}.`);
	return done(writePage(page, { patch: [{ op: "replace", path: `/blocks/${index}/variant`, value: variant }] }), block.id, "set_variant");
}

function moveOp(page: PageV2, index: number, block: BlockV2, to: number): OpResult {
	const slot = moveSlotCheck(page.blocks, index, to);
	if (!slot.ok) return fail(slot.code, slot.message);
	if (to === index) return { ok: true, page, blockId: block.id, op: "move", diff: [], warnings: [] };
	return done(writePage(page, { patch: [{ op: "move", from: `/blocks/${index}`, path: `/blocks/${to}` }] }), block.id, "move");
}

function duplicateOp(page: PageV2, index: number, block: BlockV2): OpResult {
	const id = freshBlockId(block.item, new Set(page.blocks.map((entry) => entry.id)));
	const copy: BlockV2 = { ...cloneJson(block), id };
	if (copy.props && typeof copy.props.id === "string") copy.props = { ...copy.props, id };
	return done(writePage(page, { patch: [{ op: "add", path: `/blocks/${index + 1}`, value: copy }] }), id, "insert");
}

function replaceOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "replace" }>): OpResult {
	const named = itemAndVariant(input.item, input.variant);
	if (!named.ok) return named.result;
	const patch: Array<{ op: "replace"; path: string; value: unknown }> = [
		{ op: "replace", path: `/blocks/${index}/item`, value: input.item },
		{ op: "replace", path: `/blocks/${index}/variant`, value: named.variant }
	];
	return done(writePage(page, { patch }), block.id, "replace");
}

function applyOpInner(page: PageV2, input: PageOp): OpResult {
	if (input.op === "page") return pageFieldOp(page, input);
	if (input.op === "add") return addOp(page, input);
	const index = indexOfBlock(page, input.blockId);
	if (index < 0) return fail("unknown_block", `No block ${input.blockId} on the page.`);
	const block = page.blocks[index]!;
	switch (input.op) {
		case "set":
			return setOp(page, index, block, input);
		case "set_variant":
			return setVariantOp(page, index, block, input.variant);
		case "reset":
			return replaceProps(page, index, sampleProps(block.item, block.variant, block.id), "replace");
		case "move":
			return moveOp(page, index, block, input.to);
		case "duplicate":
			return duplicateOp(page, index, block);
		case "remove":
			return done(writePage(page, { patch: [{ op: "remove", path: `/blocks/${index}` }] }), page.blocks[index + 1]?.id ?? page.blocks[index - 1]?.id ?? "", "remove");
		case "replace":
			return replaceOp(page, index, block, input);
		case "map_entry":
			return mapEntryOp(page, index, block, input);
		case "list_row":
			return listRowOp(page, index, block, input);
	}
}

exports["setAtPointer"] = setAtPointer;
exports["checkAdd"] = checkAdd;
exports["applyOp"] = applyOp;

});

__def("packages/builder-core/src/page-doc/money-view.ts", function (exports) {
const { toMajor, toMinor } = __req("packages/builder-core/src/catalog/money.ts");
const { propsFieldTree } = __req("packages/builder-core/src/catalog/props-schema.ts");
type MoneyDirection = "view" | "store";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const convert = (value: number, currency: string, to: MoneyDirection): number => (to === "view" ? toMajor(value, currency) : toMinor(value, currency));

/** A value of the shape `nodes` describe (an object or a row), its money props converted; `currency` is the fallback when it has none of its own. */
function walk(value: unknown, nodes: PropsFieldNode[] | undefined, to: MoneyDirection, currency?: string): unknown {
	return isObject(value) && nodes ? walkObject(value, nodes, to, currency) : value;
}

function walkObject(value: Record<string, unknown>, nodes: PropsFieldNode[], to: MoneyDirection, currency?: string): Record<string, unknown> {
	const own = typeof value.currency === "string" && value.currency ? value.currency : currency;
	const out: Record<string, unknown> = { ...value };
	for (const node of nodes) {
		const inner = value[node.name];
		if (inner === undefined) continue;
		if (node.money) {
			if (typeof inner === "number" && own) out[node.name] = convert(inner, own, to);
		} else if (node.kind === "list" && Array.isArray(inner) && node.fields) out[node.name] = inner.map((row) => walk(row, node.fields, to));
		else if (node.kind === "object" && node.fields) out[node.name] = walk(inner, node.fields, to);
	}
	return out;
}

/** The props of a block of `item` with its money converted ("view": stored -> major, "store": major -> stored). Props without money are returned as they are. */
function convertProps(item: string, props: unknown, to: MoneyDirection): Record<string, unknown> {
	if (!isObject(props)) return {};
	const tree = propsFieldTree(item);
	return tree ? walkObject(props, tree, to) : props;
}

function convertBlock(block: unknown, to: MoneyDirection): unknown {
	return isObject(block) && typeof block.item === "string" && isObject(block.props) ? { ...block, props: convertProps(block.item, block.props, to) } : block;
}

/** A page document with the money of every block converted. */
function convertPage<T extends { blocks?: unknown }>(page: T, to: MoneyDirection): T {
	return Array.isArray(page.blocks) ? { ...page, blocks: page.blocks.map((block: unknown) => convertBlock(block, to)) } : page;
}

/** What the model reads of a page: stored minor units shown as major units. */
const pageForModel = (page: PageV2): PageV2 => convertPage(page, "view");
/** What the model writes as a whole page: major units turned into what the document stores. */
const pageFromModel = <T extends { blocks?: unknown }>(page: T): T => convertPage(page, "store");

/** The input of write_page as the model wrote it ({ page } or { patch }, money in major units) as the write gate takes it (money in stored units). */
function writeInputFromModel(working: PageV2, args: { page?: unknown; patch?: unknown }): { page?: unknown; patch?: unknown } {
	const input: { page?: unknown; patch?: unknown } = {};
	if (args.page !== undefined) input.page = isObject(args.page) ? pageFromModel(args.page) : args.page;
	if (args.patch !== undefined) input.patch = isObject(args.patch) && Array.isArray(args.patch.ops) ? { ...args.patch, ops: patchFromModel(working, args.patch.ops) } : patchFromModel(working, args.patch);
	return input;
}

/** Where a JSON Pointer inside a block's props lands in the field tree: the nodes a value there is made of, or the money node itself. */
type Target = { kind: "fields"; nodes: PropsFieldNode[] } | { kind: "money"; parentPointer: string } | null;

function targetAt(item: string, pointer: string): Target {
	let nodes: PropsFieldNode[] | undefined = propsFieldTree(item) ?? undefined;
	let current: PropsFieldNode | undefined;
	const parts = pointer.split("/").slice(1);
	for (let i = 0; i < parts.length; i += 1) {
		const part = parts[i]!;
		if (/^\d+$/.test(part) || part === "-") {
			// a row of the list `current`: what lies below is its fields
			if (!current || current.kind !== "list" || !current.fields) return null;
			nodes = current.fields;
			current = undefined;
			continue;
		}
		const next: PropsFieldNode | undefined = nodes?.find((node) => node.name === part);
		if (!next) return null;
		if (next.money) return i === parts.length - 1 ? { kind: "money", parentPointer: parts.slice(0, i).map((p) => `/${p}`).join("") } : null;
		current = next;
		nodes = next.kind === "object" ? next.fields : undefined;
	}
	if (!current) return nodes ? { kind: "fields", nodes } : null;
	if (current.kind === "list" && current.fields) return { kind: "fields", nodes: current.fields };
	if (current.kind === "object" && current.fields) return { kind: "fields", nodes: current.fields };
	return null;
}

function valueAtPointer(root: unknown, pointer: string): unknown {
	let current = root;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
		current = isObject(current) ? current[key] : Array.isArray(current) ? current[Number(key)] : undefined;
	}
	return current;
}

/** A block as an operation sees it: its item and props (the currency beside a lone money value is read from them). */
type Slot = { item: string; props: unknown };

const BLOCK_PATH = /^\/blocks\/(\d+|-)(\/.*)?$/;

/** The value of one operation (path under `/blocks`) from what the model wrote to what the document stores; `blocks` are the blocks the operation sees, in order. */
function opValue(blocks: Slot[], path: string, value: unknown): unknown {
	if (path === "" || path === "/") return isObject(value) ? pageFromModel(value) : value;
	if (path === "/blocks") return Array.isArray(value) ? value.map((block: unknown) => convertBlock(block, "store")) : value;
	const hit = BLOCK_PATH.exec(path);
	if (!hit) return value;
	const index = hit[1] === "-" ? blocks.length : Number(hit[1]);
	const rest = hit[2] ?? "";
	if (rest === "") return convertBlock(value, "store");
	if (!rest.startsWith("/props")) return value;
	const item = blocks[index]?.item;
	if (!item) return value;
	const pointer = rest.slice("/props".length);
	if (pointer === "") return convertProps(item, value, "store");
	const target = targetAt(item, pointer);
	if (!target) return value;
	if (target.kind === "fields") {
		if (Array.isArray(value)) return value.map((row) => walk(row, target.nodes, "store"));
		return walk(value, target.nodes, "store");
	}
	// a lone money prop: the currency sits beside it in the block as it is now
	const owner = valueAtPointer(blocks[index]?.props, target.parentPointer);
	const currency = isObject(owner) && typeof owner.currency === "string" ? owner.currency : undefined;
	return typeof value === "number" && currency ? toMinor(value, currency) : value;
}

/** The operations of a JSON Patch the model wrote with their values in stored units (paths and operations unchanged). `base` is the page the patch applies to. */
function patchFromModel(base: PageV2, ops: unknown): unknown {
	if (!Array.isArray(ops)) return ops;
	const slots: Slot[] = base.blocks.map((block) => ({ item: block.item, props: block.props }));
	return ops.map((op) => {
		if (!isObject(op) || typeof op.path !== "string") return op;
		const kind = op.op;
		let out = op;
		if ((kind === "add" || kind === "replace" || kind === "test") && "value" in op) out = { ...op, value: opValue(slots, op.path, op.value) };
		// keep the blocks in step with block adds and removes, so later indices find their block
		const block = /^\/blocks\/(\d+|-)$/.exec(op.path);
		if (block && kind === "add") slots.splice(block[1] === "-" ? slots.length : Number(block[1]), 0, isObject(op.value) && typeof op.value.item === "string" ? { item: op.value.item, props: op.value.props } : { item: "", props: undefined });
		else if (block && kind === "remove" && block[1] !== "-") slots.splice(Number(block[1]), 1);
		return out;
	});
}

exports["convertProps"] = convertProps;
exports["pageForModel"] = pageForModel;
exports["pageFromModel"] = pageFromModel;
exports["writeInputFromModel"] = writeInputFromModel;
exports["patchFromModel"] = patchFromModel;

});

__def("packages/builder-core/src/page-doc/index.ts", function (exports) {
exports["allItems"] = __req("packages/builder-core/src/page-doc/items.ts")["allItems"];
exports["itemInfo"] = __req("packages/builder-core/src/page-doc/items.ts")["itemInfo"];
exports["variantOrDefault"] = __req("packages/builder-core/src/page-doc/items.ts")["variantOrDefault"];
exports["blankRequired"] = __req("packages/builder-core/src/page-doc/render.ts")["blankRequired"];
exports["effectiveProps"] = __req("packages/builder-core/src/page-doc/render.ts")["effectiveProps"];
exports["renderBlock"] = __req("packages/builder-core/src/page-doc/render.ts")["renderBlock"];
exports["sampleProps"] = __req("packages/builder-core/src/page-doc/render.ts")["sampleProps"];
exports["checkPageDoc"] = __req("packages/builder-core/src/page-doc/gate.ts")["checkPageDoc"];
exports["pointerOfSchemaPath"] = __req("packages/builder-core/src/page-doc/gate.ts")["pointerOfSchemaPath"];
exports["registryIssues"] = __req("packages/builder-core/src/page-doc/gate.ts")["registryIssues"];
exports["valueAtPointer"] = __req("packages/builder-core/src/page-doc/gate.ts")["valueAtPointer"];
exports["applyJsonPatch"] = __req("packages/builder-core/src/page-doc/jsonpatch.ts")["applyJsonPatch"];
exports["changedPointers"] = __req("packages/builder-core/src/page-doc/diff.ts")["changedPointers"];
exports["diffIsEmpty"] = __req("packages/builder-core/src/page-doc/diff.ts")["diffIsEmpty"];
exports["diffPages"] = __req("packages/builder-core/src/page-doc/diff.ts")["diffPages"];
exports["freshBlockId"] = __req("packages/builder-core/src/page-doc/write.ts")["freshBlockId"];
exports["normalizeBlocks"] = __req("packages/builder-core/src/page-doc/write.ts")["normalizeBlocks"];
exports["writePage"] = __req("packages/builder-core/src/page-doc/write.ts")["writePage"];
exports["addSlotCheck"] = __req("packages/builder-core/src/page-doc/slots.ts")["addSlotCheck"];
exports["moveSlotCheck"] = __req("packages/builder-core/src/page-doc/slots.ts")["moveSlotCheck"];
exports["naturalIndex"] = __req("packages/builder-core/src/page-doc/slots.ts")["naturalIndex"];
exports["emptyPage"] = __req("packages/builder-core/src/page-doc/empty.ts")["emptyPage"];
exports["applyOp"] = __req("packages/builder-core/src/page-doc/ops.ts")["applyOp"];
exports["checkAdd"] = __req("packages/builder-core/src/page-doc/ops.ts")["checkAdd"];
exports["setAtPointer"] = __req("packages/builder-core/src/page-doc/ops.ts")["setAtPointer"];
exports["inspectorModel"] = __req("packages/builder-core/src/page-doc/inspect.ts")["inspectorModel"];
exports["inspectorShown"] = __req("packages/builder-core/src/page-doc/inspect.ts")["inspectorShown"];
exports["inspectorValue"] = __req("packages/builder-core/src/page-doc/inspect.ts")["inspectorValue"];
exports["pointerKey"] = __req("packages/builder-core/src/page-doc/inspect.ts")["pointerKey"];
exports["installRenderProbe"] = __req("packages/builder-core/src/page-doc/probe.ts")["installRenderProbe"];
exports["probeFromModule"] = __req("packages/builder-core/src/page-doc/probe.ts")["probeFromModule"];
exports["probeOutcome"] = __req("packages/builder-core/src/page-doc/probe.ts")["probeOutcome"];
exports["renderProbeInstalled"] = __req("packages/builder-core/src/page-doc/probe.ts")["renderProbeInstalled"];
exports["renderIssues"] = __req("packages/builder-core/src/page-doc/probe.ts")["renderIssues"];
exports["renderProblems"] = __req("packages/builder-core/src/page-doc/probe.ts")["renderProblems"];
exports["setRenderEmptyPolicy"] = __req("packages/builder-core/src/page-doc/probe.ts")["setRenderEmptyPolicy"];
exports["showsContent"] = __req("packages/builder-core/src/page-doc/probe.ts")["showsContent"];
exports["convertProps"] = __req("packages/builder-core/src/page-doc/money-view.ts")["convertProps"];
exports["pageForModel"] = __req("packages/builder-core/src/page-doc/money-view.ts")["pageForModel"];
exports["pageFromModel"] = __req("packages/builder-core/src/page-doc/money-view.ts")["pageFromModel"];
exports["patchFromModel"] = __req("packages/builder-core/src/page-doc/money-view.ts")["patchFromModel"];
exports["writeInputFromModel"] = __req("packages/builder-core/src/page-doc/money-view.ts")["writeInputFromModel"];
exports["expandMacros"] = __req("packages/builder-core/src/page-doc/macros.ts")["expandMacros"];
exports["expandMacrosDeep"] = __req("packages/builder-core/src/page-doc/macros.ts")["expandMacrosDeep"];
exports["macroNames"] = __req("packages/builder-core/src/page-doc/macros.ts")["macroNames"];
exports["MACROS"] = __req("packages/builder-core/src/page-doc/macros.ts")["MACROS"];



});

__def("packages/builder-core/src/index.ts", function (exports) {
exports["SCENARIO_IDS"] = __req("packages/builder-core/src/copy.ts")["SCENARIO_IDS"];
exports["SCENARIO_PROMPTS"] = __req("packages/builder-core/src/copy.ts")["SCENARIO_PROMPTS"];
exports["PLACEHOLDERS"] = __req("packages/builder-core/src/copy.ts")["PLACEHOLDERS"];
exports["PLACEHOLDER_MODES"] = __req("packages/builder-core/src/copy.ts")["PLACEHOLDER_MODES"];
exports["PLACEHOLDER_ROTATION_MS"] = __req("packages/builder-core/src/copy.ts")["PLACEHOLDER_ROTATION_MS"];
exports["OWNER_FILTERS"] = __req("packages/builder-core/src/copy.ts")["OWNER_FILTERS"];
exports["catalogSources"] = __req("packages/builder-core/src/catalog/sources.ts")["catalogSources"];
exports["variantProps"] = __req("packages/builder-core/src/catalog/sources.ts")["variantProps"];
exports["catalogBlock"] = __req("packages/builder-core/src/catalog/blocks.ts")["catalogBlock"];
exports["catalogBlocks"] = __req("packages/builder-core/src/catalog/blocks.ts")["catalogBlocks"];
exports["catalogDigest"] = __req("packages/builder-core/src/catalog/blocks.ts")["catalogDigest"];
exports["catalogSearch"] = __req("packages/builder-core/src/catalog/blocks.ts")["catalogSearch"];
exports["prototypeProps"] = __req("packages/builder-core/src/catalog/blocks.ts")["prototypeProps"];
exports["layoutAxes"] = __req("packages/builder-core/src/catalog/blocks.ts")["layoutAxes"];
exports["variantAxisValues"] = __req("packages/builder-core/src/catalog/blocks.ts")["variantAxisValues"];
exports["variantSettingDefault"] = __req("packages/builder-core/src/catalog/blocks.ts")["variantSettingDefault"];
exports["variantSettingNames"] = __req("packages/builder-core/src/catalog/blocks.ts")["variantSettingNames"];
exports["setPropsValidator"] = __req("packages/builder-core/src/catalog/validator.ts")["setPropsValidator"];
exports["propsValidatorInstalled"] = __req("packages/builder-core/src/catalog/validator.ts")["propsValidatorInstalled"];
exports["validateItemProps"] = __req("packages/builder-core/src/catalog/validator.ts")["validateItemProps"];
exports["registryClosure"] = __req("packages/builder-core/src/catalog/organism.ts")["registryClosure"];
exports["registryItemFiles"] = __req("packages/builder-core/src/catalog/organism.ts")["registryItemFiles"];
exports["registrySkin"] = __req("packages/builder-core/src/catalog/organism.ts")["registrySkin"];
exports["registrySkinBaseCss"] = __req("packages/builder-core/src/catalog/organism.ts")["registrySkinBaseCss"];
exports["registrySkins"] = __req("packages/builder-core/src/catalog/organism.ts")["registrySkins"];
exports["skinItem"] = __req("packages/builder-core/src/catalog/organism.ts")["skinItem"];
exports["registryInitItems"] = __req("packages/builder-core/src/catalog/organism.ts")["registryInitItems"];
exports["registryItemClosure"] = __req("packages/builder-core/src/catalog/organism.ts")["registryItemClosure"];
exports["registryItemFor"] = __req("packages/builder-core/src/catalog/organism.ts")["registryItemFor"];
exports["registryNpmDependencies"] = __req("packages/builder-core/src/catalog/organism.ts")["registryNpmDependencies"];
exports["variantPreset"] = __req("packages/builder-core/src/catalog/organism.ts")["variantPreset"];
exports["variantPresets"] = __req("packages/builder-core/src/catalog/organism.ts")["variantPresets"];
exports["SAMPLE_MINOR"] = __req("packages/builder-core/src/catalog/money.ts")["SAMPLE_MINOR"];
exports["isMoneyName"] = __req("packages/builder-core/src/catalog/money.ts")["isMoneyName"];
exports["minorDigits"] = __req("packages/builder-core/src/catalog/money.ts")["minorDigits"];
exports["toMajor"] = __req("packages/builder-core/src/catalog/money.ts")["toMajor"];
exports["toMinor"] = __req("packages/builder-core/src/catalog/money.ts")["toMinor"];
exports["recordPictures"] = __req("packages/builder-core/src/catalog/pictures.ts")["recordPictures"];
exports["hasPropsSchema"] = __req("packages/builder-core/src/catalog/props-schema.ts")["hasPropsSchema"];
exports["lucideIcons"] = __req("packages/builder-core/src/catalog/props-schema.ts")["lucideIcons"];
exports["LUCIDE_ICON_HINT"] = __req("packages/builder-core/src/catalog/props-schema.ts")["LUCIDE_ICON_HINT"];
exports["propShapeFor"] = __req("packages/builder-core/src/catalog/props-schema.ts")["propShapeFor"];
exports["propsDigest"] = __req("packages/builder-core/src/catalog/props-schema.ts")["propsDigest"];
exports["propsEventsFor"] = __req("packages/builder-core/src/catalog/props-schema.ts")["propsEventsFor"];
exports["propsFieldTree"] = __req("packages/builder-core/src/catalog/props-schema.ts")["propsFieldTree"];
exports["propsItems"] = __req("packages/builder-core/src/catalog/props-schema.ts")["propsItems"];
exports["propsSchemaFor"] = __req("packages/builder-core/src/catalog/props-schema.ts")["propsSchemaFor"];
exports["propsSummaryFor"] = __req("packages/builder-core/src/catalog/props-schema.ts")["propsSummaryFor"];
exports["PAGE_KEY_PATTERN"] = __req("packages/builder-core/src/catalog/props-fill.ts")["PAGE_KEY_PATTERN"];
exports["coerceEnumProps"] = __req("packages/builder-core/src/catalog/props-fill.ts")["coerceEnumProps"];
exports["coerceEnumValue"] = __req("packages/builder-core/src/catalog/props-fill.ts")["coerceEnumValue"];
exports["fillProps"] = __req("packages/builder-core/src/catalog/props-fill.ts")["fillProps"];
exports["mapKeyIssue"] = __req("packages/builder-core/src/catalog/props-fill.ts")["mapKeyIssue"];
exports["newPropsListValue"] = __req("packages/builder-core/src/catalog/props-fill.ts")["newPropsListValue"];
exports["newPropsMapValue"] = __req("packages/builder-core/src/catalog/props-fill.ts")["newPropsMapValue"];
exports["fieldAtElement"] = __req("packages/builder-core/src/catalog/view-map.ts")["fieldAtElement"];
exports["listRows"] = __req("packages/builder-core/src/catalog/view-map.ts")["listRows"];
exports["locateField"] = __req("packages/builder-core/src/catalog/view-map.ts")["locateField"];
exports["mapKey"] = __req("packages/builder-core/src/catalog/view-map.ts")["mapKey"];
exports["mappedPointers"] = __req("packages/builder-core/src/catalog/view-map.ts")["mappedPointers"];
exports["valueAt"] = __req("packages/builder-core/src/catalog/view-map.ts")["valueAt"];
exports["viewMapOf"] = __req("packages/builder-core/src/catalog/view-map.ts")["viewMapOf"];
exports["isScenarioId"] = __req("packages/builder-core/src/brief.ts")["isScenarioId"];
exports["ALLOWED_TOOLS"] = __req("packages/builder-core/src/policy.ts")["ALLOWED_TOOLS"];
exports["resolveIconName"] = __req("packages/builder-core/src/icon-name.ts")["resolveIconName"];
exports["iconFixWarning"] = __req("packages/builder-core/src/icon-name.ts")["iconFixWarning"];
{ const __m = __req("packages/builder-core/src/page-doc/index.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }



});

__def("packages/chat-agent/src/agent/agent-tools.v1.json", function (exports) {
  exports.default = {
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"format": "buildy-agent-tools",
	"version": 4,
	"description": "Agent tools of the BuildY page builder: one definition per tool (name, description, JSON Schema parameters) and the chat modes that offer it. Hosts (chat runtime, WordPress builder) send only the tools of the active mode. x-buildy-enum names a value list the host fills from its pinned catalog or page contract before sending; hosts strip every x-* keyword. See ADR-0011.",
	"modes": {
		"ask": {
			"description": "Conversation about the catalog and the page. Read-only: Ask has no write tool and never changes the page or creates a proposal; changes are made in Build. Tool choice auto; the model's final text is the answer.",
			"toolChoice": "auto"
		},
		"build": {
			"description": "Edit the page. Tool choice required: read with tools, then write_page. An accepted write ends the turn and creates a pending proposal (a diff) for Apply. A text-only response creates no proposal; the host may nudge once.",
			"toolChoice": "required"
		}
	},
	"enumSources": {
		"catalog.items": "Every block of the catalog (registry item names)"
	},
	"tools": [
		{
			"name": "list_blocks",
			"modes": [
				"ask",
				"build"
			],
			"description": "List every block of the catalog (it is small): item, title, category, description, default variant and every variant with its label. Read-only.",
			"parameters": {
				"type": "object",
				"properties": {}
			}
		},
		{
			"name": "get_block",
			"modes": [
				"ask",
				"build"
			],
			"description": "Read one block of the catalog: its variants (label, layout axes, default settings such as align), the props you write (names, kinds, enums, rows; ? = optional) and the sample props a new block starts with. Read-only.",
			"parameters": {
				"type": "object",
				"properties": {
					"item": {
						"type": "string",
						"x-buildy-enum": "catalog.items",
						"description": "Registry item name of the block."
					},
					"variant": {
						"type": "string",
						"description": "Variant whose sample props to show; default variant when omitted."
					}
				},
				"required": [
					"item"
				]
			}
		},
		{
			"name": "get_page",
			"modes": [
				"ask",
				"build"
			],
			"description": "Read the page document as it is now in this turn: { version, slug, title, locale, seo, blocks:[{ id, item, variant, props }] }. props are exactly the component props. When a block throws or shows nothing in the preview, renderProblems lists it with the path of the prop to fix. Read-only.",
			"parameters": {
				"type": "object",
				"properties": {}
			}
		},
		{
			"name": "write_page",
			"modes": [
				"build"
			],
			"description": "Write the page: send the whole page document ({ page }) or an RFC 6902 JSON Patch of it ({ patch }). The host checks it and returns the diff or [{ path, code, expected, got }].",
			"parameters": {
				"type": "object",
				"properties": {
					"page": {
						"type": "object",
						"description": "The whole page document: { title, slug, locale, seo: { title, description }, blocks: [{ id?, item, variant?, props }] }. A block without id gets one; a new block starts from the registry sample props, then your props. locale is the ISO code of the language the author writes in.",
						"additionalProperties": true
					},
					"patch": {
						"type": "array",
						"description": "RFC 6902 operations on the page document (add, replace, remove, move, copy, test), paths as JSON Pointers: /title, /locale, /seo/description, /blocks/2/props/title, /blocks/- (append).",
						"items": {
							"type": "object",
							"additionalProperties": true
						}
					}
				}
			}
		}
	]
};
});

__def("packages/chat-agent/src/agent/agent-tools.ts", function (exports) {
const raw = __req("packages/chat-agent/src/agent/agent-tools.v1.json").default;
const { allItems } = __req("packages/builder-core/src/index.ts");
const AGENT_MODES = ["ask", "build"] as const;
type JsonSchemaObject = Record<string, unknown>;

type AgentToolDefinition = {
	name: string;
	modes: AgentMode[];
	description: string;
	descriptionByMode?: Partial<Record<AgentMode, string>>;
	parameters: JsonSchemaObject;
};

type AgentToolsDocument = {
	format: "buildy-agent-tools";
	version: number;
	description: string;
	modes: Record<AgentMode, { description: string; toolChoice: "auto" | "required" }>;
	enumSources: Record<string, string>;
	tools: AgentToolDefinition[];
};

const agentToolsDocument = raw as unknown as AgentToolsDocument;
const AGENT_TOOLS_VERSION = `${agentToolsDocument.format}/${agentToolsDocument.version}`;

/** The versioned mode policy shared by runtime and configuration viewers. */
function agentToolChoice(mode: AgentMode): "auto" | "required" {
 return agentToolsDocument.modes[mode].toolChoice;
}

function isAgentMode(value: unknown): value is AgentMode {
	return typeof value === "string" && (AGENT_MODES as string[]).includes(value);
}

/** Value lists named by `x-buildy-enum`: generated from the pinned catalog, never typed here. */
function agentEnumSource(name: string): string[] {
	switch (name) {
		case "catalog.items":
			return allItems();
		default:
			throw new Error(`agent-tools: unknown x-buildy-enum source ${name}`);
	}
}

/** Fill `x-buildy-enum` markers and drop every `x-*` keyword: a plain JSON Schema the provider accepts. */
function resolveAgentSchema<T>(node: T): T {
	if (Array.isArray(node)) return node.map((item) => resolveAgentSchema(item)) as T;
	if (typeof node !== "object" || node === null) return node;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		if (key === "x-buildy-enum") {
			out.enum = agentEnumSource(String(value));
			continue;
		}
		if (key.startsWith("x-")) continue;
		out[key] = resolveAgentSchema(value);
	}
	return out as T;
}

function agentTool(name: string): AgentToolDefinition | null {
	return agentToolsDocument.tools.find((tool) => tool.name === name) ?? null;
}

/** Tool names one mode offers, in file order. */
function agentToolNames(mode: AgentMode): string[] {
	return agentToolsDocument.tools.filter((tool) => tool.modes.includes(mode)).map((tool) => tool.name);
}

function toolOffersMode(name: string, mode: AgentMode): boolean {
	return Boolean(agentTool(name)?.modes.includes(mode));
}

const RESOLVED = new Map<string, ResolvedAgentTool[]>();

/** Neutral resolved tools. Definitions and schemas remain in the one versioned document. */
function agentTools(mode: AgentMode, only?: string[]): ResolvedAgentTool[] {
	const key = mode + ":" + (only ? only.join(",") : "*");
	const hit = RESOLVED.get(key);
	if (hit) return hit;
	const tools = agentToolsDocument.tools
		.filter((tool) => tool.modes.includes(mode) && (!only || only.includes(tool.name)))
		.map((tool) => ({ name: tool.name, description: tool.descriptionByMode?.[mode] ?? tool.description, parameters: resolveAgentSchema(tool.parameters) }));
	RESOLVED.set(key, tools);
	return tools;
}

/** Compatibility projection for existing callers; execution uses agentTools. */
function agentOpenAiTools(mode: AgentMode, only?: string[]) {
	return agentTools(mode, only).map((tool) => ({ type: "function" as const, function: tool }));
}

exports["AGENT_MODES"] = AGENT_MODES;
exports["agentToolsDocument"] = agentToolsDocument;
exports["AGENT_TOOLS_VERSION"] = AGENT_TOOLS_VERSION;
exports["agentToolChoice"] = agentToolChoice;
exports["isAgentMode"] = isAgentMode;
exports["agentToolNames"] = agentToolNames;
exports["toolOffersMode"] = toolOffersMode;
exports["agentTools"] = agentTools;
exports["agentOpenAiTools"] = agentOpenAiTools;

});

__def("packages/chat-agent/src/agent/blocks.ts", function (exports) {
const { LUCIDE_ICON_HINT, propsEventsFor, propsFieldTree } = __req("packages/builder-core/src/index.ts");
const { allItems, catalogBlock, itemInfo, layoutAxes, variantProps } = __req("packages/builder-core/src/index.ts");
const { convertProps, sampleProps } = __req("packages/builder-core/src/index.ts");
const HIDDEN = new Set(["id", "class", "className", "landmarkLabel", "imageSrcset"]);

/** An enum member as JSON: text in quotes ("3"), numbers and booleans bare (2), so the model writes the schema's type. */
const member = (value: unknown): string => JSON.stringify(value) ?? String(value);

function kindText(node: PropsFieldNode): string {
	if (node.kind === "enum") {
		const values = node.enumValues ?? node.enum ?? [];
		return `enum ${values.slice(0, 12).map(member).join("|")}${values.length > 12 ? "|..." : ""}`;
	}
	if (node.kind === "text") return node.maxLength ? `text<=${node.maxLength}` : "text";
	return node.kind;
}

function record(fields: PropsFieldNode[] | undefined): string {
	return (fields ?? [])
		.filter((field) => !HIDDEN.has(field.name) || field.name === "id")
		.map((field) => `${field.name}${field.required ? "" : "?"}:${field.kind === "object" ? `{${record(field.fields)}}` : field.kind === "list" ? `[${field.fields ? `{${record(field.fields)}}` : "text"}]` : kindText(field)}`)
		.join(" ");
}

/**
 * The props of an item as short lines (`features[]: id:text title:text icon:icon`; `?` marks optional), or null. The
 * layout axes (`media`, `cols`, `surface`) are not listed: the variant sets them (write.ts), the model writes `variant`.
 */
function propsOutline(item: string): string[] | null {
	const tree = propsFieldTree(item);
	if (!tree) return null;
	const { events, slots } = propsEventsFor(item);
	const skip = new Set([...HIDDEN, ...events, ...slots, ...layoutAxes(item)]);
	return tree
		.filter((node) => !skip.has(node.name))
		.map((node) => {
			const mark = node.required ? "" : "?";
			if (node.kind === "list") return `${node.name}${mark}[]${node.maxItems ? ` (max ${node.maxItems})` : ""}: ${node.fields ? record(node.fields) : "text"}`;
			if (node.kind === "object") return `${node.name}${mark}: {${record(node.fields)}}`;
			return `${node.name}${mark}: ${kindText(node)}`;
		});
}

/** `item (title; category; variants)` per block of the catalog: the whole vocabulary of a page. */
function itemIndex(): string[] {
	return allItems().map((item) => {
		const info = itemInfo(item)!;
		return `${item} (${info.title}; ${info.category}; ${info.variants.join("|")})`;
	});
}

function withoutAxes(props: Record<string, unknown>, axes: string[]): Record<string, unknown> {
	const out = { ...props };
	for (const axis of axes) delete out[axis];
	return out;
}

type BlockReadOk = {
	ok: true;
	item: string;
	title: string;
	description: string;
	category: string;
	install: string;
	defaultVariant: string;
	/** Every variant: its label, the layout axes it sets and the settings it renders with by default (block-contract/v1). */
	variants: Array<{ id: string; label: string; axes: Record<string, string>; settings?: Record<string, unknown> }>;
	/** What each variant sets apart from the default (layout axes). */
	variantSets: Record<string, string>;
	/** The layout axes the variant sets (not in props: write `variant`, the host sets them). */
	layout?: string;
	/** The props of the item: names, kinds, enums, rows. Write exactly these. */
	props: string[];
	/** What a new block of the variant starts with (no invented copy). */
	sample: Record<string, unknown>;
	icons: string;
};

type BlockReadUnknown = { ok: false; code: "unknown_item"; message: string; near: string[] };

type BlockRead = BlockReadOk | BlockReadUnknown;

/** get_block: one block of the catalog as the agent needs it to write its props. */
function readBlock(id: unknown, variant?: unknown): BlockRead {
	const item = String(id ?? "").trim().split("/")[0]!;
	const info = item ? itemInfo(item) : null;
	const block = item ? catalogBlock(item) : null;
	if (!info || !block) {
		const needle = item.toLowerCase();
		const near = allItems().filter((name) => needle && (name.includes(needle) || needle.includes(name))).slice(0, 8);
		return { ok: false, code: "unknown_item", message: `${String(id ?? "") || "(empty)"} is not a block of the catalog. Blocks: ${allItems().join(", ")}.`, near: near.length ? near : allItems() };
	}
	const want = typeof variant === "string" && info.variants.includes(variant) ? variant : info.defaultVariant;
	const axes = layoutAxes(item);
	const flat = (value: unknown): string[] =>
		value && typeof value === "object" ? Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) => (inner && typeof inner === "object" ? flat(inner).map((row) => `${key}.${row}`) : [`${key}=${String(inner)}`])) : [];
	const base = new Set(flat(variantProps(item, info.defaultVariant)));
	const variantSets = Object.fromEntries(info.variants.map((name) => [name, flat(variantProps(item, name)).filter((row) => !base.has(row)).join(" ") || "defaults"]));
	return {
		ok: true,
		item,
		title: info.title,
		description: block.description,
		category: info.category,
		install: `npx ui8kit add ${item} --framework svelte`,
		defaultVariant: info.defaultVariant,
		variants: block.contract.variants.map((v) => ({ id: v.id, label: v.label, axes: v.axes, ...(v.settings ? { settings: { ...v.settings } } : {}) })),
		variantSets,
		...(axes.length ? { layout: `variant sets ${axes.join(", ")}; write variant, not these props` } : {}),
		props: propsOutline(item) ?? [],
		// The model reads money in major units (the stored sample is in minor units). The axes come from the variant.
		sample: withoutAxes(convertProps(item, sampleProps(item, want, `block-${item}`), "view"), axes),
		icons: LUCIDE_ICON_HINT
	};
}

exports["propsOutline"] = propsOutline;
exports["itemIndex"] = itemIndex;
exports["readBlock"] = readBlock;

});

__def("packages/chat-agent/src/agent/catalog-tools.ts", function (exports) {
const { toolOffersMode } = __req("packages/chat-agent/src/agent/agent-tools.ts");
const { readBlock } = __req("packages/chat-agent/src/agent/blocks.ts");
const { catalogBlocks, pageForModel, renderProblems } = __req("packages/builder-core/src/index.ts");
const { ALLOWED_TOOLS } = __req("packages/builder-core/src/index.ts");
type ToolCall = { name: string; arguments?: Record<string, unknown> };
type ToolHost = { mode?: AgentMode; page?: PageV2 | null };
type ToolOutcome =
	| { ok: true; name: AllowedTool; result: unknown }
	| { ok: false; code: string; message: string; result?: unknown; path?: string };

function isAllowedTool(name: string): name is AllowedTool {
	return (ALLOWED_TOOLS as string[]).includes(name);
}

/** list_blocks: the whole catalog (it is small): item, title, category, description and every variant. */
function listBlocks(): ToolOutcome {
	return {
		ok: true,
		name: "list_blocks",
		result: {
			total: catalogBlocks().length,
			blocks: catalogBlocks().map((block) => ({
				item: block.item,
				title: block.title,
				category: block.category,
				description: block.description,
				defaultVariant: block.contract.defaultVariant,
				variants: block.contract.variants.map((v) => ({ id: v.id, label: v.label }))
			}))
		}
	};
}

function executeCatalogTool(call: ToolCall, host: ToolHost = {}): ToolOutcome {
	if (!isAllowedTool(call.name)) return { ok: false, code: "unknown_tool", message: `Tool "${call.name}" is not on the allowlist. Tools are ${ALLOWED_TOOLS.join(", ")}.` };
	if (host.mode && !toolOffersMode(call.name, host.mode)) return { ok: false, code: "tool_not_in_mode", message: `Tool "${call.name}" is not offered in ${host.mode} mode.` };
	const args = call.arguments ?? {};
	if (call.name === "list_blocks") return listBlocks();
	if (call.name === "get_block") {
		const read = readBlock(args.item ?? args.id, args.variant);
		if (!read.ok) return { ok: false, code: read.code, message: read.message, result: { near: read.near } };
		const { ok: _ok, ...result } = read;
		return { ok: true, name: "get_block", result };
	}
	if (call.name === "get_page") {
		if (!host.page) return { ok: false, code: "missing_page", message: "There is no page document in this turn." };
		const problems = renderProblems(host.page);
		return { ok: true, name: "get_page", result: problems.length ? { ...pageForModel(host.page), renderProblems: problems } : pageForModel(host.page) };
	}
	return { ok: false, code: "not_a_read_tool", message: `${call.name} is handled by the turn, not by the catalog tools.` };
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** Compact evidence stays available in hash-only session exports. No provider-specific fields. */
function catalogEvidence(name: string, result: unknown) {
 if (!record(result)) return undefined;
 if (name === "get_block") return { kind: "catalog-block", item: result.item };
 if (name !== "list_blocks") return undefined;
 return { kind: "catalog-list", total: result.total };
}

exports["executeCatalogTool"] = executeCatalogTool;
exports["catalogEvidence"] = catalogEvidence;

});

__def("packages/chat-agent/src/agent/turn.ts", function (exports) {
const { diffPages } = __req("packages/builder-core/src/index.ts");
const { writeInputFromModel, writePage } = __req("packages/builder-core/src/index.ts");
const { blankRequired } = __req("packages/builder-core/src/index.ts");
const REJECTED_DOC_CHARS = 24_000;
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

/** What a failed turn keeps of its last rejected write: the first issues and the document (when large: the block of the first issue). */
function rejectedWrite(input: Record<string, unknown>, issues: DocIssue[], code: string): RejectedWrite {
	const doc = input.page ?? input.patch;
	const out: RejectedWrite = {
		code,
		issues: issues.slice(0, 5).map((issue) => ({
			path: issue.path,
			code: issue.code,
			expected: cut(issue.expected, 300),
			...(issue.got === undefined ? {} : { got: typeof issue.got === "object" && issue.got !== null ? cut(JSON.stringify(issue.got), 200) : typeof issue.got === "string" ? cut(issue.got, 200) : issue.got })
		}))
	};
	if (doc === undefined) return out;
	if (JSON.stringify(doc).length <= REJECTED_DOC_CHARS) return { ...out, doc };
	const at = /^\/blocks\/(\d+)/.exec(issues[0]?.path ?? "");
	const blocks: unknown = typeof doc === "object" && doc !== null ? Reflect.get(doc, "blocks") : undefined;
	const block = at && Array.isArray(blocks) ? blocks[Number(at[1])] : undefined;
	return block !== undefined && JSON.stringify(block).length <= REJECTED_DOC_CHARS ? { ...out, doc: { block }, partial: true } : out;
}

function isAgentReply(value: unknown): value is AgentReply {
	return Boolean(value && typeof value === "object" && (value as { reply?: unknown }).reply === "text" && (value as { ok?: unknown }).ok === true);
}

const MAX_TEXT = 12_000;
const MAX_CARDS = 10;

function agentReply(mode: AgentMode, text: string, blocks: string[], proposal?: PageProposal | null): AgentReply {
	return { ok: true, reply: "text", mode, text: text.trim().slice(0, MAX_TEXT), blocks: [...new Set(blocks)].slice(0, MAX_CARDS), ...(proposal ? { proposal } : {}) };
}

/** Scope rule of a write: with selected blocks only those blocks change (props, variant, item); nothing else. */
function scopeIssues(diff: DiffEntry[], scope: string[] | undefined): DocIssue[] {
	if (!scope?.length) return [];
	const allowed = new Set(scope);
	const out: DocIssue[] = [];
	for (const entry of diff) {
		const ok = entry.scope === "block" && entry.change === "changed" && entry.id !== undefined && allowed.has(entry.id);
		if (ok) continue;
		out.push({
			path: entry.scope === "page" ? (entry.paths?.[0] ?? "/") : `/blocks/${entry.id ?? ""}`,
			code: "outside_scope",
			expected: `only the selected blocks change (${[...allowed].join(", ")}): their props, variant or item. Page fields, other blocks, adds, removes and moves are not part of this edit`,
			got: entry.scope === "page" ? `page ${entry.paths?.join(", ") ?? ""}` : `${entry.change} ${entry.id ?? ""}`
		});
	}
	return out;
}

type WriteToolResult =
	| { ok: true; page: PageV2; proposal: PageProposal; payload: Record<string, unknown> }
	| { ok: false; code: string; message: string; issues: DocIssue[] };

/** write_page: `args` is { page } or { patch }. `working` is the page the write applies to (the base, or the last write of this turn). */
function runWriteTool(ctx: TurnContext, working: PageV2, args: Record<string, unknown>, options: { now?: string } = {}): WriteToolResult {
	// The model writes money in major units (650); the document stores minor units (65000): converted before the gate (money-view.ts).
	const input: WriteInput = writeInputFromModel(working, args);
	const written = writePage(working, input, options);
	if (!written.ok) return { ok: false, code: written.code, message: written.message, issues: written.issues };
	const shown = ctx.shownPage ?? ctx.page;
	const diff = diffPages(shown, written.page);
	const against = diffPages(ctx.page, written.page);
	const issues = scopeIssues(against, ctx.scopeBlockIds);
	if (issues.length) {
		return { ok: false, code: "write_invalid", message: `The page was not written: ${issues.length} problem${issues.length > 1 ? "s" : ""}, first at ${issues[0]!.path} (${issues[0]!.code}). Nothing changed; fix the listed paths and call write_page again.`, issues };
	}
	const proposal: PageProposal = { page: written.page, diff, baseRevision: ctx.expectedRevision, warnings: written.warnings };
	const touched = new Set(diff.filter((entry) => entry.scope === "block" && entry.change !== "removed" && entry.change !== "moved" && entry.id).map((entry) => entry.id!));
	const empty = written.page.blocks.filter((block) => touched.has(block.id)).flatMap((block) => {
		const paths = blankRequired(block, 4);
		return paths.length ? [{ id: block.id, paths }] : [];
	});
	return {
		ok: true,
		page: written.page,
		proposal,
		payload: {
			ok: true,
			changed: diff.length > 0,
			blocks: written.page.blocks.map((block) => ({ id: block.id, item: block.item, variant: block.variant ?? null })),
			diff: diff.map((entry) => ({ change: entry.change, ...(entry.id ? { id: entry.id } : { page: true }), ...(entry.paths ? { paths: entry.paths.slice(0, 8) } : {}) })),
			...(written.warnings.length ? { notes: written.warnings } : {}),
			...(empty.length ? { empty_required_text: empty.slice(0, 8), fill: "These required texts are empty and the block would show nothing or its own placeholder. Write the author's content into them (one write_page with the whole page, or a patch) unless the request gives none." } : {}),
			note:
				ctx.mode === "ask"
					? "This is a proposal. Nothing is applied: the author applies it in Build with one click. Say in your answer what it changes."
					: "This is a proposal. The author sees the diff and applies it with Apply. Say in your answer what it changes."
		}
	};
}

exports["rejectedWrite"] = rejectedWrite;
exports["isAgentReply"] = isAgentReply;
exports["agentReply"] = agentReply;
exports["scopeIssues"] = scopeIssues;
exports["runWriteTool"] = runWriteTool;

});

__def("packages/agent-manifests/src/xai.ts", function (exports) {

const XAI_MODELS = [
	{
		id: "grok-4.20-0309-non-reasoning",
		label: "Grok 4.20 Non-reasoning",
		intendedRole: "block-selection",
		intendedRoleNote: "Owner suggestion for later: block selection. Not a technical capability claim. Not used for routing."
	},
	{
		id: "grok-4.20-0309-reasoning",
		label: "Grok 4.20 Reasoning",
		intendedRole: "block-selection",
		intendedRoleNote: "Owner suggestion for later: block selection. Not a technical capability claim. Not used for routing."
	},
	{
		id: "grok-4.20-multi-agent-0309",
		label: "Grok 4.20 Multi-agent",
		intendedRole: "task-distribution",
		intendedRoleNote: "Owner suggestion for later: task distribution. Not a technical capability claim. Not used for routing.",
		/**
		 * Live probe 2026-11-09: chat completions answers 400 "Multi Agent requests are not allowed
		 * on chat completions"; the Responses API answers 400 "Client-side tools for multi-agent
		 * models require beta access". The catalog tool loop cannot run on it.
		 */
		toolLoop: "unavailable",
		unavailableCode: "multi_agent_tools_unavailable"
	},
	{
		id: "grok-4.7",
		label: "Grok 4.7",
		intendedRole: "consulting",
		intendedRoleNote: "Owner suggestion for later: consulting. Not a technical capability claim. Not used for routing.",
		/**
		 * Live runs 2026-11-09 (dashboard prompt, tool_choice "required", 285 s budget): 4 of 7 finished,
		 * in 54-227 s; the rest failed after 169-240 s (provider error, no propose_layout, timeout).
		 * Answers in prose on tool_choice "auto". Too slow and unreliable for the catalog tool loop.
		 */
		toolLoop: "unavailable",
		unavailableCode: "model_too_slow"
	},
	{
		id: "grok-build-0.1",
		label: "Grok Build 0.1",
		intendedRole: "assembly",
		intendedRoleNote: "Owner suggestion for later: assembly. Not a technical capability claim. Not used for routing."
	}
] as const;


const XAI_MANIFEST_V1 = {
	id: "xai", version: 1, defaultModelId: "grok-4.20-0309-non-reasoning",
	protocol: "chat-completions", streaming: false,
	toolChoices: ["auto", "none", "required", "named-with-required-fallback"],
	completionTokenParameter: "max_tokens", fixedTemperature: 0, models: XAI_MODELS
} as const;

const XAI_MANIFEST = { ...XAI_MANIFEST_V1, version: 2, completionTokenParameter: "max_completion_tokens" } as const;

exports["XAI_MODELS"] = XAI_MODELS;
exports["XAI_MANIFEST_V1"] = XAI_MANIFEST_V1;
exports["XAI_MANIFEST"] = XAI_MANIFEST;

});

__def("packages/agent-manifests/src/roles.ts", function (exports) {

const PROVIDER_IDS = ["xai", "openrouter"] as const;
const PROVIDER_ROLES = ["build", "ask", "media"] as const;
const MODEL_KINDS = ["chat", "image"] as const;
const OPENROUTER_MEDIA_ENABLED = false;

/** The roles each provider can serve on a host that holds its key. */
const ALL_ROLES: ProviderRole[] = Object.freeze(["build", "ask", "media"]);
const TEXT_ROLES: ProviderRole[] = Object.freeze(["build", "ask"]);
const PROVIDER_ROLE_SUPPORT: Readonly<Record<ProviderId, ProviderRole[]>> = Object.freeze({
	xai: ALL_ROLES,
	openrouter: OPENROUTER_MEDIA_ENABLED ? ALL_ROLES : TEXT_ROLES
});

/** Whether a value names a provider. */
const isProviderId = (value: unknown): value is ProviderId => PROVIDER_IDS.some((id) => id === value);

/** How long a host reports `state: "limit"` after a provider answered 402 (or 403 naming a key/credit limit). */
const PROVIDER_LIMIT_TTL_SECONDS = 600;

/** An approved-model list: at most this many ids, each matching the pattern (RE2-compatible). */
const APPROVED_MAX_IDS = 32;
const APPROVED_ID_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$";

/** The longest xAI key the desktop accepts from Settings (it never answers it back). */
const XAI_KEY_MAX = 512;

/** Media draws at most this many picture slots at a time (ADR 0068; t136u burned a key limit drawing all at once). */
/** The one picture model each provider's host draws with (contract constants images.model, openrouter.imageModel). A key may list more; the host draws with none of the others. */
const IMAGE_MODELS = { xai: "grok-imagine-image-2.0", openrouter: "x-ai/grok-imagine-image-2.0" } as const satisfies Record<ProviderId, string>;

const MEDIA_SLOT_CONCURRENCY = 2;

/** A provider failure that means the key ran out of credit or hit its spending limit. */
function isProviderLimit(status: number, snippet: string): boolean {
	if (status === 402) return true;
	return status === 403 && /key limit|credit|insufficient|spend(?:ing)? limit|quota|billing/i.test(snippet);
}

exports["PROVIDER_IDS"] = PROVIDER_IDS;
exports["PROVIDER_ROLES"] = PROVIDER_ROLES;
exports["MODEL_KINDS"] = MODEL_KINDS;
exports["OPENROUTER_MEDIA_ENABLED"] = OPENROUTER_MEDIA_ENABLED;
exports["PROVIDER_ROLE_SUPPORT"] = PROVIDER_ROLE_SUPPORT;
exports["isProviderId"] = isProviderId;
exports["PROVIDER_LIMIT_TTL_SECONDS"] = PROVIDER_LIMIT_TTL_SECONDS;
exports["APPROVED_MAX_IDS"] = APPROVED_MAX_IDS;
exports["APPROVED_ID_PATTERN"] = APPROVED_ID_PATTERN;
exports["XAI_KEY_MAX"] = XAI_KEY_MAX;
exports["IMAGE_MODELS"] = IMAGE_MODELS;
exports["MEDIA_SLOT_CONCURRENCY"] = MEDIA_SLOT_CONCURRENCY;
exports["isProviderLimit"] = isProviderLimit;

});

__def("packages/agent-manifests/src/openrouter.ts", function (exports) {

const OPENROUTER_CHAT_MODELS = ["x-ai/grok-4.20", "x-ai/grok-4.7"] as const;

/**
 * The openrouter provider definition (ADR 0067), public data: the app keeps its own (xAI) model ids everywhere (selector, scenarios, manifests,
 * replays), and the transport sends the OpenRouter model with its reasoning switch. grok-4.20 does not reason unless
 * asked; grok-4.7 always reasons (its manifest policy, `model_too_slow`, applies through OpenRouter as through xAI).
 */
const OPENROUTER_MODELS = [
	{ appId: "grok-4.20-0309-non-reasoning", id: "x-ai/grok-4.20", reasoning: { enabled: false } },
	{ appId: "grok-4.20-0309-reasoning", id: "x-ai/grok-4.20", reasoning: { enabled: true } },
	{ appId: "grok-4.7", id: "x-ai/grok-4.7" }
] as const satisfies ReadonlyArray<{ appId: string; id: (typeof OPENROUTER_CHAT_MODELS)[number]; reasoning?: { enabled: boolean } }>;

function openRouterModel(appId: string): OpenRouterModel | null {
	return OPENROUTER_MODELS.find((model) => model.appId === appId) ?? null;
}

/** The app model ids the OpenRouter ids of a status serve (in the definition's order). */
function appModelIds(openRouterIds: string[]): string[] {
	return OPENROUTER_MODELS.filter((model) => openRouterIds.includes(model.id)).map((model) => model.appId);
}

/** The app model id of the status candidate (`x-ai/grok-4.20` is the non-reasoning default). */
function appCandidate(openRouterId: string | null | undefined): string | null {
	return OPENROUTER_MODELS.find((model) => model.id === openRouterId)?.appId ?? null;
}


exports["OPENROUTER_CHAT_MODELS"] = OPENROUTER_CHAT_MODELS;
exports["OPENROUTER_MODELS"] = OPENROUTER_MODELS;
exports["openRouterModel"] = openRouterModel;
exports["appModelIds"] = appModelIds;
exports["appCandidate"] = appCandidate;

});

__def("packages/agent-manifests/src/index.ts", function (exports) {
const { XAI_MANIFEST, XAI_MANIFEST_V1 } = __req("packages/agent-manifests/src/xai.ts");
exports["XAI_MANIFEST"] = __req("packages/agent-manifests/src/xai.ts")["XAI_MANIFEST"];
exports["XAI_MODELS"] = __req("packages/agent-manifests/src/xai.ts")["XAI_MODELS"];
exports["APPROVED_ID_PATTERN"] = __req("packages/agent-manifests/src/roles.ts")["APPROVED_ID_PATTERN"];
exports["APPROVED_MAX_IDS"] = __req("packages/agent-manifests/src/roles.ts")["APPROVED_MAX_IDS"];
exports["IMAGE_MODELS"] = __req("packages/agent-manifests/src/roles.ts")["IMAGE_MODELS"];
exports["MEDIA_SLOT_CONCURRENCY"] = __req("packages/agent-manifests/src/roles.ts")["MEDIA_SLOT_CONCURRENCY"];
exports["MODEL_KINDS"] = __req("packages/agent-manifests/src/roles.ts")["MODEL_KINDS"];
exports["OPENROUTER_MEDIA_ENABLED"] = __req("packages/agent-manifests/src/roles.ts")["OPENROUTER_MEDIA_ENABLED"];
exports["PROVIDER_IDS"] = __req("packages/agent-manifests/src/roles.ts")["PROVIDER_IDS"];
exports["PROVIDER_LIMIT_TTL_SECONDS"] = __req("packages/agent-manifests/src/roles.ts")["PROVIDER_LIMIT_TTL_SECONDS"];
exports["PROVIDER_ROLES"] = __req("packages/agent-manifests/src/roles.ts")["PROVIDER_ROLES"];
exports["PROVIDER_ROLE_SUPPORT"] = __req("packages/agent-manifests/src/roles.ts")["PROVIDER_ROLE_SUPPORT"];
exports["XAI_KEY_MAX"] = __req("packages/agent-manifests/src/roles.ts")["XAI_KEY_MAX"];
exports["isProviderId"] = __req("packages/agent-manifests/src/roles.ts")["isProviderId"];
exports["isProviderLimit"] = __req("packages/agent-manifests/src/roles.ts")["isProviderLimit"];
exports["OPENROUTER_CHAT_MODELS"] = __req("packages/agent-manifests/src/openrouter.ts")["OPENROUTER_CHAT_MODELS"];
exports["OPENROUTER_MODELS"] = __req("packages/agent-manifests/src/openrouter.ts")["OPENROUTER_MODELS"];
exports["appCandidate"] = __req("packages/agent-manifests/src/openrouter.ts")["appCandidate"];
exports["appModelIds"] = __req("packages/agent-manifests/src/openrouter.ts")["appModelIds"];
exports["openRouterModel"] = __req("packages/agent-manifests/src/openrouter.ts")["openRouterModel"];
const PROVIDER_MANIFESTS = immutableData([XAI_MANIFEST, XAI_MANIFEST_V1] as const);
function providerManifest(id: string, version?: number) { return PROVIDER_MANIFESTS.filter((manifest) => manifest.id === id && (version === undefined || manifest.version === version)).sort((a, b) => b.version - a.version)[0] ?? null; }
function manifestModelStatus(providerId: string, modelId: string, version?: number) {
	const model = providerManifest(providerId, version)?.models.find((model) => model.id === modelId);
	if (!model) return { status: "unknown", code: "unknown_chat_model" } as const;
	if ("toolLoop" in model && model.toolLoop === "unavailable") return { status: "disabled", code: model.unavailableCode } as const;
	return { status: "enabled", code: null } as const;
}

function immutableData<T>(value: T): T {
	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value)) immutableData(child);
		Object.freeze(value);
	}
	return value;
}

exports["PROVIDER_MANIFESTS"] = PROVIDER_MANIFESTS;
exports["providerManifest"] = providerManifest;
exports["manifestModelStatus"] = manifestModelStatus;
exports["immutableData"] = immutableData;

});

__def("packages/chat-agent/src/env-map.ts", function (exports) {

function readEnv(env?: EnvMap): EnvMap {
	if (env) return env;
	const g = globalThis as typeof globalThis & { process?: { env?: EnvMap } };
	return g.process?.env ?? {};
}

exports["readEnv"] = readEnv;

});

__def("packages/chat-agent/src/xai-env.ts", function (exports) {
const { XAI_MANIFEST } = __req("packages/agent-manifests/src/index.ts");
const { readEnv } = __req("packages/chat-agent/src/env-map.ts");
const XAI_SECRET_ENV = ["XAI_API_KEY"] as const;
const RUNTIME_AUTH_ENV = ["BUILDY_RUNTIME_BASIC_AUTH_USER", "BUILDY_RUNTIME_BASIC_AUTH_PASSWORD"] as const;

/** The xAI REST endpoint; `XAI_BASE_URL` in the environment overrides it (a proxy, a gateway, a test double). */
const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";

function xaiBaseUrl(env?: EnvMap): string {
	return readEnv(env).XAI_BASE_URL?.trim().replace(/\/+$/, "") || DEFAULT_XAI_BASE_URL;
}

/** The model a fresh runtime proposes when discovery lists it (the first listed chat model otherwise). Never a promise that the key may use it. */
const CANDIDATE_CHAT_MODEL = XAI_MANIFEST.defaultModelId;

const XAI_RUNTIME_NOTES = {
	provider: "Official xAI REST at https://api.x.ai/v1 with Bearer XAI_API_KEY.",
	discover: "GET /v1/models (data[]), GET /v1/language-models (models[]), GET /v1/image-generation-models (models[]). Key-scoped.",
	chat: "POST /v1/chat/completions, stream false. The provider-xai adapter implements the neutral page-agent protocol.",
	responses: "Responses is not implemented by this adapter. A future adapter must declare its storage policy explicitly.",
	images: "POST /v1/images/generations is separate. Do not run image models without an explicit later action.",
	tools: "Application-executed tools only: get_page, list_blocks, get_block, write_page. Never mix hosted web_search / code_execution.",
	privacy: "Server-side XAI_API_KEY. Browser BYOK stays UI-only. No request/body/header/raw SDK logs. One sanitized run counter (runId, steps, tool names/counts, provider usage) is allowed. Only page-loop@2 permits one transient HTTP retry within the request/deadline ceilings. Transport exceptions are not retried.",
	toolCalling: "Each live turn proves the tool protocol itself: the run reports toolCallingProven when the model called a tool (get_page, list_blocks, get_block, write_page) and the host accepted or rejected the call.",
} as const;

type XaiKeyState =
	| { present: false; source: null; code: "xai_api_key_missing" }
	| { present: true; source: "XAI_API_KEY"; code: "xai_api_key_present" };

function readXaiKeyState(env?: EnvMap): XaiKeyState {
	const bag = readEnv(env);
	if (bag.XAI_API_KEY?.trim()) {
		return { present: true, source: "XAI_API_KEY", code: "xai_api_key_present" };
	}
	return { present: false, source: null, code: "xai_api_key_missing" };
}

function hasPublicSecretLeak(env?: EnvMap): string[] {
	const bag = readEnv(env);
	const leaks: string[] = [];
	for (const key of Object.keys(bag)) {
		if (/^(VITE_|PUBLIC_|NEXT_PUBLIC_)/.test(key) && /KEY|SECRET|TOKEN|PASSWORD/i.test(key) && bag[key]?.trim()) {
			leaks.push(key);
		}
	}
	return leaks;
}

function classifyDiscoveredModels(ids: string[]): {
	chatIds: string[];
	imageIds: string[];
	otherIds: string[];
	candidate: string | null;
} {
	const unique = [...new Set(ids.filter(Boolean))];
	const imageIds = unique.filter((id) => /imagine|image/i.test(id));
	const chatIds = unique.filter((id) => !imageIds.includes(id));
	const otherIds: string[] = [];
	const candidate = chatIds.includes(CANDIDATE_CHAT_MODEL)
		? CANDIDATE_CHAT_MODEL
		: (chatIds[0] ?? null);
	return { chatIds, imageIds, otherIds, candidate };
}


exports["XAI_SECRET_ENV"] = XAI_SECRET_ENV;
exports["RUNTIME_AUTH_ENV"] = RUNTIME_AUTH_ENV;
exports["DEFAULT_XAI_BASE_URL"] = DEFAULT_XAI_BASE_URL;
exports["xaiBaseUrl"] = xaiBaseUrl;
exports["CANDIDATE_CHAT_MODEL"] = CANDIDATE_CHAT_MODEL;
exports["XAI_RUNTIME_NOTES"] = XAI_RUNTIME_NOTES;
exports["readXaiKeyState"] = readXaiKeyState;
exports["hasPublicSecretLeak"] = hasPublicSecretLeak;
exports["classifyDiscoveredModels"] = classifyDiscoveredModels;

});

__def("packages/chat-agent/src/agent/prompts.ts", function (exports) {
const { MACROS, pageForModel } = __req("packages/builder-core/src/index.ts");
const { itemIndex, propsOutline } = __req("packages/chat-agent/src/agent/blocks.ts");
const MACRO_RULE = `- Macros: the page replaces ${[...MACROS].map(([name, macro]) => `{${name}} with ${macro.description}`).join("; ")}, in the preview and the export alike. Write the copyright line with the macro, never a year number: "© {year} Name". Any other text in braces stays unchanged.`;

const SYSTEM_COMMON = [
	"You are the BuildY page agent. The page is ONE JSON document, the same one the export emits:",
	'{ "version": 2, "title", "slug", "locale", "seo": { "title", "description" }, "blocks": [{ "id", "item", "variant", "props" }] }.',
	"- item is a block of the catalog (npx ui8kit add <item>); itemIndex lists every block with its category and variants (list_blocks shows their labels). variant is one of the item's variants: it sets the layout (where the picture is, how many columns), never the content; the host writes the layout axes it sets (media, cols, surface), so write variant and leave those props out. Settings such as align, padding and level are props too.",
	"- props are exactly the component props of the item. get_block shows them (names, kinds, enums, rows; ? = optional) and the sample props a new block starts with. Write real text in every text prop, never placeholders such as Title, Text or Lorem. A list is an array of records with every required field (team members: id, title, description). A picture is an optional address prop: image with imageAlt on a section, image on list records (dishes, products, rooms), avatar on a team member, where get_block shows it. Leave image empty by default: the block shows its placeholder and Media mode then draws every picture from its description. Use an address only when the author gave one; a value that is not https or a relative path to a picture file is dropped with a note. Picture fields (image, imageDark, avatar) hold only an image URL or stay empty: never an icon name or a word there (phone, map-pin, clock); icons go in icon props. Never write in the page text that photos were added unless you set them.",
	"- imageAlt: on every block whose props have imageAlt, write it even when image is empty (Media mode draws the picture from it; a list record is drawn from its title and description, so make those concrete). One natural, descriptive sentence in the page language, 8 to 20 words, saying what is in the frame: the subject, its key details and the setting (light, place, mood), the way a careful SEO alt text reads. Never start with 'image of' or 'photo of', never stuff keywords or repeat the heading, never describe text, logos or the layout.",
	"- Hard rules only: every block's props pass the item's props schema and the item renders. Everything else is your design decision: pick, replace, add, remove and reorder blocks as the request needs; a block may appear several times.",
	"- write_page is the only write. Send { page } (the whole document) or { patch } (RFC 6902 operations on the document, paths as JSON Pointers: /title, /locale, /seo/description, /blocks/2/props/title, /blocks/- to append). A block you add needs only { item, variant }: the host starts it from the registry sample props, then applies the props you give. A block without id gets one; keep the ids of blocks you keep.",
	"- write_page answers with the diff, or with a list [{ path, code, expected, got }] and changes nothing: fix exactly those paths and write again. Never repeat a write that failed the same way. Besides the schema codes, render_failed and render_empty mean the block would throw or show nothing in the preview (the host rendered it): fix the prop at that path (the page you read may list such blocks in renderProblems).",
	"- locale is the ISO code of the language the author writes in (ru for Russian, en for English): set it and write all page text in that language. seo.title and seo.description are real text for this page. title is the name of what the request is about (the business, product or topic), never a template or catalog name. A request that starts a page gets assembly and content in ONE write_page: every block with its real texts, items and images.",
	"- scope.blockIds, when present, are the blocks the author selected: edit only those (props, variant, item). Do not change page fields, other blocks, or the order.",
	"- Write content when asked. A fictional product is fine when the author says so; never present invented facts as real ones when the author gave real ones.",
	"- Never apply or publish: the author applies a proposal. Answer in the author's language, briefly: what changed and why.",
	MACRO_RULE
].join("\n");

const SYSTEM_BUILD = `${SYSTEM_COMMON}\n- Build: every step is a tool call. Read with the catalog tools, then change the page with write_page: the whole document goes into the call, never into the text. The turn ends when write_page is accepted. If the request needs no change, write the current page back unchanged.`;

const SYSTEM_ASK = `${SYSTEM_COMMON}\n- Ask: a read-only conversation about the page and the catalog. You have no write tool here: answer in text. When the author wants a change, describe it briefly and say that Build makes it.`;

/**
 * The system text of a turn: the prompt of the mode or scenario, the macro rule when the scenario prompt lacks it, and the
 * author's date (their browser's time zone) so prose never guesses the year. Without `today` (an old client) the prompt is
 * the constant one.
 */
function systemText(base: string, ctx: Pick<TurnContext, "today">): string {
	const lines = [base];
	if (!base.includes(MACRO_RULE)) lines.push(MACRO_RULE);
	if (ctx.today) lines.push(`- Today is ${ctx.today.date} in the author's time zone (${ctx.today.timeZone}). Use it for any date or year the text needs (since when, how many years, the next event); the copyright year is still {year}.`);
	return lines.join("\n");
}

/** The date of `now` (YYYY-MM-DD) in `timeZone`, the way the author's browser reads its calendar. */
function todayIn(now: Date, timeZone: string): { date: string; timeZone: string } {
	const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
	const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
	return { date: `${part("year")}-${part("month")}-${part("day")}`, timeZone };
}

const HOST_FIELDS = ["id", "status", "createdAt", "updatedAt"] as const;

/** The page document the model reads: without host-managed fields. */
function pageView(page: PageV2): Record<string, unknown> {
	const view: Record<string, unknown> = { ...pageForModel(page) };
	for (const key of HOST_FIELDS) delete view[key];
	return view;
}

function userPrompt(ctx: TurnContext, problems: ReturnType<typeof renderProblems>): string {
	const items = [...new Set(ctx.page.blocks.map((block) => block.item))];
	const outlines = Object.fromEntries(items.map((item) => [item, propsOutline(item)]).filter(([, lines]) => lines));
	return JSON.stringify({
		request: ctx.brief,
		...(ctx.conversation?.length ? { conversation: ctx.conversation } : {}),
		page: pageView(ctx.page),
		...(problems.length ? { renderProblems: problems, renderProblemsNote: "These blocks throw or show nothing in the preview now. Fix them with write_page (the prop at each path), or replace the block." } : {}),
		...(ctx.scopeBlockIds?.length ? { scope: { blockIds: ctx.scopeBlockIds } } : {}),
		propsOfBlocksOnPage: outlines,
		itemIndex: itemIndex()
	});
}

/**
 * Sent once when a turn that is expected to change the page ends without an accepted write (ADR 0035). Program text, no phrase
 * recognition. In Build the request that follows forces write_page (tool_choice), so the text says the document goes into the
 * call and is never printed. Ask has no write tool and is never nudged.
 */
function nudgeText(ctx: TurnContext, problems: number): string {
	return [
		"Host notice: nothing on the page has changed in this turn (no write_page was accepted).",
		problems > 0 ? "The page has blocks that do not render; they are listed in renderProblems (get_page shows them)." : ctx.scopeBlockIds?.length ? "Blocks are selected for this edit." : "",
		"Call write_page with the page document now; the document goes into the call, do not print it in the text. Do not report a change that write_page did not accept."
	].filter(Boolean).join(" ");
}

exports["MACRO_RULE"] = MACRO_RULE;
exports["SYSTEM_BUILD"] = SYSTEM_BUILD;
exports["SYSTEM_ASK"] = SYSTEM_ASK;
exports["systemText"] = systemText;
exports["todayIn"] = todayIn;
exports["userPrompt"] = userPrompt;
exports["nudgeText"] = nudgeText;

});

__def("packages/chat-agent/src/identity.ts", function (exports) {

function fnv1a64(text: string): string {
	let h1 = 0x811c9dc5;
	let h2 = 0xcbf29ce4;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ (c + 0x9e), 0x01000193) >>> 0;
	}
	return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/**
 * The prompt-cache routing key of a chat (t85u step 8): stable across its turns, so the static prefix (system prompt and
 * tools) and the turn transcript land on one xAI server; the session id itself is not sent.
 */
const chatCacheKey = (sessionId: string): string => `chat-${fnv1a64(`buildy-chat:${sessionId}`)}`;

exports["fnv1a64"] = fnv1a64;
exports["chatCacheKey"] = chatCacheKey;

});

__def("packages/chat-agent/src/agent/run-trace.ts", function (exports) {
const { catalogDigest } = __req("packages/builder-core/src/index.ts");
const { fnv1a64 } = __req("packages/chat-agent/src/identity.ts");
function body(value: unknown) {
	const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
	return { hash: `fnv1a64:${fnv1a64(text)}`, bytes: new TextEncoder().encode(text).length, body: value };
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
const ISSUE_TEXT = 1_000;
/** `got` of an issue as written, folded to a short JSON text when it is large (a whole props object). */
function foldGot(value: unknown): unknown {
	if (value === undefined || value === null || typeof value !== "object") return typeof value === "string" ? value.slice(0, ISSUE_TEXT) : value;
	const text = JSON.stringify(value);
	return text.length <= ISSUE_TEXT ? value : `${text.slice(0, ISSUE_TEXT)}…`;
}

function createRunTrace(runId: string, modelId: string, budget: ExecutionBudget, counts: BudgetCounts, scenario?: CompiledScenario, deadline?: number) {
	const started = Date.now();
	const prefix: Record<string, unknown> = {};
	const steps: TraceStep[] = [];
	const toolResults: TraceToolResult[] = [];
	const trace = {
		format: "run-trace/1" as const, runId, modelId, scenario: scenario ? { id: scenario.profile.id, version: scenario.profile.version } : null,
		fingerprint: scenario?.fingerprint ?? null, providerVersion: scenario?.manifestVersion ?? null, provider: scenario?.profile.provider ?? "unknown",
		catalogDigest: catalogDigest(), budget, startedAt: new Date(started).toISOString(),
		deadlineMs: deadline === undefined ? null : Math.max(0, deadline - started), stopReason: "running",
		prefix, steps, toolResults
	};
	let previous: AgentMessage[] = [];
	let loopSteps = 0;
	const left = (): TraceBudgetLeft => ({ steps: Math.max(0, budget.maxSteps - loopSteps), requests: Math.max(0, budget.maxRequests - counts.requests), tools: Math.max(0, budget.maxToolCalls - counts.toolCalls), writes: Math.max(0, budget.maxWriteAttempts - counts.writeAttempts), tokens: "unknown", maxCompletionTokensPerRequest: budget.maxTokens, timeMs: deadline === undefined ? "unknown" : Math.max(0, deadline - Date.now()) });
	return {
		trace,
		stop(reason: string) { trace.stopReason = reason; if (trace.steps.length) trace.steps.at(-1)!.budgetLeft = left(); },
		loopStep() { loopSteps += 1; },
		prefix(messages: AgentMessage[], tools: ProviderRequest["tools"]) {
			let context: unknown; try { context = JSON.parse(messages[1]?.text ?? "{}"); } catch { context = {}; }
			trace.prefix = { systemPrompt: body(messages[0]?.text ?? ""), tools: body(tools), context: record(context) ? Object.fromEntries(Object.entries(context).map(([key, value]) => [key, { ...body(value), stability: key === "itemIndex" ? "stable" : "variable" }])) : {} };
		},
		request(input: Pick<ProviderRequest, "messages" | "tools" | "toolChoice"> & { phase?: string; completionReason?: string }, nudged: boolean) {
			const initial = previous.length === 0;
			let retainedMessages = 0;
			while (retainedMessages < previous.length && retainedMessages < input.messages.length && JSON.stringify(previous[retainedMessages]) === JSON.stringify(input.messages[retainedMessages])) retainedMessages += 1;
			const additions = input.messages.slice(retainedMessages).map((message, index) => {
				const descriptor = body(message);
				return initial && index < 2 ? { role: message.role, hash: descriptor.hash, bytes: descriptor.bytes, source: "prefix" } : { role: message.role, ...descriptor };
			});
			const transcriptChange = retainedMessages < previous.length ? "replace" : "append";
			previous = structuredClone([...input.messages]);
			const step: TraceStep = { index: trace.steps.length + 1, startedAt: new Date().toISOString(), request: { retainedMessages, transcriptChange, ...(input.phase ? { phase: input.phase } : {}), ...(input.completionReason ? { completionReason: input.completionReason } : {}), toolChoice: input.toolChoice, parallelToolCalls: "unknown", completionTokenParameter: "unknown", tools: { hash: body(input.tools).hash, bytes: body(input.tools).bytes }, maxTokens: budget.maxTokens, nudged, messagesAdded: additions }, budgetLeft: left() };
			trace.steps.push(step);
			return (result: ProviderStep | null, latencyMs: number) => {
				if (result?.requestInfo) step.request = { ...step.request, promptCacheKeySent: result.requestInfo.promptCacheKeySent, parallelToolCalls: result.requestInfo.parallelToolCalls, completionTokenParameter: result.requestInfo.completionTokenParameter, maxTokens: result.requestInfo.maxTokens };
				step.response = { finish_reason: result?.response?.finishReason ?? "unknown", refusal: result?.response?.refusal ?? null, content: result?.ok ? body(result.message.text ?? null) : null, tool_calls: result?.ok ? result.message.calls?.map((call) => ({ id: call.id, name: call.name, arguments: body(call.argumentsJson) })) ?? [] : [], latencyMs, status: result?.response?.status ?? (result && !result.ok ? result.error.status : undefined) ?? "unknown", error: result && !result.ok ? result.error.code : result ? null : "provider_threw" };
				const usage = result?.usage;
				step.usage = { prompt: usage?.promptTokens ?? "unknown", completion: usage?.completionTokens ?? "unknown", cached: usage?.cachedTokens ?? "unknown", reasoning: usage?.reasoningTokens ?? "unknown", cost_in_usd_ticks: usage?.costUsdTicks ?? "unknown", cacheHitPercent: typeof usage?.promptTokens === "number" && usage.promptTokens > 0 && usage.cachedTokens !== undefined ? usage.cachedTokens / usage.promptTokens * 100 : "unknown" };
				step.budgetLeft = left();
			};
		},
		tool(call: AgentCall, result: unknown, durationMs: number, proposal: PageProposal | null, evidence?: unknown, executed = true) {
			const failed = record(result) && result.ok === false;
			// The whole issue (path, code, expected, got): a rejected write must be readable from a hash-only export.
		const issues = record(result) && Array.isArray(result.issues) ? result.issues.filter(record).map((issue) => ({ path: typeof issue.path === "string" ? issue.path : "unknown", code: typeof issue.code === "string" ? issue.code : "unknown", ...(typeof issue.expected === "string" ? { expected: issue.expected.slice(0, ISSUE_TEXT) } : {}), ...("got" in issue ? { got: foldGot(issue.got) } : {}) })) : [];
			trace.toolResults.push({ step: trace.steps.length, callId: call.id, name: call.name, ...(evidence ? { evidence } : {}), args: body(call.argumentsJson), ok: !failed, result: body(result), durationMs, execution: executed ? "completed" : "skipped", ...(call.name === "write_page" ? { accepted: !failed, gate: { codes: issues.map((issue) => issue.code), issues, ...(failed && record(result) && typeof result.code === "string" ? { code: result.code } : {}) }, baseRevision: !failed && proposal ? proposal.baseRevision : null, pageRevision: null, revisionMeaning: "proposal_only_not_applied", diff: !failed && proposal ? body(proposal.diff) : null } : {}) });
			if (trace.steps.length) trace.steps.at(-1)!.budgetLeft = left();
		}
	};
}

exports["createRunTrace"] = createRunTrace;

});

__def("packages/chat-agent/src/agent/execution-policy.ts", function (exports) {

const POLICY_V2 = { id: "page-loop@2", maxTransientRetries: 1, baseDelayMs: 250, maxDelayMs: 2000 } as const;
const CURRENT_EXECUTION_POLICY = { ...POLICY_V2, id: "page-loop@3", buildCompletion: { reservedSteps: 4, reservedRequests: 5, reservedToolCalls: 4, reservedTimeMs: 60_000 } } as const;
const policies = [{ id: "page-loop@1", maxTransientRetries: 0, baseDelayMs: 250, maxDelayMs: 2000 }, POLICY_V2, CURRENT_EXECUTION_POLICY] as const;
function executionPolicy(id: string) { return policies.find((policy) => policy.id === id) ?? null; }

function retryDelay(error: { status?: number; retryable?: boolean; retryAfterMs?: number }, used: number, policy: (typeof policies)[number], remainingMs: number): number | null {
	if (!error.retryable || ![429, 500, 502, 503, 504].includes(error.status ?? 0) || used >= policy.maxTransientRetries) return null;
	const delay = Math.max(policy.baseDelayMs * 2 ** used, error.retryAfterMs ?? 0);
	return Number.isFinite(delay) && delay <= policy.maxDelayMs && delay < remainingMs ? delay : null;
}

/** Cancellation ends the wait and releases both the timer and listener. The caller rechecks before dispatch. */
function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted) { resolve(); return; }
		const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
		const timer = setTimeout(done, ms);
		signal.addEventListener("abort", done, { once: true });
	});
}

exports["CURRENT_EXECUTION_POLICY"] = CURRENT_EXECUTION_POLICY;
exports["executionPolicy"] = executionPolicy;
exports["retryDelay"] = retryDelay;
exports["waitForRetry"] = waitForRetry;

});

__def("packages/chat-agent/src/agent/budget.ts", function (exports) {

const AGENT_BUDGET = {
	maxSteps: 8,
	maxRequests: 10,
	maxToolCalls: 32,
	maxWriteAttempts: 8,
	maxTokens: 8192,
	toolPageSize: 4
} as const;

const PHASED_BUDGET_CEILINGS = { ...AGENT_BUDGET, maxSteps: 64, maxRequests: 80, maxToolCalls: 256 };

exports["AGENT_BUDGET"] = AGENT_BUDGET;
exports["PHASED_BUDGET_CEILINGS"] = PHASED_BUDGET_CEILINGS;

});

__def("packages/chat-agent/src/cost.ts", function (exports) {

type BilledCost = {
	available: true; kind: "billed"; currency: "USD"; ticks: string; usd: string;
	completeness: "complete" | "partial"; reportedRequests: number; requests: number;
};
type CostUnavailable = { available: false; reason: "not_reported" | "no_official_current_rates_in_repo"; note: string };
type CostEstimate = { available: true; kind: "estimated"; currency: "USD"; amount: number; modelId: string; source: string; asOf: string; vsBilled: "estimated_not_billed" };
const COST_UNAVAILABLE: CostUnavailable = { available: false, reason: "not_reported", note: "Billed cost is unavailable in this usage record. Missing cost is unknown, never zero." };
type CostPart = { ticks?: string; reportedRequests: number; requests: number; complete: boolean };

/** xAI's billing unit: 1e-10 USD per tick. OpenRouter reports USD (`usage.cost`, ADR 0067); this converts it. */
const TICKS_PER_USD = 10_000_000_000;

/** A USD amount as billed ticks (rounded), or undefined when it is not a finite amount of at least zero. */
function usdToTicks(value: unknown): string | undefined {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
	const ticks = Math.round(value * TICKS_PER_USD);
	return Number.isSafeInteger(ticks) ? String(ticks) : undefined;
}

function readBilledTicks(value: unknown): string | undefined {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? String(value) : undefined;
	return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) ? value : undefined;
}

function aggregateBilledCost(parts: CostPart[]): BilledCost | CostUnavailable {
	let total = 0n, reportedRequests = 0, requests = 0;
	let complete = true;
	for (const part of parts) {
		requests += part.requests;
		const ticks = readBilledTicks(part.ticks);
		if (ticks !== undefined) { total += BigInt(ticks); reportedRequests += part.reportedRequests; }
		complete &&= part.complete && ticks !== undefined;
	}
	if (!reportedRequests) return COST_UNAVAILABLE;
	const scale = 10_000_000_000n;
	return { available: true, kind: "billed", currency: "USD", ticks: total.toString(), usd: `${total / scale}.${(total % scale).toString().padStart(10, "0")}`, completeness: complete ? "complete" : "partial", reportedRequests, requests };
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** Historical usage is an open host record; malformed or estimated costs cannot become billed amounts. */
function storedCostPart(cost: unknown, requests: number): CostPart {
	const validCount = Number.isSafeInteger(requests) && requests >= 0;
	const expected = validCount ? requests : 0;
	if (record(cost) && cost.available === true && cost.kind === "billed" && cost.currency === "USD") {
		const ticks = readBilledTicks(cost.ticks);
		if (ticks !== undefined && typeof cost.reportedRequests === "number" && Number.isSafeInteger(cost.reportedRequests) && cost.reportedRequests > 0 && typeof cost.requests === "number" && Number.isSafeInteger(cost.requests) && cost.requests >= cost.reportedRequests) {
			return { ticks, reportedRequests: cost.reportedRequests, requests: Math.max(expected, cost.requests), complete: validCount && cost.completeness === "complete" && cost.reportedRequests === cost.requests && cost.requests === requests };
		}
	}
	return { requests: expected, reportedRequests: 0, complete: false };
}

function billedCostForDisplay(cost: unknown) {
	const requests = record(cost) && typeof cost.requests === "number" ? cost.requests : 0;
	return aggregateBilledCost([storedCostPart(cost, requests)]);
}

exports["COST_UNAVAILABLE"] = COST_UNAVAILABLE;
exports["TICKS_PER_USD"] = TICKS_PER_USD;
exports["usdToTicks"] = usdToTicks;
exports["readBilledTicks"] = readBilledTicks;
exports["aggregateBilledCost"] = aggregateBilledCost;
exports["storedCostPart"] = storedCostPart;
exports["billedCostForDisplay"] = billedCostForDisplay;

});

__def("packages/chat-agent/src/usage.ts", function (exports) {
const { COST_UNAVAILABLE, readBilledTicks, usdToTicks, aggregateBilledCost, storedCostPart } = __req("packages/chat-agent/src/cost.ts");
exports["COST_UNAVAILABLE"] = __req("packages/chat-agent/src/cost.ts")["COST_UNAVAILABLE"];
exports["billedCostForDisplay"] = __req("packages/chat-agent/src/cost.ts")["billedCostForDisplay"];
type TokenCount = number | "unknown";

function unknownUsage(reason: RunUsage["incompleteReason"], steps = 0): RunUsage {
	return {
		status: "incomplete",
		incompleteReason: reason,
		steps,
		reportedSteps: 0,
		promptTokens: "unknown",
		completionTokens: "unknown",
		totalTokens: "unknown",
		reportedBy: "none",
		cost: COST_UNAVAILABLE
	};
}

function asCount(value: unknown): number | null {
	if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
	return null;
}

/**
 * A run the host refused before it sent anything to the provider (`model_not_enabled_on_account`, runtime not ready, a
 * scenario that does not resolve): zero requests, zero tokens, no bill. Unlike unknownUsage it is complete: nothing is
 * unknown about a request that was never made, so the session total stays complete (aggregateSessionUsage skips it).
 */
function notSentUsage(): RunUsage {
	return { status: "complete", steps: 0, reportedSteps: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, reportedBy: "none", notSent: true, cost: COST_UNAVAILABLE };
}

/** Read one provider usage object. Missing fields stay absent; never invent 0. */
function readProviderUsage(raw: unknown): StepUsage | null {
	if (!raw || typeof raw !== "object") return null;
	const u = raw as Record<string, unknown>;
	const prompt = asCount(u.prompt_tokens ?? u.inputTokens ?? u.promptTokens);
	const completion = asCount(u.completion_tokens ?? u.outputTokens ?? u.completionTokens);
	const total = asCount(u.total_tokens ?? u.totalTokens);
	// xAI bills in ticks; OpenRouter answers `cost` in USD (ADR 0067).
	const ticks = readBilledTicks(u.cost_in_usd_ticks) ?? usdToTicks(u.cost);
	if (prompt === null && completion === null && total === null && ticks === undefined) return null;
	const details =
		u.completion_tokens_details && typeof u.completion_tokens_details === "object"
			? (u.completion_tokens_details as Record<string, unknown>)
			: u.outputTokenDetails && typeof u.outputTokenDetails === "object"
				? (u.outputTokenDetails as Record<string, unknown>)
				: null;
	const promptDetails =
		u.prompt_tokens_details && typeof u.prompt_tokens_details === "object"
			? (u.prompt_tokens_details as Record<string, unknown>)
			: null;
	const reasoning = asCount(details?.reasoning_tokens ?? details?.reasoningTokens);
	const cached = asCount(promptDetails?.cached_tokens ?? promptDetails?.cacheTokens);
	const step: StepUsage = {
		promptTokens: prompt ?? "unknown",
		completionTokens: completion ?? "unknown",
		totalTokens: total ?? (prompt !== null && completion !== null ? addCount(prompt, completion) : "unknown")
	};
	if (reasoning !== null) step.reasoningTokens = reasoning;
	if (cached !== null) step.cachedTokens = cached;
	if (ticks !== undefined) step.costUsdTicks = ticks;
	return step;
}

function addCount(a: TokenCount, b: TokenCount): TokenCount {
	if (a === "unknown" || b === "unknown") return "unknown";
	const total = a + b;
	return Number.isSafeInteger(total) ? total : "unknown";
}

/** Sum tool-loop steps. Uses prompt+completion per step; does not add total on top of those. */
function aggregateStepUsage(steps: Array<StepUsage | null | undefined>, opts?: { incomplete?: RunUsage["incompleteReason"]; requests?: number; providerId?: string }): RunUsage {
	const requests = opts?.requests ?? steps.length;
	const present = steps.filter((s): s is StepUsage => Boolean(s));
	if (opts?.incomplete) {
		if (present.length === 0) return unknownUsage(opts.incomplete, requests);
	}
	if (present.length === 0) {
		return unknownUsage(opts?.incomplete ?? "error", requests);
	}
	let prompt: TokenCount = 0;
	let completion: TokenCount = 0;
	let reasoning = 0;
	let cached = 0;
	let sawReasoning = false;
	let sawCached = false;
	for (const step of present) {
		prompt = addCount(prompt, step.promptTokens);
		completion = addCount(completion, step.completionTokens);
		if (typeof step.reasoningTokens === "number") {
			sawReasoning = true;
			reasoning += step.reasoningTokens;
		}
		if (typeof step.cachedTokens === "number") {
			sawCached = true;
			cached += step.cachedTokens;
		}
	}
	const total: TokenCount =
		addCount(prompt, completion);
	const last = present[present.length - 1];
	const reason = opts?.incomplete ?? (present.length < requests || prompt === "unknown" || completion === "unknown" ? "error" : undefined);
	const parts = present.map((step) => ({ ticks: step.costUsdTicks, reportedRequests: step.costUsdTicks === undefined ? 0 : 1, requests: 1, complete: step.costUsdTicks !== undefined }));
	if (requests > present.length) parts.push({ ticks: undefined, reportedRequests: 0, requests: requests - present.length, complete: false });
	const run: RunUsage = {
		status: reason ? "incomplete" : "complete",
		incompleteReason: reason,
		steps: requests,
		reportedSteps: present.length,
		promptTokens: prompt,
		completionTokens: completion,
		totalTokens: total,
		reportedBy: "provider",
		...(opts?.providerId ? { providerId: opts.providerId } : {}),
		aggregation: "sum-of-tool-loop-requests",
		lastStep: last,
		cost: aggregateBilledCost(parts)
	};
	if (sawReasoning && Number.isSafeInteger(reasoning)) run.reasoningTokens = reasoning;
	if (sawCached && Number.isSafeInteger(cached)) run.cachedTokens = cached;
	return run;
}

function aggregateSessionUsage(all: RunUsage[]): SessionUsage {
	// A run refused before any request adds nothing and never makes the total unknown or partial.
	const runs = all.filter((run) => run.notSent !== true);
	const notSent = all.length - runs.length;
	const refused = notSent ? { notSentRuns: notSent } : {};
	if (runs.length === 0) {
		return {
			status: "complete",
			runs: 0,
			incompleteRuns: 0,
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
			...refused,
			cost: COST_UNAVAILABLE
		};
	}
	const incompleteRuns = runs.filter((r) => r.status === "incomplete").length;
	let prompt: TokenCount = 0;
	let completion: TokenCount = 0;
	let reasoning = 0;
	let cached = 0;
	let sawReasoning = false;
	let sawCached = false;
	for (const run of runs) {
		prompt = addCount(prompt, run.promptTokens);
		completion = addCount(completion, run.completionTokens);
		if (typeof run.reasoningTokens === "number") {
			sawReasoning = true;
			reasoning += run.reasoningTokens;
		}
		if (typeof run.cachedTokens === "number") {
			sawCached = true;
			cached += run.cachedTokens;
		}
	}
	const session: SessionUsage = {
		status: incompleteRuns > 0 ? "incomplete" : "complete",
		runs: runs.length,
		incompleteRuns,
		promptTokens: prompt,
		completionTokens: completion,
		totalTokens: prompt === "unknown" || completion === "unknown" ? "unknown" : prompt + completion,
		...refused,
		cost: aggregateBilledCost(runs.map((run) => storedCostPart(run.cost, run.steps)))
	};
	if (sawReasoning && Number.isSafeInteger(reasoning)) session.reasoningTokens = reasoning;
	if (sawCached && Number.isSafeInteger(cached)) session.cachedTokens = cached;
	return session;
}

/** Never invent a dollar amount. Official rates are not pinned in this repo. */
function costForModel(_modelId: string, usage: RunUsage): UsageCost {
	return usage.cost.available && usage.cost.kind === "billed" ? usage.cost : COST_UNAVAILABLE;
}

function formatTokens(value: TokenCount): string {
	return value === "unknown" ? "UNKNOWN" : String(value);
}

exports["unknownUsage"] = unknownUsage;
exports["notSentUsage"] = notSentUsage;
exports["readProviderUsage"] = readProviderUsage;
exports["aggregateStepUsage"] = aggregateStepUsage;
exports["aggregateSessionUsage"] = aggregateSessionUsage;
exports["costForModel"] = costForModel;
exports["formatTokens"] = formatTokens;

});

__def("packages/chat-agent/src/agent/provider.ts", function (exports) {

function turnMeta(
	path: LiveTurnMeta["path"],
	modelId: string,
	toolCallingWorked: boolean,
	steps: number,
	toolsCalled: string[],
	usage: RunUsage,
	runId: string
): LiveTurnMeta {
	return { runId, path, modelId, requestedModelId: modelId, toolCallingWorked, steps, toolsCalled, usage };
}


type ProviderRequestInfo = { promptCacheKeySent?: boolean; parallelToolCalls: boolean | "provider_default"; completionTokenParameter: string; maxTokens: number };
type ResponseInfo = { requestInfo?: ProviderRequestInfo; response?: { finishReason?: string; refusal?: string | null; status?: number } };

exports["turnMeta"] = turnMeta;

});

__def("packages/chat-agent/src/agent/execution.ts", function (exports) {
const { createRunTrace } = __req("packages/chat-agent/src/agent/run-trace.ts");
const { CURRENT_EXECUTION_POLICY, retryDelay, waitForRetry } = __req("packages/chat-agent/src/agent/execution-policy.ts");
const { AGENT_BUDGET } = __req("packages/chat-agent/src/agent/budget.ts");
const { aggregateStepUsage, unknownUsage } = __req("packages/chat-agent/src/usage.ts");
const { turnMeta } = __req("packages/chat-agent/src/agent/provider.ts");
type ExecutionStep = { ok: true; message: AgentMessage } | { ok: false; result: import("./turn.ts").AgentFailure; meta: LiveTurnMeta };

function createExecution(modelId: string, signal: AbortSignal, provider: AgentProvider, runId: string, options: ExecutionOptions) {
	const budget = options.scenario?.budget ?? AGENT_BUDGET;
	const policy = options.scenario?.executionPolicy ?? CURRENT_EXECUTION_POLICY;
	let retriesUsed = 0;
	const trace = { runId, steps: 0, toolCallingWorked: false, toolsCalled: [] as string[] };
	const stepUsage: StepUsage[] = [];
	const counts: BudgetCounts = { requests: 0, toolCalls: 0, writeAttempts: 0 };
	const recorder = createRunTrace(runId, modelId, budget, counts, options.scenario, options.deadline);
	let incomplete: RunUsage["incompleteReason"];
	const finish = (): LiveTurnMeta => {
		const reason = incomplete ?? (stepUsage.length < counts.requests ? "error" : undefined);
		const usage = stepUsage.length ? aggregateStepUsage(stepUsage, { incomplete: reason, requests: counts.requests, providerId: options.scenario?.profile.provider }) : unknownUsage(reason ?? "error", counts.requests);
		return { ...turnMeta("chat-completions", modelId, trace.toolCallingWorked, counts.requests, trace.toolsCalled, usage, runId), budget: { ...counts }, providerRetries: retriesUsed, runTrace: structuredClone(recorder.trace), ...(options.scenario ? { scenario: { id: options.scenario.profile.id, version: options.scenario.profile.version, fingerprint: options.scenario.fingerprint, provider: options.scenario.profile.provider, providerVersion: options.scenario.manifestVersion, modelId } } : {}) };
	};
	const fail = (code: string, message: string): Extract<ExecutionStep, { ok: false }> => { recorder.stop(code); return { ok: false, result: { ok: false, code, message }, meta: finish() }; };
	const stopped = (): Extract<ExecutionStep, { ok: false }> | null => {
		const timeout = signal.reason instanceof Error && signal.reason.name === "TimeoutError";
		if (signal.aborted || (options.deadline !== undefined && Date.now() >= options.deadline)) {
			incomplete = timeout || (!signal.aborted && options.deadline !== undefined) ? "timeout" : "cancelled";
			return fail(incomplete === "timeout" ? "runtime_timeout" : "aborted", incomplete === "timeout" ? "The run deadline was reached. No further work was started." : "The run was cancelled.");
		}
		return null;
	};
	const failure = (error: unknown) => {
		const stop = stopped();
		if (stop) return stop;
		incomplete = "error";
		try { options.onProviderError?.(error); } catch { /* Diagnostics cannot erase billed usage. */ }
		return fail("provider_failed", "The execution failed. Thrown errors are not retried.");
	};
	const request = async (input: Omit<ProviderRequest, "modelId" | "signal" | "maxTokens" | "provider"> & { nudged?: boolean; phase?: string; completionReason?: string }): Promise<ExecutionStep> => {
		const stop = stopped();
		if (stop) return stop;
		if (counts.requests >= budget.maxRequests) return fail("request_budget", "The provider request budget was reached. No additional request was sent.");
		try {
			let result;
			let pendingRetry = false;
			while (true) {
				const stop = stopped();
				if (stop) return stop;
				if (counts.requests >= budget.maxRequests) return fail("request_budget", "The provider request budget was reached.");
				if (pendingRetry) { retriesUsed += 1; pendingRetry = false; }
				counts.requests += 1;
				trace.steps = counts.requests;
				const completed = recorder.request(input, input.nudged ?? false);
				const started = Date.now();
				try { result = await provider({ ...input, modelId, signal, cacheKey: options.cacheKey ?? (policy.id === "page-loop@3" ? runId : undefined), provider: options.scenario ? { id: options.scenario.profile.provider, version: options.scenario.manifestVersion } : undefined, maxTokens: budget.maxTokens }); } catch (error) { completed(null, Date.now() - started); throw error; }
				if (result.usage) stepUsage.push(result.usage);
				completed(result, Date.now() - started);
				const after = stopped();
				if (after) return after;
				if (result.ok || counts.requests >= budget.maxRequests) break;
				const delay = retryDelay(result.error, retriesUsed, policy, options.deadline === undefined ? Infinity : options.deadline - Date.now());
				if (delay === null) break;
				await waitForRetry(delay, signal);
				pendingRetry = true;
			}
			if (!result.ok) { recorder.stop(result.error.code); return { ok: false, result: { ok: false, code: result.error.code, message: result.error.message }, meta: { ...finish(), providerStatus: result.error.status, providerMs: result.error.elapsedMs } }; }
			return { ok: true, message: result.message };
		} catch (error) {
			return failure(error);
		}
	};
	return { recorder, trace, counts, finish, request, stopped, failure };
}

exports["createExecution"] = createExecution;

});

__def("packages/chat-agent/src/agent/edit-fields.ts", function (exports) {
const { propsOutline } = __req("packages/chat-agent/src/agent/blocks.ts");
const { systemText } = __req("packages/chat-agent/src/agent/prompts.ts");
const { pageForModel, propsSchemaFor } = __req("packages/builder-core/src/index.ts");
const { createExecution } = __req("packages/chat-agent/src/agent/execution.ts");
const { agentReply, runWriteTool, rejectedWrite } = __req("packages/chat-agent/src/agent/turn.ts");
const FIELDS_PROMPT = "Edit the selected registry block props only. Preserve fields the author did not ask to change. Use write_page with exactly one replace operation at the supplied path and the COMPLETE corrected props object for value. Never return page, change item/variant/block identity/order or invent fields, facts or image URLs. On repair correct the candidate using the supplied errors. No prose. The registry-derived field outline follows. The host validates the full props schema.";
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }

function fieldsContext(ctx: TurnContext): string {
	const index = ctx.page.blocks.findIndex((block) => block.id === ctx.scopeBlockIds?.[0]);
	const block = pageForModel(ctx.page).blocks[index];
	return block ? JSON.stringify({ request: ctx.brief, locale: ctx.page.locale, blockId: block.id, item: block.item, variant: block.variant, path: `/blocks/${index}/props`, object: block.props, errors: [] }) : "{}";
}

async function editFields(modelId: string, ctx: TurnContext, signal: AbortSignal, provider: AgentProvider, runId: string, options: ExecutionOptions) {
	const execution = createExecution(modelId, signal, provider, runId, options);
	const scenario = options.scenario!;
	const done = (result: import("./turn.ts").AgentReply | import("./turn.ts").AgentFailure) => {
		execution.recorder.stop(result.ok ? "proposal_accepted" : result.code);
		return { result, meta: execution.finish() };
	};
	try {
		const index = ctx.page.blocks.findIndex((block) => block.id === ctx.scopeBlockIds?.[0]);
		if (ctx.scopeBlockIds?.length !== 1 || index < 0) return done({ ok: false, code: "fields_scope", message: "Select exactly one existing block for field editing." });
		const block = ctx.page.blocks[index]!;
		const schema = propsSchemaFor(block.item);
		if (!schema) return done({ ok: false, code: "fields_schema", message: "The registry props schema is unavailable." });
		const path = `/blocks/${index}/props`;
		let object: unknown = pageForModel(ctx.page).blocks[index]!.props;
		let errors: unknown = [];
		let previous = "";
		let rejected: import("./turn.ts").AgentFailure["rejected"];
		const system = `${systemText(scenario.systemPrompt, ctx)}\n${JSON.stringify({ fields: propsOutline(block.item) })}`;
		for (let step = 0; step < scenario.budget.maxSteps; step += 1) {
			const messages: AgentMessage[] = [{ role: "system", text: system }, { role: "user", text: JSON.stringify({ request: ctx.brief, locale: ctx.page.locale, blockId: block.id, item: block.item, variant: block.variant, path, object, errors }) }];
			if (step === 0) execution.recorder.prefix(messages, scenario.tools);
			execution.recorder.loopStep();
			let response = await execution.request({ messages, tools: scenario.tools, toolChoice: { name: "write_page" }, phase: step ? "repair" : "write" });
			if (!response.ok && (response.meta.providerStatus === 400 || response.meta.providerStatus === 422)) response = await execution.request({ messages, tools: scenario.tools, toolChoice: "required", phase: step ? "repair" : "write", completionReason: "named_fallback" });
			if (!response.ok) return { result: response.result, meta: response.meta };
			const calls = response.message.calls ?? [];
			execution.trace.toolCallingWorked ||= calls.length > 0;
			let args: unknown;
			try { args = JSON.parse(calls[0]?.argumentsJson ?? "null"); } catch { args = null; }
			const patch = record(args) && Array.isArray(args.patch) && args.patch.length === 1 ? args.patch[0] : null;
			const valid = calls.length === 1 && calls[0]?.name === "write_page" && record(args) && Object.keys(args).every((key) => key === "patch") && record(patch) && Object.keys(patch).every((key) => ["op", "path", "value"].includes(key)) && patch.op === "replace" && patch.path === path && record(patch.value);
			if (!valid) { for (const call of calls) execution.recorder.tool(call, { ok: false, code: "fields_protocol" }, 0, null, undefined, false); errors = [{ path, code: "fields_protocol", expected: "exactly one write_page patch replacing the selected props object" }]; continue; }
			if (execution.counts.toolCalls >= scenario.budget.maxToolCalls || execution.counts.writeAttempts >= scenario.budget.maxWriteAttempts) return done({ ok: false, code: "tool_budget", message: "Field edit attempts reached their configured ceiling.", rejected });
			execution.counts.toolCalls += 1;
			execution.counts.writeAttempts += 1;
			execution.trace.toolsCalled.push("write_page");
			const started = Date.now();
			const written = runWriteTool(ctx, ctx.page, { patch: [patch] });
			execution.recorder.tool(calls[0]!, written.ok ? written.payload : { ok: false, issues: written.issues, code: written.code }, Date.now() - started, written.ok ? written.proposal : null);
			if (written.ok) return done(agentReply("build", "", [block.item], written.proposal));
			rejected = rejectedWrite({ patch: [patch] }, written.issues, written.code);
			if (written.issues.some((issue) => issue.path !== `/blocks/${index}` && !issue.path.startsWith(`${path}/`) && issue.path !== path)) return done({ ok: false, code: "fields_external_error", message: "Validation needs changes outside the selected block. Choose a wider editing scope.", rejected });
			object = patch.value;
			errors = written.issues.map(({ path: errorPath, code, expected, got }) => ({ path: errorPath, code, expected: expected.slice(0, 800), ...(typeof got === "string" ? { got: got.slice(0, 200) } : {}) }));
			const signature = JSON.stringify({ object, errors });
			if (signature === previous) return done({ ok: false, code: "write_stuck", message: "The same field edit failed twice.", issues: written.issues, rejected });
			previous = signature;
		}
		return done({ ok: false, code: "fields_unfinished", message: "The field edit was not accepted. No page changes were made.", rejected });
	} catch (error) { const failed = execution.failure(error); return { result: failed.result, meta: failed.meta }; }
}

exports["FIELDS_PROMPT"] = FIELDS_PROMPT;
exports["fieldsContext"] = fieldsContext;
exports["editFields"] = editFields;

});

__def("packages/chat-agent/src/scenarios/profile.schema.json", function (exports) {
  exports.default = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:buildy:agent-scenario:1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "format",
    "id",
    "version",
    "mode",
    "provider",
    "prompt",
    "context",
    "nudge",
    "toolSet",
    "execution",
    "limits",
    "model",
    "providerVersion"
  ],
  "properties": {
    "format": {
      "const": "buildy-agent-scenario"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9.-]*$"
    },
    "version": {
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    },
    "mode": {
      "enum": [
        "ask",
        "build"
      ]
    },
    "provider": {
      "type": "string",
      "minLength": 1
    },
    "prompt": {
      "type": "string",
      "minLength": 1
    },
    "context": {
      "type": "string",
      "minLength": 1
    },
    "nudge": {
      "type": "string",
      "minLength": 1
    },
    "execution": {
      "type": "string",
      "minLength": 1
    },
    "toolSet": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "ref"
      ],
      "properties": {
        "ref": {
          "type": "string"
        },
        "include": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "type": "string"
          }
        }
      }
    },
    "limits": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "maxSteps": {
          "type": "integer",
          "minimum": 1
        },
        "maxRequests": {
          "type": "integer",
          "minimum": 1
        },
        "maxToolCalls": {
          "type": "integer",
          "minimum": 1
        },
        "maxWriteAttempts": {
          "type": "integer",
          "minimum": 1
        },
        "maxTokens": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "model": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "selection"
          ],
          "properties": {
            "selection": {
              "const": "author"
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id"
          ],
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ]
    },
    "providerVersion": {
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    }
  }
};
});

__def("packages/chat-agent/src/scenarios/compile.ts", function (exports) {
const { FIELDS_PROMPT, fieldsContext } = __req("packages/chat-agent/src/agent/edit-fields.ts");
const { ALLOWED_TOOLS } = __req("packages/builder-core/src/index.ts");
const Ajv2020 = __ext_ajv2020;
const { immutableData, providerManifest, manifestModelStatus } = __req("packages/agent-manifests/src/index.ts");
const schema = __req("packages/chat-agent/src/scenarios/profile.schema.json").default;
const { executionPolicy } = __req("packages/chat-agent/src/agent/execution-policy.ts");
const { AGENT_BUDGET, PHASED_BUDGET_CEILINGS } = __req("packages/chat-agent/src/agent/budget.ts");
const { AGENT_TOOLS_VERSION, agentTools, agentToolChoice } = __req("packages/chat-agent/src/agent/agent-tools.ts");
const { SYSTEM_ASK, SYSTEM_BUILD, userPrompt, nudgeText } = __req("packages/chat-agent/src/agent/prompts.ts");
const { fnv1a64 } = __req("packages/chat-agent/src/identity.ts");
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile<ScenarioProfile>(schema);
const validateRef = ajv.compile<ScenarioRef>({ type: "object", additionalProperties: false, required: ["id", "version"], properties: { id: schema.properties.id, version: schema.properties.version } });
function parseScenarioRef(raw: unknown): ScenarioRef | null { return validateRef(raw) ? immutableData(structuredClone(raw)) : null; }
const prompts: Record<string, string> = { "page.edit-fields@1": FIELDS_PROMPT, "page.ask@1": SYSTEM_ASK, "page.build@1": SYSTEM_BUILD };

function identity(value: unknown): string {
	const json = JSON.stringify(value, (_key, node: unknown) => node !== null && typeof node === "object" && !Array.isArray(node) ? Object.fromEntries(Object.entries(node).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : node);
	return `scenario-v1-${fnv1a64(json)}`;
}

/** Compile drafts for inspection; only the registered resolver is used for live execution. */
function compileScenario(raw: unknown, modelId: string) {
	if (!validate(raw)) return { ok: false, issues: (validate.errors ?? []).map((error) => ({ path: error.instancePath, code: error.keyword })) } as const;
	const profile = structuredClone(raw);
	const issues: Array<{ path: string; code: string }> = [];
	const reject = (path: string, code: string) => { issues.push({ path, code }); };
	const manifest = providerManifest(profile.provider, profile.providerVersion);
	if (!manifest) reject("/provider", "unknown_provider_version");
	if (manifest && !manifest.toolChoices.some((choice) => choice === agentToolChoice(profile.mode))) reject("/provider", "unsupported_tool_choice");
	if ("id" in profile.model && profile.model.id !== modelId) reject("/model/id", "model_binding_mismatch");
	if (manifestModelStatus(profile.provider, modelId, profile.providerVersion).status !== "enabled") reject("/modelId", "model_unavailable");
	const fields = profile.prompt === "page.edit-fields@1" && profile.mode === "build";
	if (!prompts[profile.prompt] || (!fields && profile.prompt !== `page.${profile.mode}@1`)) reject("/prompt", "incompatible_prompt");
	if (profile.context !== (fields ? "block.props@1" : "page.context@1")) reject("/context", "unknown_context");
	if (profile.nudge !== "page.nudge@1") reject("/nudge", "unknown_nudge");
	const policy = executionPolicy(profile.execution);
	if (!policy) reject("/execution", "unknown_execution");
	if (profile.toolSet.ref !== AGENT_TOOLS_VERSION) reject("/toolSet/ref", "unknown_tool_version");
	const available = agentTools(profile.mode);
	if (profile.toolSet.include?.some((name) => !available.some((tool) => tool.name === name))) reject("/toolSet/include", "unknown_tool");
	const tools = profile.toolSet.include ? available.filter((tool) => profile.toolSet.include?.includes(tool.name)) : available;
	if (fields && (tools.length !== 1 || tools[0]?.name !== "write_page")) reject("/toolSet/include", "fields_write_only");
	if (!fields && tools.length !== available.length) reject("/toolSet/include", "incompatible_prompt_tools");
	if (tools.some((tool) => !ALLOWED_TOOLS.some((name) => name === tool.name))) reject("/toolSet/include", "missing_handler");
	// Ask is read-only (it has no write tool at all); Build writes the page.
	const writes = tools.some((tool) => tool.name === "write_page");
	if (profile.mode === "ask" ? writes : !writes) reject("/toolSet/include", profile.mode === "ask" ? "ask_write_forbidden" : "write_required");
	const { toolPageSize: _pageSize, ...ceilings } = policy?.id === "page-loop@3" ? PHASED_BUDGET_CEILINGS : AGENT_BUDGET;
	const overrides = new Map(Object.entries(profile.limits));
	for (const [key, ceiling] of Object.entries(ceilings)) {
		const value = overrides.get(key);
		if (value !== undefined && value > ceiling) reject(`/limits/${key}`, "budget_ceiling");
	}
	if (issues.length || !manifest || !policy) return { ok: false, issues } as const;
	const { toolPageSize: _defaultPageSize, ...defaults } = AGENT_BUDGET;
	const budget: ExecutionBudget = { ...defaults, ...profile.limits };
	if (profile.mode === "build" && !fields && policy.id === "page-loop@3" && (budget.maxSteps <= policy.buildCompletion.reservedSteps || budget.maxRequests <= policy.buildCompletion.reservedRequests || budget.maxToolCalls <= policy.buildCompletion.reservedToolCalls)) return { ok: false, issues: [{ path: "/limits", code: "completion_reserve" }] } as const;
	const fingerprint = identity({ profile, modelId, manifest, ...(policy.id === "page-loop@1" ? {} : { executionPolicy: policy }), prompt: prompts[profile.prompt], tools, budget, toolChoice: agentToolChoice(profile.mode) });
	return { ok: true, scenario: immutableData({ profile, modelId, executionPolicy: policy, manifestVersion: manifest.version, systemPrompt: prompts[profile.prompt]!, context: fields ? fieldsContext : userPrompt, nudge: nudgeText, tools, budget, toolChoice: agentToolChoice(profile.mode), fingerprint }) } as const;
}

exports["parseScenarioRef"] = parseScenarioRef;
exports["compileScenario"] = compileScenario;

});

__def("packages/chat-agent/src/models.ts", function (exports) {
const { parsePageV2 } = __req("packages/page-contract/src/index.ts");
const { CANDIDATE_CHAT_MODEL } = __req("packages/chat-agent/src/xai-env.ts");
const { isAgentMode } = __req("packages/chat-agent/src/agent/agent-tools.ts");
const { parseScenarioRef } = __req("packages/chat-agent/src/scenarios/compile.ts");
const { XAI_MODELS, manifestModelStatus } = __req("packages/agent-manifests/src/index.ts");
const GROK_CHAT_MODELS = XAI_MODELS;

function modelRunsToolLoop(model: GrokChatModel | null | undefined): boolean {
	if (!model) return false;
	return manifestModelStatus("xai", model.id).status === "enabled";
}

function modelUnavailableCode(model: GrokChatModel | null | undefined): string | null {
	if (!model || modelRunsToolLoop(model)) return null;
	return manifestModelStatus("xai", model.id).code;
}

/**
 * Whether the selector offers a model: first the manifest (the tool loop runs on it), then the key's own model list
 * when the runtime has listed it (`status.models.chatIds`). `model_not_enabled_on_account` is the key's answer, not
 * the manifest's: the model is fine here but this xAI key does not list it (grok-build-0.1 on the box key, 2026-11-20).
 */
function modelChoice(model: GrokChatModel | null | undefined, accountChatIds?: string[] | null): { enabled: true } | { enabled: false; code: string } {
	if (!model) return { enabled: false, code: "unknown_chat_model" };
	if (!modelRunsToolLoop(model)) return { enabled: false, code: modelUnavailableCode(model) ?? "model_tools_unavailable" };
	if (Array.isArray(accountChatIds) && !accountChatIds.includes(model.id)) return { enabled: false, code: "model_not_enabled_on_account" };
	return { enabled: true };
}

const DEFAULT_CHAT_MODEL_ID: GrokChatModelId = CANDIDATE_CHAT_MODEL;

type ModelResolveOk = {
	ok: true;
	modelId: GrokChatModelId;
	label: string;
	live: boolean;
};

type ModelResolveError = {
	ok: false;
	code:
		| "invalid_scenario"
		| "missing_model_id"
		| "image_model_not_for_chat"
		| "unknown_chat_model"
		| "model_not_enabled_on_account"
		| "model_tools_unavailable"
		| "model_too_slow"
		| "silent_fallback_forbidden";
	message: string;
	requestedId: string;
};

function getChatModel(id: string): GrokChatModel | null {
	return GROK_CHAT_MODELS.find((m) => m.id === id) ?? null;
}

function formatChatModelChoice(model: GrokChatModel): string {
	return `${model.label} (${model.id})`;
}

/**
 * Map a UI selection to the backend model id.
 * Never substitutes another model. Image IDs are rejected for chat.
 * When the account list is known, the id must be in that list.
 */
function resolveChatModelRequest(input: {
	requestedId: string | null | undefined;
	discoveredChatIds?: string[] | null;
	allowUnlistedTrial?: boolean;
}): ModelResolveOk | ModelResolveError {
	const requestedId = String(input.requestedId ?? "").trim();
	if (!requestedId) {
		return {
			ok: false,
			code: "missing_model_id",
			message: "Select a Grok chat model before sending.",
			requestedId
		};
	}
	if (/imagine|image/i.test(requestedId)) {
		return {
			ok: false,
			code: "image_model_not_for_chat",
			message: `${requestedId} is an image model and is not a chat choice.`,
			requestedId
		};
	}
	const catalog = getChatModel(requestedId);
	if (!catalog) {
		return {
			ok: false,
			code: "unknown_chat_model",
			message: `${requestedId} is not one of the five verified Grok chat models.`,
			requestedId
		};
	}
	if (!modelRunsToolLoop(catalog) && modelUnavailableCode(catalog) === "model_too_slow") {
		return {
			ok: false,
			code: "model_too_slow",
			message: `${catalog.label} (${requestedId}) is disabled here: in live runs it took 1-4 minutes per page and often timed out or skipped the page tool. Pick another model. No other model was substituted.`,
			requestedId
		};
	}
	if (!modelRunsToolLoop(catalog)) {
		return {
			ok: false,
			code: "model_tools_unavailable",
			message: `${catalog.label} (${requestedId}) cannot run this app's catalog tools: xAI rejects client-side tools for multi-agent models (chat completions not allowed; the Responses API needs beta access). Pick another model. No other model was substituted.`,
			requestedId
		};
	}
	const discovered = input.discoveredChatIds;
	if (Array.isArray(discovered)) {
		if (!discovered.includes(requestedId)) {
			return {
				ok: false,
				code: "model_not_enabled_on_account",
				message: `${catalog.label} (${requestedId}) is not enabled on this account. No other model was substituted.`,
				requestedId
			};
		}
		return { ok: true, modelId: catalog.id, label: catalog.label, live: true };
	}
	if (input.allowUnlistedTrial) {
		return { ok: true, modelId: catalog.id, label: catalog.label, live: false };
	}
	return {
		ok: false,
		code: "model_not_enabled_on_account",
		message: `${catalog.label} (${requestedId}) cannot be used until the account model list includes it. No fallback was selected.`,
		requestedId
	};
}

function assertNoFallback(requestedId: string, executedId: string): ModelResolveError | null {
	if (requestedId === executedId) return null;
	return {
		ok: false,
		code: "silent_fallback_forbidden",
		message: `Requested ${requestedId} but the run used ${executedId}. Silent model switch is not allowed.`,
		requestedId
	};
}

/** A POST /v1/run body mapped onto one exact chat model and a trusted turn context (ADR 0034). */
type ChatRunRequest = {
	scenario?: ScenarioRef;
	modelId: GrokChatModelId;
	label: string;
	live: boolean;
	brief: string;
	/** Chat mode the author picked in the composer (Ask never applies). Missing or unknown means build. */
	mode: AgentMode;
	/** The page document the agent starts from (applied page, pending proposal, or empty / draft page). */
	currentPage?: PageV2;
	/** The page the author sees when `currentPage` is a host draft. */
	shownPage?: PageV2;
	expectedRevision: number;
	/** Selected blocks: the agent edits only those. */
	scopeBlockIds?: string[];
	conversation: Array<{ role: "user" | "assistant"; text: string }>;
	/** Opaque prompt-cache routing key of the chat (letters, digits, `:_-`, at most 80); anything else is dropped. */
	cacheKey?: string;
	/** The author's date and time zone (ADR 0066); anything malformed is dropped. */
	today?: { date: string; timeZone: string };
};

const TODAY_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ZONE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

function parseToday(raw: unknown): { date: string; timeZone: string } | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const date: unknown = Reflect.get(raw, "date");
	const timeZone: unknown = Reflect.get(raw, "timeZone");
	return typeof date === "string" && TODAY_DATE.test(date) && typeof timeZone === "string" && TIME_ZONE.test(timeZone) ? { date, timeZone } : undefined;
}

function parsePageDoc(raw: unknown): PageV2 | undefined {
	if (raw == null) return undefined;
	try {
		return parsePageV2(raw);
	} catch {
		return undefined;
	}
}

/**
 * Map a POST /v1/run body onto the exact requested chat model.
 * The discovered list never replaces a missing or unavailable id.
 */
function mapChatRunRequest(
	body: {
		modelId?: unknown;
		scenario?: unknown;
		brief?: unknown;
		expectedRevision?: unknown;
		currentPage?: unknown;
		shownPage?: unknown;
		mode?: unknown;
		scopeBlockIds?: unknown;
		conversation?: unknown;
		cacheKey?: unknown;
		today?: unknown;
	},
	opts: { discoveredChatIds?: string[] | null; allowUnlistedTrial?: boolean } = {}
): { ok: true; request: ChatRunRequest } | ModelResolveError {
	const resolved = resolveChatModelRequest({
		requestedId: typeof body.modelId === "string" ? body.modelId : "",
		discoveredChatIds: opts.discoveredChatIds,
		allowUnlistedTrial: opts.allowUnlistedTrial
	});
	if (!resolved.ok) return resolved;
	const scenario = body.scenario === undefined ? undefined : parseScenarioRef(body.scenario);
	if (scenario === null) return { ok: false, code: "invalid_scenario", message: "Expected a registered scenario reference (id and version only).", requestedId: resolved.modelId };
	return {
		ok: true,
		request: {
			modelId: resolved.modelId,
			scenario,
			label: resolved.label,
			live: resolved.live,
			brief: String(body.brief ?? ""),
			mode: isAgentMode(body.mode) ? body.mode : "build",
			currentPage: parsePageDoc(body.currentPage),
			shownPage: parsePageDoc(body.shownPage),
			expectedRevision: typeof body.expectedRevision === "number" ? body.expectedRevision : 0,
			scopeBlockIds: Array.isArray(body.scopeBlockIds) ? [...new Set(body.scopeBlockIds.filter((id): id is string => typeof id === "string"))].slice(0, 100) : undefined,
			conversation: Array.isArray(body.conversation)
				? body.conversation.slice(-8).flatMap((row) => (row && typeof row === "object" && (row.role === "user" || row.role === "assistant") && typeof row.text === "string" ? [{ role: row.role as "user" | "assistant", text: row.text.slice(0, 2000) }] : []))
				: [],
			...(typeof body.cacheKey === "string" && CACHE_KEY.test(body.cacheKey) ? { cacheKey: body.cacheKey } : {}),
			...(parseToday(body.today) ? { today: parseToday(body.today) } : {})
		}
	};
}

const CACHE_KEY = /^[A-Za-z0-9:_-]{1,80}$/;

exports["GROK_CHAT_MODELS"] = GROK_CHAT_MODELS;
exports["modelRunsToolLoop"] = modelRunsToolLoop;
exports["modelChoice"] = modelChoice;
exports["DEFAULT_CHAT_MODEL_ID"] = DEFAULT_CHAT_MODEL_ID;
exports["getChatModel"] = getChatModel;
exports["formatChatModelChoice"] = formatChatModelChoice;
exports["resolveChatModelRequest"] = resolveChatModelRequest;
exports["assertNoFallback"] = assertNoFallback;
exports["mapChatRunRequest"] = mapChatRunRequest;

});

__def("packages/chat-agent/src/proposal-base.ts", function (exports) {
const { fnv1a64 } = __req("packages/chat-agent/src/identity.ts");
type Diffed = { scope: string; change: string; id?: string };
type BaseHashes = Record<string, string | null>;
function blockBaseHash(block: Pick<BlockV2, "item" | "variant" | "props"> | undefined): string | null {
	return block ? `fnv1a64:${fnv1a64(JSON.stringify({ item: block.item, variant: block.variant ?? null, props: block.props ?? {} }))}` : null;
}

/** The hashes of the blocks a diff touches (changed, removed, moved; an added block has no base) on a page. */
function baseHashes(page: PageV2 | null | undefined, diff: Diffed[]): BaseHashes {
	const ids = [...new Set(diff.flatMap((entry) => (entry.scope === "block" && entry.change !== "added" && entry.id ? [entry.id] : [])))];
	return Object.fromEntries(ids.map((id) => [id, blockBaseHash(page?.blocks.find((block) => block.id === id))]));
}

/** The block ids whose content on `page` is no longer what `hashes` recorded (edited, removed or added by hand). */
function staleBlocks(page: PageV2 | null | undefined, hashes: BaseHashes): string[] {
	return Object.entries(hashes).flatMap(([id, hash]) => (blockBaseHash(page?.blocks.find((block) => block.id === id)) === hash ? [] : [id]));
}

const isHashes = (value: unknown): value is BaseHashes => typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((x) => x === null || typeof x === "string");
function isProposalBase(value: unknown): value is ProposalBase {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const v: Record<string, unknown> = { ...value };
	return v.format === "proposal-base/1" && typeof v.baseRevision === "number" && ["candidate", "applied", "empty"].includes(String(v.source)) && isHashes(v.base) && isHashes(v.applied);
}

/** The stored records by message id; an entry that is not a record is left out (never reinterpreted). */
function readProposalBases(value: unknown): Record<string, ProposalBase> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, ProposalBase] => isProposalBase(entry[1])));
}

exports["blockBaseHash"] = blockBaseHash;
exports["baseHashes"] = baseHashes;
exports["staleBlocks"] = staleBlocks;
exports["readProposalBases"] = readProposalBases;

});

__def("packages/chat-agent/src/protect.ts", function (exports) {
const { readEnv } = __req("packages/chat-agent/src/env-map.ts");
const VERCEL_HOBBY_SAFE_MAX_DURATION_SEC = 60;
/**
 * /runtime/v1/run: Hobby with fluid compute allows up to 300 s. Slow reasoning models
 * (for example grok-4.7) need more than 60 s for a tool loop.
 * https://vercel.com/docs/functions/configuring-functions/duration
 */
const VERCEL_RUN_MAX_DURATION_SEC = 300;
/** The run aborts itself before the platform kills it, so the client gets a clean timeout code. */
const RUN_BUDGET_SHARED_MS = (VERCEL_RUN_MAX_DURATION_SEC - 15) * 1000;
const RUN_BUDGET_LOCAL_MS = 240_000;

function isLoopbackBind(bind: string | undefined): boolean {
	const value = (bind ?? "127.0.0.1").trim();
	return value === "127.0.0.1" || value === "::1" || value === "localhost";
}

function isSharedPublicSurface(env?: EnvMap): boolean {
	env = readEnv(env);
	const vercel = env.VERCEL?.trim();
	if (vercel === "1" || vercel === "true") return true;
	const vercelEnv = env.VERCEL_ENV?.trim();
	if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") return true;
	return !isLoopbackBind(env.BUILDY_RUNTIME_BIND);
}

function readBasicAuthConfig(env?: EnvMap): {
	user: string;
	pass: string;
	configured: boolean;
} {
	env = readEnv(env);
	const user = env.BUILDY_RUNTIME_BASIC_AUTH_USER?.trim() ?? "";
	const pass = env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD?.trim() ?? "";
	return { user, pass, configured: Boolean(user && pass) };
}

function decodeBasic(authorization: string): { user: string; pass: string } | null {
	if (!authorization.startsWith("Basic ")) return null;
	const encoded = authorization.slice(6).trim();
	if (!encoded) return null;
	try {
		const decoded = atob(encoded);
		const idx = decoded.indexOf(":");
		if (idx < 0) return null;
		return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
	} catch {
		return null;
	}
}

/** Web-safe constant-time compare. Do not import node:crypto (browser barrel). */
function timingSafeEqualString(left: string, right: string): boolean {
	const encoder = new TextEncoder();
	const a = encoder.encode(left);
	const b = encoder.encode(right);
	const len = Math.max(a.length, b.length, 1);
	let diff = a.length ^ b.length;
	for (let i = 0; i < len; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

function authorizeBasic(
	authorization: string | null | undefined,
	env?: EnvMap,
	opts: { allowLoopbackUnauthenticated?: boolean } = {}
): { ok: true } | { ok: false; code: "unauthorized" | "basic_auth_required_before_shared_bind" } {
	env = readEnv(env);
	const shared = isSharedPublicSurface(env);
	const { user, pass, configured } = readBasicAuthConfig(env);
	if (!configured) {
		const loopbackOk =
			Boolean(opts.allowLoopbackUnauthenticated) && !shared && isLoopbackBind(env.BUILDY_RUNTIME_BIND);
		if (loopbackOk) return { ok: true };
		return { ok: false, code: "basic_auth_required_before_shared_bind" };
	}
	const parsed = decodeBasic(authorization ?? "") ?? { user: "", pass: "" };
	const userOk = timingSafeEqualString(parsed.user, user);
	const passOk = timingSafeEqualString(parsed.pass, pass);
	if (!userOk || !passOk) {
		return { ok: false, code: "unauthorized" };
	}
	return { ok: true };
}

function unauthorizedResponse(
	code: "unauthorized" | "basic_auth_required_before_shared_bind" = "unauthorized"
): Response {
	const message =
		code === "basic_auth_required_before_shared_bind"
			? "Basic authentication is not configured. Public access is denied."
			: "Basic authentication required.";
	return new Response(JSON.stringify({ error: { code, message } }), {
		status: 401,
		headers: {
			"WWW-Authenticate": 'Basic realm="buildy-constructor"',
			"content-type": "application/json",
			"cache-control": "no-store"
		}
	});
}

function gateRequest(
	request: Request,
	env?: EnvMap,
	opts: { allowLoopbackUnauthenticated?: boolean } = {}
): Response | null {
	const result = authorizeBasic(request.headers.get("authorization"), readEnv(env), opts);
	if (result.ok) return null;
	return unauthorizedResponse(result.code);
}

function basicAuthorizationHeader(user: string, pass: string): string {
	return `Basic ${btoa(`${user}:${pass}`)}`;
}

function clampRunBudgetMs(requested: unknown, env?: EnvMap): number {
	const asked = Number(requested);
	const cap = isSharedPublicSurface(readEnv(env)) ? RUN_BUDGET_SHARED_MS : RUN_BUDGET_LOCAL_MS;
	const raw = Number.isFinite(asked) && asked > 0 ? asked : cap;
	return Math.min(raw, cap);
}

function stripRuntimePrefix(pathname: string): string {
	let path = pathname || "/";
	for (const prefix of ["/api/runtime", "/runtime", "/api"]) {
		if (path === prefix) return "/";
		if (path.startsWith(`${prefix}/`)) {
			path = path.slice(prefix.length);
			break;
		}
	}
	if (!path.startsWith("/")) path = `/${path}`;
	return path;
}

exports["VERCEL_HOBBY_SAFE_MAX_DURATION_SEC"] = VERCEL_HOBBY_SAFE_MAX_DURATION_SEC;
exports["VERCEL_RUN_MAX_DURATION_SEC"] = VERCEL_RUN_MAX_DURATION_SEC;
exports["isLoopbackBind"] = isLoopbackBind;
exports["isSharedPublicSurface"] = isSharedPublicSurface;
exports["readBasicAuthConfig"] = readBasicAuthConfig;
exports["timingSafeEqualString"] = timingSafeEqualString;
exports["authorizeBasic"] = authorizeBasic;
exports["gateRequest"] = gateRequest;
exports["basicAuthorizationHeader"] = basicAuthorizationHeader;
exports["clampRunBudgetMs"] = clampRunBudgetMs;
exports["stripRuntimePrefix"] = stripRuntimePrefix;

});

__def("packages/chat-agent/src/redact.ts", function (exports) {

const SECRET_HEADER = /^(authorization|proxy-authorization|x-api-key|x-user-api-key|cookie|set-cookie)$/i;
const SECRET_KEY = /(api[_-]?key|authorization|secret|token|password|credential|cursor_api_key|xai_api_key)/i;
const BEARER = /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi;
const CANARY_HINT = /\b(?:sk|xai)-[A-Za-z0-9_-]{8,}\b/g;

function redactValue(value: unknown, key = ""): unknown {
	if (SECRET_KEY.test(key) || SECRET_HEADER.test(key)) return "[redacted]";
	if (typeof value === "string") {
		return value.replace(BEARER, "Bearer [redacted]").replace(CANARY_HINT, "[redacted]");
	}
	if (Array.isArray(value)) return value.map((item) => redactValue(item));
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = redactValue(v, k);
		}
		return out;
	}
	return value;
}

/** The configured secret values of an env bag (the xAI key, the Basic Auth password): what an error text must never repeat. */
function secretValues(env: Record<string, string | undefined>): string[] {
	return ["XAI_API_KEY", "BUILDY_RUNTIME_BASIC_AUTH_PASSWORD", "BUILDY_RUNTIME_BASIC_AUTH_USER"].map((name) => env[name]?.trim() ?? "").filter((value) => value.length >= 4);
}

/** `secrets`: exact values removed from the text whatever their format (a provider may echo the key it was given). */
function safeErrorMessage(err: unknown, secrets: string[] = []): { code: string; message: string } {
	const raw = err instanceof Error ? err.message : String(err);
	const code =
		err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
			? (err as { code: string }).code
			: "error";
	const message = secrets.reduce((text, secret) => text.split(secret).join("[redacted]"), String(redactValue(raw))).slice(0, 280);
	return { code, message };
}


exports["redactValue"] = redactValue;
exports["secretValues"] = secretValues;
exports["safeErrorMessage"] = safeErrorMessage;

});

__def("packages/chat-agent/src/policy.ts", function (exports) {

const POLICY_VERSION = "page-agent/15";
/** Non-secret catalog of the five verified text models. Bump when the selector set changes. */
const MODEL_CATALOG_VERSION = "grok-text-5/2026-11-08";
const TRIAL_POLICY_VERSION = `${POLICY_VERSION}+${MODEL_CATALOG_VERSION}`;


exports["POLICY_VERSION"] = POLICY_VERSION;
exports["MODEL_CATALOG_VERSION"] = MODEL_CATALOG_VERSION;
exports["TRIAL_POLICY_VERSION"] = TRIAL_POLICY_VERSION;

});

__def("packages/chat-agent/src/fingerprint.ts", function (exports) {
const { POLICY_VERSION } = __req("packages/chat-agent/src/policy.ts");
const { catalogDigest } = __req("packages/builder-core/src/index.ts");
const { AGENT_TOOLS_VERSION } = __req("packages/chat-agent/src/agent/agent-tools.ts");
const { fnv1a64 } = __req("packages/chat-agent/src/identity.ts");
let cached: string | null = null;

/**
 * Identity of the page contract the browser and the runtime validate against: the pinned catalog,
 * policy version and agent tools version. A browser tab
 * built from another deploy sends a different value and gets client_outdated instead of a
 * proposal its stale validator would reject.
 */
function contractFingerprint(): string {
	if (cached) return cached;
	cached = `cf1-${fnv1a64(
		JSON.stringify({
			catalog: catalogDigest(),
			policy: POLICY_VERSION,
			tools: AGENT_TOOLS_VERSION
		})
	)}`;
	return cached;
}

exports["contractFingerprint"] = contractFingerprint;

});

__def("packages/chat-agent/src/agent/completion-phase.ts", function (exports) {

type CompletionReserve = { reservedSteps: number; reservedRequests: number; reservedToolCalls: number; reservedTimeMs: number };

/** Completion gets a bounded reserve; catalog reading cannot spend it. */
function completionPhase(budget: ExecutionBudget, counts: BudgetCounts, steps: number, repairing: boolean, reserve: CompletionReserve | undefined, remainingMs = Infinity) {
	const reason = !reserve ? null : remainingMs <= reserve.reservedTimeMs ? "reserved_time" : steps >= budget.maxSteps - reserve.reservedSteps ? "reserved_steps" : counts.requests >= budget.maxRequests - reserve.reservedRequests ? "reserved_requests" : counts.toolCalls >= budget.maxToolCalls - reserve.reservedToolCalls ? "reserved_tools" : null;
	return { phase: repairing ? "repair" : reason ? "write" : "read", forceWrite: Boolean(reason), reason };
}

exports["completionPhase"] = completionPhase;

});

__def("packages/chat-agent/src/agent/loop.ts", function (exports) {
const { editFields } = __req("packages/chat-agent/src/agent/edit-fields.ts");
const { completionPhase } = __req("packages/chat-agent/src/agent/completion-phase.ts");
const { CURRENT_EXECUTION_POLICY } = __req("packages/chat-agent/src/agent/execution-policy.ts");
const { itemInfo, renderProblems } = __req("packages/builder-core/src/index.ts");
const { AGENT_BUDGET } = __req("packages/chat-agent/src/agent/budget.ts");
const { agentTools, agentToolChoice } = __req("packages/chat-agent/src/agent/agent-tools.ts");
const { agentReply, rejectedWrite, runWriteTool } = __req("packages/chat-agent/src/agent/turn.ts");
const { createExecution } = __req("packages/chat-agent/src/agent/execution.ts");
const { executeCatalogTool, catalogEvidence } = __req("packages/chat-agent/src/agent/catalog-tools.ts");
const { SYSTEM_ASK, SYSTEM_BUILD, nudgeText, systemText, userPrompt } = __req("packages/chat-agent/src/agent/prompts.ts");
function parseArgs(raw: string | undefined): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw || "{}") as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function modelText(message: AgentMessage): string {
	return typeof message.text === "string" ? message.text.trim() : "";
}


/** The request after the nudge: Build forces the write_page call (Ask stays on auto). */
const FORCE_WRITE = { name: "write_page" } as const;

/** Identity of an error list: code, path and the rejected value; two equal lists in a row end the turn. A new value at the same path is a new attempt, not a repeat. */
function signature(issues: Array<{ path: string; code: string; got?: unknown }>): string {
	return JSON.stringify(issues.map((issue) => `${issue.code} ${issue.path} ${JSON.stringify(issue.got ?? null)}`).sort());
}

type TurnResultOut = { result: AgentReply | AgentFailure; meta: LiveTurnMeta };

type IssueSet = { signature: string; issues: Array<{ path: string; code: string; expected: string; got?: unknown }>; message: string };

/** What the loop has so far: the working page, the last accepted proposal, the last failed write, the catalog blocks read. */
type LoopState = { working: PageV2; proposal: PageProposal | null; lastIssues: IssueSet | null; stuck: IssueSet | null; blocks: string[]; accepted: boolean; rejected: AgentFailure["rejected"] | null };

type ToolCall = NonNullable<AgentMessage["calls"]>[number];

/** One tool call of a step: the write (accepted, or the issue list and the stuck check) or a catalog read; the answer for the model. */
function runToolCall(ctx: TurnContext, state: LoopState, name: string, args: Record<string, unknown>): unknown {
	if (name === "write_page") {
		const written = runWriteTool(ctx, state.working, args);
		if (written.ok) {
			state.working = written.page;
			state.proposal = written.proposal;
			state.accepted = true;
			state.lastIssues = null;
			return written.payload;
		}
		state.rejected = rejectedWrite(args, written.issues, written.code);
		const sig = signature(written.issues);
		if (state.lastIssues?.signature === sig) state.stuck = { signature: sig, issues: written.issues, message: written.message };
		state.lastIssues = { signature: sig, issues: written.issues, message: written.message };
		return { ok: false, code: written.code, message: written.message, issues: written.issues };
	}
	const outcome = executeCatalogTool({ name, arguments: args }, { mode: ctx.mode, page: state.working });
	if (!outcome.ok) return { ok: false, code: outcome.code, message: outcome.message, ...(outcome.result ? { result: outcome.result } : {}) };
	if (name === "get_block") {
		const info = itemInfo(String((outcome.result as { item?: unknown }).item ?? ""));
		if (info) state.blocks.push(info.item);
	}
	return outcome.result;
}

/** The result of a finished loop: the proposal, a stuck or invalid write, the text answer, or no answer. */
function loopResult(ctx: TurnContext, state: LoopState, text: string, steps: number, meta: LiveTurnMeta): TurnResultOut {
	const { stuck, proposal, lastIssues } = state;
	const rejected = state.rejected ? { rejected: state.rejected } : {};
	if (stuck) {
		const shown = stuck.issues.slice(0, 3).map((issue) => `${issue.path} ${issue.code}`).join("; ");
		return { result: { ok: false, code: "write_stuck", message: `The page was not written: the agent sent the same invalid page twice (${shown}). Nothing changed.`, issues: stuck.issues, ...rejected }, meta };
	}
	if (proposal && proposal.diff.length > 0) return { result: agentReply(ctx.mode, text, state.blocks, proposal), meta };
	if (lastIssues) return { result: { ok: false, code: "write_invalid", message: lastIssues.message, issues: lastIssues.issues, ...rejected }, meta };
	if (ctx.mode === "build") return state.accepted ? { result: agentReply(ctx.mode, "", state.blocks), meta } : { result: { ok: false, code: "build_no_proposal", message: "Build ended without an accepted page write. No page proposal was created." }, meta };
	if (text) return { result: agentReply(ctx.mode, text, state.blocks), meta };
	return { result: { ok: false, code: "no_answer", message: `The model ended without an answer or a page write within ${steps} step${steps === 1 ? "" : "s"}.` }, meta };
}


function runCalls(ctx: TurnContext, state: LoopState, calls: ToolCall[], counts: BudgetCounts, toolsCalled: string[], messages: AgentMessage[], budget: Pick<ExecutionBudget, "maxToolCalls" | "maxWriteAttempts">, execution: ReturnType<typeof createExecution>, allowed: string[], readToolLimit?: number): AgentFailure | null {
	let wrote = false;
	for (const [index, call] of calls.entries()) {
		const name = call.name ?? "";
		if (name !== "write_page" && readToolLimit !== undefined && counts.toolCalls >= readToolLimit) {
			const reply = { ok: false, code: "completion_reserved", message: "Catalog reading is complete for this turn. Call write_page with the information already read." };
			execution.recorder.tool(call, reply, 0, null, undefined, false);
			messages.push({ role: "tool", callId: call.id, name, text: JSON.stringify(reply) });
			continue;
		}
		if (counts.toolCalls >= budget.maxToolCalls || (name === "write_page" && !wrote && counts.writeAttempts >= budget.maxWriteAttempts)) {
			for (const skipped of calls.slice(index)) execution.recorder.tool(skipped, { ok: false, code: "tool_budget" }, 0, null, undefined, false);
			return { ok: false, code: "tool_budget", message: "The tool or write-attempt budget was reached. No further tools were executed." };
		}
		counts.toolCalls += 1;
		toolsCalled.push(name);
		const duplicateWrite = name === "write_page" && wrote;
		if (name === "write_page" && !wrote) { wrote = true; counts.writeAttempts += 1; }
		const started = Date.now();
		const reply = !allowed.includes(name) ? { ok: false, code: "tool_not_allowed" } : duplicateWrite ? { ok: false, code: "multiple_writes", message: "Only one write_page attempt per provider response is allowed." } : runToolCall(ctx, state, name, parseArgs(call.argumentsJson));
		execution.recorder.tool(call, reply, Date.now() - started, state.proposal, catalogEvidence(name, reply), allowed.includes(name) && !duplicateWrite);
		messages.push({ role: "tool", callId: call.id, name, text: JSON.stringify(reply) });
	}
	return null;
}

async function runAgentLoop(modelId: string, ctx: TurnContext, signal: AbortSignal, provider: AgentProvider, runId: string, options: ExecutionOptions = {}): Promise<TurnResultOut> {
	const scenario = options.scenario;
	if (scenario && (scenario.modelId !== modelId || scenario.profile.mode !== ctx.mode)) throw new Error("Scenario binding mismatch");
	if (scenario?.profile.context === "block.props@1") return editFields(modelId, ctx, signal, provider, runId, options);
	const execution = createExecution(modelId, signal, provider, runId, options);
	try { return await runLoop(ctx, options, execution); }
	catch (error) { const failed = execution.failure(error); return { result: failed.result, meta: failed.meta }; }
}

async function runLoop(ctx: TurnContext, options: ExecutionOptions, execution: ReturnType<typeof createExecution>): Promise<TurnResultOut> {
	const scenario = options.scenario;
	const budget = scenario?.budget ?? AGENT_BUDGET;
	const { trace, counts, finish, stopped, request: send } = execution;
	// The turn-start probe: every block of the current page is rendered once, and the result serves the prompt and the nudge (ADR 0038).
	const problems = renderProblems(ctx.page);
	const messages: AgentMessage[] = [
		{ role: "system", text: systemText(scenario?.systemPrompt ?? (ctx.mode === "ask" ? SYSTEM_ASK : SYSTEM_BUILD), ctx) },
		{ role: "user", text: scenario ? scenario.context(ctx, problems) : userPrompt(ctx, problems) }
	];
	const tools = scenario?.tools ?? agentTools(ctx.mode);
	const state: LoopState = { working: ctx.page, proposal: null, lastIssues: null, stuck: null, blocks: [], accepted: false, rejected: null };
	let text = "";
	let endedOnCalls = false;
	// Build asks for a tool call on every step (tool_choice "required"): the model reads with the catalog tools and ends with
	// write_page, and the turn ends with the first accepted write (no extra model step to summarize it). If a step still comes
	// back as plain text, the model is told once and the next request forces write_page by name. Ask has no write tool: it stays
	// on "auto" and is never nudged.
	const build = ctx.mode === "build";
	const policy = scenario?.executionPolicy ?? CURRENT_EXECUTION_POLICY;
	const reserve = build && "buildCompletion" in policy ? policy.buildCompletion : undefined;
	const open = problems.length;
	const canWrite = tools.some((tool) => tool.name === "write_page");
	const expectsChange = canWrite && (open > 0 || build);
	let nudged = false;
	let forceNamed = false;
	let completionAnnounced = false;
	const changed = () => Boolean(state.proposal && state.proposal.diff.length > 0);
	execution.recorder.prefix(messages, tools);
	const request = (toolChoice: Parameters<typeof send>[0]["toolChoice"], phase?: string, completionReason?: string) => send({ messages, tools, toolChoice, nudged, phase, completionReason });
	let steps = 0;
	while (steps < budget.maxSteps && !state.stuck) {
		const phase = completionPhase(budget, counts, steps, Boolean(state.lastIssues), reserve, options.deadline === undefined ? Infinity : options.deadline - Date.now());
		const forced = forceNamed || phase.forceWrite;
		if (phase.forceWrite && !forceNamed && !completionAnnounced) {
			completionAnnounced = true;
			nudged = true;
			messages.push({ role: "user", text: "Host completion phase: use the registry items already read and call write_page now. Return the document or patch in the tool call, never in chat text. The remaining requests are reserved for validation repair." });
		}
		steps += 1;
		execution.recorder.loopStep();
		endedOnCalls = false;
		let step = await request(forced ? FORCE_WRITE : scenario?.toolChoice ?? agentToolChoice(ctx.mode), build ? (state.lastIssues ? "repair" : forced ? "write" : "read") : undefined, phase.reason ?? (forceNamed ? "text_nudge" : undefined));
		// A model that refuses the named function gets "required".
		if (forced && !step.ok && (step.meta.providerStatus === 400 || step.meta.providerStatus === 422)) step = await request("required", build ? phase.phase : undefined, "named_fallback");
		forceNamed = false;
		if (!step.ok) return { result: step.result, meta: { ...step.meta, ...finish() } };
		const message = step.message;
		const said = modelText(message);
		if (said) text = said;
		const calls: ToolCall[] = message.calls ?? [];
		if (calls.length === 0) {
			if (expectsChange && !nudged && !changed() && steps < budget.maxSteps) {
				nudged = true;
				forceNamed = build;
				messages.push({ role: "assistant", text: said || "" }, { role: "user", text: scenario ? scenario.nudge(ctx, open) : nudgeText(ctx, open) });
				continue;
			}
			break;
		}
		endedOnCalls = true;
		trace.toolCallingWorked = true;
		messages.push({ role: "assistant", text: message.text ?? "", calls });
		state.accepted = false;
		const stop = stopped();
		if (stop && !stop.ok) return { result: stop.result, meta: stop.meta };
		const failure = runCalls(ctx, state, calls, counts, trace.toolsCalled, messages, budget, execution, forced && build ? ["write_page"] : tools.map((tool) => tool.name), reserve ? budget.maxToolCalls - reserve.reservedToolCalls : undefined);
		if (failure) { execution.recorder.stop(failure.code); return { result: failure, meta: finish() }; }
		// Build ends with the accepted write.
		// The text beside the call is not an answer (a model may print the document there): the host shows the diff card and the status.
		if (build && state.accepted) {
			text = "";
			endedOnCalls = false;
			break;
		}
	}
	if (!build && endedOnCalls && !state.stuck && !changed()) {
		// The step budget ended on tool calls: one more request, no tools, so the model answers with what it read.
		const last = await request("none");
		if (!last.ok) return { result: last.result, meta: { ...last.meta, ...finish() } };
		if (last.ok) text = modelText(last.message) || text;
	}
	const result = loopResult(ctx, state, text, trace.steps, finish());
	execution.recorder.stop(result.result.ok ? (state.accepted ? "proposal_accepted" : "answer") : result.result.code);
	return { ...result, meta: finish() };
}

exports["runAgentLoop"] = runAgentLoop;

});

__def("packages/chat-agent/src/scenarios/builtins.v1.json", function (exports) {
  exports.default = {
	"format": "buildy-scenario-registry",
	"version": 1,
	"defaults": {
		"ask": {
			"id": "page.ask",
			"version": 3
		},
		"build": {
			"id": "page.build",
			"version": 4
		}
	},
	"profiles": [
		{
			"format": "buildy-agent-scenario",
			"id": "page.ask",
			"version": 3,
			"mode": "ask",
			"provider": "xai",
			"prompt": "page.ask@1",
			"context": "page.context@1",
			"nudge": "page.nudge@1",
			"toolSet": {
				"ref": "buildy-agent-tools/4"
			},
			"execution": "page-loop@3",
			"limits": {},
			"model": {
				"selection": "author"
			},
			"providerVersion": 2
		},
		{
			"format": "buildy-agent-scenario",
			"id": "page.build",
			"version": 4,
			"mode": "build",
			"provider": "xai",
			"prompt": "page.build@1",
			"context": "page.context@1",
			"nudge": "page.nudge@1",
			"toolSet": {
				"ref": "buildy-agent-tools/4"
			},
			"execution": "page-loop@3",
			"limits": {
				"maxSteps": 24,
				"maxRequests": 32,
				"maxToolCalls": 64,
				"maxWriteAttempts": 8
			},
			"model": {
				"selection": "author"
			},
			"providerVersion": 2
		},
		{
			"format": "buildy-agent-scenario",
			"id": "page.edit-fields",
			"version": 2,
			"mode": "build",
			"provider": "xai",
			"prompt": "page.edit-fields@1",
			"context": "block.props@1",
			"nudge": "page.nudge@1",
			"toolSet": {
				"ref": "buildy-agent-tools/4",
				"include": [
					"write_page"
				]
			},
			"execution": "page-loop@3",
			"limits": {
				"maxSteps": 3,
				"maxRequests": 5,
				"maxToolCalls": 3,
				"maxWriteAttempts": 3
			},
			"model": {
				"selection": "author"
			},
			"providerVersion": 2
		}
	]
};
});

__def("packages/chat-agent/src/scenarios/registry.ts", function (exports) {
const { immutableData, providerManifest } = __req("packages/agent-manifests/src/index.ts");
const definitions = __req("packages/chat-agent/src/scenarios/builtins.v1.json").default;
const { compileScenario, parseScenarioRef } = __req("packages/chat-agent/src/scenarios/compile.ts");
const { AGENT_MODES } = __req("packages/chat-agent/src/agent/agent-tools.ts");
immutableData(definitions);
const profiles = definitions.profiles;
const identities = new Set<string>();
for (const profile of profiles) {
	const key = `${profile.id}@${profile.version}`;
	if (identities.has(key)) throw new Error(`Duplicate scenario: ${key}`);
	identities.add(key);
	const manifest = providerManifest(profile.provider, profile.providerVersion);
	const modelId = "id" in profile.model && typeof profile.model.id === "string" ? profile.model.id : manifest?.defaultModelId;
	if (!modelId || !compileScenario(profile, modelId).ok) throw new Error(`Invalid built-in scenario: ${key}`);
}
for (const mode of AGENT_MODES) {
	const ref = parseScenarioRef(definitions.defaults[mode]);
	if (!ref || !profiles.some((profile) => profile.id === ref.id && profile.version === ref.version && profile.mode === mode)) throw new Error(`Invalid default scenario for ${mode}`);
}
const cache = new Map<string, ReturnType<typeof compileScenario>>();

function scenarioProfiles() { return profiles; }

/** Live resolution accepts registered references only, never a browser-supplied profile body. */
function resolveScenario(mode: AgentMode, modelId: string, ref: ScenarioRef = definitions.defaults[mode]) {
	const profile = profiles.find((profile) => profile.id === ref.id && profile.version === ref.version && profile.mode === mode);
	if (!profile) return { ok: false, issues: [{ path: "/scenario", code: "unknown_scenario_version_or_mode" }] } as const;
	const key = `${profile.id}@${profile.version}:${modelId}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const result = compileScenario(profile, modelId);
	if (result.ok) cache.set(key, result);
	return result;
}

exports["scenarioProfiles"] = scenarioProfiles;
exports["resolveScenario"] = resolveScenario;

});

__def("packages/chat-agent/src/agent/build-summary.ts", function (exports) {

function buildSummaryFacts(page: PageV2, trace: RunTrace | undefined): BuildSummaryFacts {
	const fixed: string[] = [];
	let rejectedWrites = 0;
	for (const result of trace?.toolResults ?? []) {
		if (result.name !== "write_page" || result.accepted !== false) continue;
		rejectedWrites += 1;
		for (const issue of result.gate?.issues ?? []) {
			const text = `${issue.code} ${issue.path}`;
			if (!fixed.includes(text)) fixed.push(text);
		}
	}
	return {
		editFields: trace?.scenario?.id === "page.edit-fields",
		title: page.title,
		blocks: page.blocks.map((block) => `${block.item}${block.variant ? ` ${block.variant}` : ""}`),
		fixed,
		rejectedWrites
	};
}

exports["buildSummaryFacts"] = buildSummaryFacts;

});

__def("packages/chat-agent/src/run-attempt.ts", function (exports) {
const { aggregateSessionUsage, unknownUsage } = __req("packages/chat-agent/src/usage.ts");
function startAttempt(attemptId: string, userMessageId: string, modelId: string, startedAt: string): RunAttempt {
	return { format: "run-attempt/1", attemptId, userMessageId, modelId, startedAt, status: "running", usage: unknownUsage("error", 0), traceState: "not_received" };
}
function endAttempt(attempt: RunAttempt, status: Exclude<RunAttempt["status"], "running">, endedAt: string, details: Partial<Pick<RunAttempt, "runId" | "assistantMessageId" | "provider" | "scenario" | "code" | "traceState" | "usage">> = {}): RunAttempt {
	const usage = details.usage ?? attempt.usage;
	return { ...attempt, ...details, status, endedAt, usage: status === "completed" ? usage : { ...usage, status: "incomplete", incompleteReason: status === "aborted" || status === "superseded" ? "cancelled" : "error" } };
}

/** Legacy message runs are counted only when no attempt already owns that message. */
function usageOfAttempts(attempts: RunAttempts, messages: Array<{ id: string; run?: { usage: RunUsage } }>) {
	const values = Object.values(attempts);
	const owned = new Set(values.map((attempt) => attempt.assistantMessageId));
	return aggregateSessionUsage([...values.map((attempt) => attempt.usage), ...messages.filter((message) => !owned.has(message.id)).flatMap((message) => message.run ? [message.run.usage] : [])]);
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function count(value: unknown) { return value === "unknown" || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0); }
function isAttempt(value: unknown): value is RunAttempt {
 if (!record(value) || value.format !== "run-attempt/1" || typeof value.attemptId !== "string" || typeof value.userMessageId !== "string" || typeof value.modelId !== "string" || typeof value.startedAt !== "string") return false;
 if (!["running", "completed", "error", "aborted", "superseded", "interrupted"].includes(String(value.status)) || !["not_received", "received"].includes(String(value.traceState))) return false;
 if (!record(value.usage)) return false;
 const usage = value.usage;
 return ["complete", "incomplete"].includes(String(usage.status)) && typeof usage.steps === "number" && Number.isSafeInteger(usage.steps) && usage.steps >= 0 && count(usage.promptTokens) && count(usage.completionTokens) && count(usage.totalTokens) && record(usage.cost);
}
/** Unknown extension versions stay opaque; a host must not reinterpret or overwrite them. */
function readRunAttempts(value: unknown): RunAttempts | null {
 if (!record(value)) return null;
 const entries: Array<[string, RunAttempt]> = [];
 for (const [id, attempt] of Object.entries(value)) {
  if (!isAttempt(attempt) || id !== attempt.attemptId) return null;
  entries.push([id, attempt]);
 }
 return Object.fromEntries(entries);
}

exports["startAttempt"] = startAttempt;
exports["endAttempt"] = endAttempt;
exports["usageOfAttempts"] = usageOfAttempts;
exports["readRunAttempts"] = readRunAttempts;

});

__def("packages/chat-agent/src/index.ts", function (exports) {
{ const __m = __req("packages/chat-agent/src/agent/agent-tools.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/agent/blocks.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/agent/catalog-tools.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/agent/turn.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/models.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/proposal-base.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
exports["chatCacheKey"] = __req("packages/chat-agent/src/identity.ts")["chatCacheKey"];
{ const __m = __req("packages/chat-agent/src/usage.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
exports["TICKS_PER_USD"] = __req("packages/chat-agent/src/cost.ts")["TICKS_PER_USD"];
exports["usdToTicks"] = __req("packages/chat-agent/src/cost.ts")["usdToTicks"];
exports["OPENROUTER_MODELS"] = __req("packages/agent-manifests/src/index.ts")["OPENROUTER_MODELS"];
exports["appCandidate"] = __req("packages/agent-manifests/src/index.ts")["appCandidate"];
exports["appModelIds"] = __req("packages/agent-manifests/src/index.ts")["appModelIds"];
exports["APPROVED_ID_PATTERN"] = __req("packages/agent-manifests/src/index.ts")["APPROVED_ID_PATTERN"];
exports["APPROVED_MAX_IDS"] = __req("packages/agent-manifests/src/index.ts")["APPROVED_MAX_IDS"];
exports["IMAGE_MODELS"] = __req("packages/agent-manifests/src/index.ts")["IMAGE_MODELS"];
exports["MEDIA_SLOT_CONCURRENCY"] = __req("packages/agent-manifests/src/index.ts")["MEDIA_SLOT_CONCURRENCY"];
exports["MODEL_KINDS"] = __req("packages/agent-manifests/src/index.ts")["MODEL_KINDS"];
exports["OPENROUTER_MEDIA_ENABLED"] = __req("packages/agent-manifests/src/index.ts")["OPENROUTER_MEDIA_ENABLED"];
exports["PROVIDER_IDS"] = __req("packages/agent-manifests/src/index.ts")["PROVIDER_IDS"];
exports["PROVIDER_ROLES"] = __req("packages/agent-manifests/src/index.ts")["PROVIDER_ROLES"];
exports["PROVIDER_ROLE_SUPPORT"] = __req("packages/agent-manifests/src/index.ts")["PROVIDER_ROLE_SUPPORT"];
exports["XAI_KEY_MAX"] = __req("packages/agent-manifests/src/index.ts")["XAI_KEY_MAX"];
exports["isProviderId"] = __req("packages/agent-manifests/src/index.ts")["isProviderId"];
exports["isProviderLimit"] = __req("packages/agent-manifests/src/index.ts")["isProviderLimit"];
exports["openRouterModel"] = __req("packages/agent-manifests/src/index.ts")["openRouterModel"];
{ const __m = __req("packages/chat-agent/src/xai-env.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/protect.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/redact.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
{ const __m = __req("packages/chat-agent/src/env-map.ts"); for (const __k of Object.keys(__m)) if (__k !== "default" && !(__k in exports)) exports[__k] = __m[__k]; }
exports["contractFingerprint"] = __req("packages/chat-agent/src/fingerprint.ts")["contractFingerprint"];
exports["MACRO_RULE"] = __req("packages/chat-agent/src/agent/prompts.ts")["MACRO_RULE"];
exports["SYSTEM_ASK"] = __req("packages/chat-agent/src/agent/prompts.ts")["SYSTEM_ASK"];
exports["SYSTEM_BUILD"] = __req("packages/chat-agent/src/agent/prompts.ts")["SYSTEM_BUILD"];
exports["nudgeText"] = __req("packages/chat-agent/src/agent/prompts.ts")["nudgeText"];
exports["systemText"] = __req("packages/chat-agent/src/agent/prompts.ts")["systemText"];
exports["todayIn"] = __req("packages/chat-agent/src/agent/prompts.ts")["todayIn"];
exports["userPrompt"] = __req("packages/chat-agent/src/agent/prompts.ts")["userPrompt"];
exports["runAgentLoop"] = __req("packages/chat-agent/src/agent/loop.ts")["runAgentLoop"];
exports["turnMeta"] = __req("packages/chat-agent/src/agent/provider.ts")["turnMeta"];
exports["compileScenario"] = __req("packages/chat-agent/src/scenarios/compile.ts")["compileScenario"];
exports["parseScenarioRef"] = __req("packages/chat-agent/src/scenarios/compile.ts")["parseScenarioRef"];
exports["resolveScenario"] = __req("packages/chat-agent/src/scenarios/registry.ts")["resolveScenario"];
exports["scenarioProfiles"] = __req("packages/chat-agent/src/scenarios/registry.ts")["scenarioProfiles"];
exports["POLICY_VERSION"] = __req("packages/chat-agent/src/policy.ts")["POLICY_VERSION"];
exports["MODEL_CATALOG_VERSION"] = __req("packages/chat-agent/src/policy.ts")["MODEL_CATALOG_VERSION"];
exports["TRIAL_POLICY_VERSION"] = __req("packages/chat-agent/src/policy.ts")["TRIAL_POLICY_VERSION"];
exports["buildSummaryFacts"] = __req("packages/chat-agent/src/agent/build-summary.ts")["buildSummaryFacts"];
exports["startAttempt"] = __req("packages/chat-agent/src/run-attempt.ts")["startAttempt"];
exports["endAttempt"] = __req("packages/chat-agent/src/run-attempt.ts")["endAttempt"];
exports["usageOfAttempts"] = __req("packages/chat-agent/src/run-attempt.ts")["usageOfAttempts"];
exports["readRunAttempts"] = __req("packages/chat-agent/src/run-attempt.ts")["readRunAttempts"];



});

__def("packages/builder-core/src/catalog/props-gate.ts", function (exports) {
const Ajv2020 = __ext_ajv2020;
const { propsSchemaFor, refShapeDefs } = __req("packages/builder-core/src/catalog/props-schema.ts");
const { setPropsValidator } = __req("packages/builder-core/src/catalog/validator.ts");
const ajv = new Ajv2020({ strict: true, allErrors: true });
const compiled = new Map<string, ValidateFunction>();

function validatorFor(item: string): ValidateFunction | null {
	const cached = compiled.get(item);
	if (cached) return cached;
	const schema = propsSchemaFor(item);
	if (!schema) return null;
	const validate = ajv.compile(schema);
	compiled.set(item, validate);
	return validate;
}

const RANK: Record<string, number> = { enum: 0, const: 0, required: 1, type: 2, additionalProperties: 3, pattern: 4, not: 5 };

function insideRefShape(error: ErrorObject): boolean {
	const match = /#\/\$defs\/([^/]+)/.exec(error.schemaPath);
	return Boolean(match && refShapeDefs.has(match[1]!));
}

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
	}
	return current;
}

/** Ajv errors -> one issue per pointer, the most specific keyword first, reference-shape branches dropped. */
function propsIssues(errors: ErrorObject[], data: unknown): PropsIssue[] {
	const best = new Map<string, ErrorObject>();
	for (const error of errors) {
		if (error.keyword === "anyOf" || error.keyword === "oneOf" || insideRefShape(error)) continue;
		const pointer = error.keyword === "required" ? `${error.instancePath}/${(error.params as { missingProperty: string }).missingProperty}` : error.instancePath;
		const seen = best.get(pointer);
		if (!seen || (RANK[error.keyword] ?? 9) < (RANK[seen.keyword] ?? 9)) best.set(pointer, error);
	}
	if (!best.size && errors.length) {
		const first = errors[0]!;
		best.set(first.instancePath, first);
	}
	return [...best.entries()].map(([pointer, error]) => {
		const issue: PropsIssue = { pointer, keyword: error.keyword, message: error.message ?? error.keyword };
		if (error.keyword === "required") issue.message = "is required";
		else {
			const value = valueAt(data, pointer);
			if (value !== undefined && (typeof value !== "object" || value === null)) issue.value = value;
		}
		if (error.keyword === "enum") issue.allowed = (error.params as { allowedValues: unknown[] }).allowedValues;
		if (error.keyword === "additionalProperties") issue.message = `has no prop ${(error.params as { additionalProperty: string }).additionalProperty}`;
		return issue;
	});
}

/** Issues of the merged props of one registry block; [] when they match the published schema. */
function validateRegistryProps(render: RegistryRender): PropsIssue[] {
	const validate = validatorFor(render.item);
	if (!validate) return [{ pointer: "", keyword: "schema", message: `registry item ${render.item} has no published props schema` }];
	if (validate(render.props)) return [];
	return propsIssues(validate.errors ?? [], render.props);
}

function installPropsGate(): void {
	setPropsValidator(validateRegistryProps);
}

installPropsGate();

exports["validateRegistryProps"] = validateRegistryProps;
exports["installPropsGate"] = installPropsGate;

});

__def("packages/provider-xai/src/codec.ts", function (exports) {

function xaiMessage(message: AgentMessage): Record<string, unknown> {
	return {
		role: message.role,
		content: message.text ?? null,
		...(message.calls?.length ? { tool_calls: message.calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.argumentsJson } })) } : {}),
		...(message.callId ? { tool_call_id: message.callId } : {}),
		...(message.name ? { name: message.name } : {})
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> | null {
	return isRecord(value) ? value : null;
}

function text(value: unknown): string | null {
	if (value == null) return "";
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return null;
	const parts: string[] = [];
	for (const part of value) {
		const item = record(part);
		if (item?.type !== "text" || typeof item.text !== "string") return null;
		parts.push(item.text);
	}
	return parts.join("");
}

function readXaiMessage(value: unknown): AgentMessage | null {
	const message = record(value);
	if (!message || message.role !== "assistant" || message.refusal) return null;
	const content = text(message.content);
	if (content === null) return null;
	const calls = [];
	const ids = new Set<string>();
	if (message.tool_calls !== undefined) {
		if (!Array.isArray(message.tool_calls)) return null;
		for (const value of message.tool_calls) {
			const call = record(value);
			const fn = record(call?.function);
			if (!call || call.type !== "function" || typeof call.id !== "string" || !call.id || ids.has(call.id) || typeof fn?.name !== "string" || !fn.name || typeof fn.arguments !== "string") return null;
			ids.add(call.id);
			calls.push({ id: call.id, name: fn.name, argumentsJson: fn.arguments });
		}
	}
	return { role: "assistant", text: content, ...(calls.length ? { calls } : {}) };
}

function xaiRefused(value: unknown): boolean {
	const message = record(value);
	return typeof message?.refusal === "string" && message.refusal.length > 0;
}

exports["xaiMessage"] = xaiMessage;
exports["readXaiMessage"] = readXaiMessage;
exports["xaiRefused"] = xaiRefused;

});

__def("packages/provider-xai/src/errors.ts", function (exports) {
const { isProviderLimit } = __req("packages/agent-manifests/src/index.ts");
function retryAfterMs(value: string | null, now = Date.now()): number | undefined {
	if (value === null) return undefined;
	const seconds = /^[0-9]+(?:\.[0-9]+)?$/.test(value.trim()) ? Number(value) : NaN;
	const ms = Number.isFinite(seconds) ? seconds * 1000 : /^[A-Za-z]{3}, [0-9]{2} [A-Za-z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(value.trim()) ? Date.parse(value) - now : NaN;
	return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

function classifyProviderFailure(status: number, snippet: string) {
	// A key out of credit or over its spending limit (ADR 0068): the app shows the provider as "Limit reached".
	if (isProviderLimit(status, snippet)) return { code: "provider_limit", message: "The provider key reached its credit or spending limit.", retryable: false };
	if (status === 401) return { code: "provider_unauthorized", message: "The provider rejected authentication.", retryable: false };
	if (status === 403) return { code: "provider_forbidden", message: "The provider denied access.", retryable: false };
	if (status === 429) return { code: "rate_limited", message: "The provider rate limit was reached.", retryable: true };
	if (status >= 500) return { code: "provider_unavailable", message: "The provider service failed.", retryable: [500, 502, 503, 504].includes(status) };
	const lower = snippet.toLowerCase();
	if (/tool|function.?call/.test(lower) && /not.?support|unavail|invalid|unknown/.test(lower)) return { code: "tools_unsupported", message: "The model rejected application tools. No other model was substituted.", retryable: false };
	if (status === 404 || /model.?not.?found|unknown.?model|does not exist/.test(lower)) return { code: "model_unavailable", message: "The requested model is unavailable. No fallback was selected.", retryable: false };
	return { code: "provider_failed", message: "The provider rejected the request.", retryable: false };
}

exports["retryAfterMs"] = retryAfterMs;
exports["classifyProviderFailure"] = classifyProviderFailure;

});

__def("packages/provider-xai/src/capabilities.ts", function (exports) {
const { providerManifest, manifestModelStatus } = __req("packages/agent-manifests/src/index.ts");
function xaiCapabilities(modelId: string, version?: number) {
	const manifest = providerManifest("xai", version);
	if (!manifest) return null;
	const model = manifestModelStatus("xai", modelId, manifest.version);
	const { models: _models, defaultModelId: _default, id, ...capabilities } = manifest;
	return { ...capabilities, provider: id, modelId, toolLoop: model.status, unavailableCode: model.code };
}

exports["xaiCapabilities"] = xaiCapabilities;

});

__def("packages/provider-xai/src/openrouter.ts", function (exports) {
const { IMAGE_MODELS } = __req("packages/agent-manifests/src/index.ts");
exports["OPENROUTER_CHAT_MODELS"] = __req("packages/agent-manifests/src/index.ts")["OPENROUTER_CHAT_MODELS"];
exports["OPENROUTER_MODELS"] = __req("packages/agent-manifests/src/index.ts")["OPENROUTER_MODELS"];
exports["appCandidate"] = __req("packages/agent-manifests/src/index.ts")["appCandidate"];
exports["appModelIds"] = __req("packages/agent-manifests/src/index.ts")["appModelIds"];
exports["openRouterModel"] = __req("packages/agent-manifests/src/index.ts")["openRouterModel"];
exports["USD_TICKS"] = __req("packages/chat-agent/src/index.ts")["USD_TICKS"];
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** The page the browser opens to sign in (query: callback_url, code_challenge, code_challenge_method=S256). */
const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";

/** Where the code is exchanged for the user's key (POST {code, code_verifier, code_challenge_method}). */
const OPENROUTER_KEYS_PATH = "/auth/keys";

/**
 * The loopback callback: `http://localhost:<random port>/cb/<state>`. OpenRouter documents `localhost` callbacks on any
 * port; the state rides in the path because OpenRouter documents no `state` parameter (it appends `?code=` only).
 */
const OPENROUTER_CALLBACK = { host: "localhost", pathPrefix: "/cb/", ttlSeconds: 600 } as const;

/** The chat models the desktop offers through OpenRouter, the default first, and the app ids they serve (agent-manifests). */
const OPENROUTER_CANDIDATE_MODEL = "x-ai/grok-4.20";

/** The image model (POST /images, base64 answers stored by the host). */
const OPENROUTER_IMAGE_MODEL = IMAGE_MODELS.openrouter;

/** Model discovery: chat models, then image models (both public lists, the host still sends its key). */
const OPENROUTER_DISCOVERY = ["/models", "/images/models"] as const;

/** The header OpenRouter reads for sticky routing (prompt cache); the webview's `x-grok-conv-id` becomes it. */
const OPENROUTER_SESSION_HEADER = "x-session-id";

/** One USD in the cost unit of the media answer (`costUsdTicks`, xAI's 1e-10 USD ticks); OpenRouter reports USD. */
const OPENROUTER_FORWARD_BASE = "/runtime/v1/openrouter";

/** Whether the model OpenRouter answered with is the one sent (OpenRouter may add a dated suffix). */
function sameOpenRouterModel(sent: string, answered: string): boolean {
	return answered === sent || answered.startsWith(`${sent}-`);
}

exports["OPENROUTER_BASE_URL"] = OPENROUTER_BASE_URL;
exports["OPENROUTER_AUTH_URL"] = OPENROUTER_AUTH_URL;
exports["OPENROUTER_KEYS_PATH"] = OPENROUTER_KEYS_PATH;
exports["OPENROUTER_CALLBACK"] = OPENROUTER_CALLBACK;
exports["OPENROUTER_CANDIDATE_MODEL"] = OPENROUTER_CANDIDATE_MODEL;
exports["OPENROUTER_IMAGE_MODEL"] = OPENROUTER_IMAGE_MODEL;
exports["OPENROUTER_DISCOVERY"] = OPENROUTER_DISCOVERY;
exports["OPENROUTER_SESSION_HEADER"] = OPENROUTER_SESSION_HEADER;
exports["OPENROUTER_FORWARD_BASE"] = OPENROUTER_FORWARD_BASE;
exports["sameOpenRouterModel"] = sameOpenRouterModel;

});

__def("packages/provider-xai/src/provider.ts", function (exports) {
const { assertNoFallback, readProviderUsage } = __req("packages/chat-agent/src/index.ts");
const { xaiMessage, readXaiMessage, xaiRefused } = __req("packages/provider-xai/src/codec.ts");
const { classifyProviderFailure, retryAfterMs } = __req("packages/provider-xai/src/errors.ts");
const { xaiCapabilities } = __req("packages/provider-xai/src/capabilities.ts");
const { openRouterModel, sameOpenRouterModel } = __req("packages/provider-xai/src/openrouter.ts");
function silentFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	return fetch(input, init);
}


async function providerStep(input: ProviderRequest & { apiKey: string; baseUrl: string; wire?: ProviderWire }): Promise<ProviderStep> {
	if (input.provider && input.provider.id !== "xai") return { ok: false, error: { code: "provider_mismatch", message: "The request is bound to another provider. No request was sent." } };
	const capabilities = xaiCapabilities(input.modelId, input.provider?.version);
	if (!capabilities) return { ok: false, error: { code: "unknown_provider_version", message: "The requested provider policy version is unavailable. No request was sent." } };
	const choice = input.toolChoice;
	if (capabilities.toolLoop !== "enabled") return { ok: false, error: { code: capabilities.unavailableCode ?? "model_tools_unavailable", message: "This model is not enabled for the xAI tool adapter. No fallback was selected." } };
	if (!Number.isSafeInteger(input.maxTokens) || input.maxTokens <= 0 || (choice === "required" && input.tools.length === 0) || (typeof choice === "object" && !input.tools.some((tool) => tool.name === choice.name))) {
		return { ok: false, error: { code: "unsupported_request", message: "Invalid token limit or unavailable tool choice. No provider request was sent." } };
	}
	// OpenRouter: the same request under OpenRouter's model id, with grok-4.20's reasoning switch.
	const routed = input.wire === "openrouter" ? openRouterModel(input.modelId) : null;
	if (input.wire === "openrouter" && !routed) return { ok: false, error: { code: "model_not_enabled_on_account", message: "OpenRouter does not serve this model here. No request was sent." } };
	const requestInfo = { promptCacheKeySent: Boolean(input.cacheKey), parallelToolCalls: input.provider?.version === 1 ? "provider_default" as const : false, completionTokenParameter: capabilities.completionTokenParameter, maxTokens: input.maxTokens };
	const requestStarted = Date.now();
	const res = await silentFetch(`${input.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			...(input.cacheKey ? { "x-grok-conv-id": input.cacheKey } : {}),
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify({
			model: routed?.id ?? input.modelId,
			...(routed && "reasoning" in routed ? { reasoning: routed.reasoning } : {}),
			messages: input.messages.map(xaiMessage),
			tools: input.tools.map((tool) => ({ type: "function", function: tool })),
			// Choice comes from the versioned agent mode policy; the host may explicitly force a repair write.
			tool_choice: typeof input.toolChoice === "string" ? input.toolChoice : { type: "function", function: input.toolChoice },
			stream: false,
			...(input.provider?.version === 1 ? {} : { parallel_tool_calls: false }),
			[capabilities.completionTokenParameter]: input.maxTokens,
			temperature: capabilities.fixedTemperature
		}),
		signal: input.signal
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		const failure = classifyProviderFailure(res.status, body.slice(0, 240));
		return { ok: false, error: { ...failure, status: res.status, retryAfterMs: retryAfterMs(res.headers.get("retry-after")), elapsedMs: Date.now() - requestStarted }, usage: errorUsage(body), requestInfo };
	}
	const payload = (await res.json()) as {
		choices?: Array<{ finish_reason?: string; message?: unknown }>;
		usage?: unknown;
		model?: string;
	};
	const response = { finishReason: payload.choices?.[0]?.finish_reason, refusal: null, status: res.status };
	const usage = readProviderUsage(payload.usage) ?? undefined;
	const answered = typeof payload.model === "string" ? payload.model : (routed?.id ?? input.modelId);
	const used = routed ? (sameOpenRouterModel(routed.id, answered) ? input.modelId : answered) : answered;
	const switched = assertNoFallback(input.modelId, used);
	if (switched) return { ok: false, error: { code: switched.code, message: switched.message }, usage, requestInfo, response };
	if (xaiRefused(payload.choices?.[0]?.message)) return { ok: false, error: { code: "provider_refusal", message: "The provider declined this request." }, usage, requestInfo, response: { ...response, refusal: "provider_refused" } };
	const message = readXaiMessage(payload.choices?.[0]?.message);
	if (!message) return { ok: false, error: { code: "malformed_response", message: "Chat completion had no supported assistant message." }, usage, requestInfo, response };
	return { ok: true, message, usage, requestInfo, response };
}

function errorUsage(body: string) {
	try {
		const payload: unknown = JSON.parse(body);
		return payload && typeof payload === "object" && "usage" in payload ? readProviderUsage(payload.usage) ?? undefined : undefined;
	} catch { return undefined; }
}

exports["providerStep"] = providerStep;

});

__def("packages/provider-xai/src/turn.ts", function (exports) {
const { DEFAULT_XAI_BASE_URL, isAgentReply, resolveScenario, runAgentLoop, turnMeta, safeErrorMessage, notSentUsage, unknownUsage } = __req("packages/chat-agent/src/index.ts");
const { emptyPage, setRenderEmptyPolicy } = __req("packages/builder-core/src/index.ts");
const { providerStep } = __req("packages/provider-xai/src/provider.ts");
const HOST_HELD_KEY = "host-held";

type TurnResult = AgentReply | AgentFailure;
type TurnLog = (event: Record<string, unknown>) => void;
function newRunId(): string {
	return `xai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logException(log: TurnLog | undefined, err: unknown, apiKey: string, modelId: string, signal: AbortSignal): void {
	const safe = safeErrorMessage(err, [apiKey]);
	if (!signal.aborted) log?.({ runtime: "xai-grok", event: "xai_run_exception", modelId, name: err instanceof Error ? err.name : typeof err, code: safe.code, message: safe.message });
}

async function runCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string = DEFAULT_XAI_BASE_URL, deadline?: number, options: CatalogTurnOptions = {}): Promise<{ result: TurnResult; meta: LiveTurnMeta }> {
	const previous = options.strictRenderWrites ? setRenderEmptyPolicy("reject") : null;
	const step: Parameters<typeof runAgentLoop>[3] = previous
		? async (input) => {
				setRenderEmptyPolicy(previous);
				try {
					return await providerStep({ ...input, apiKey, baseUrl, wire: options.wire });
				} finally {
					setRenderEmptyPolicy("reject");
				}
			}
		: (input) => providerStep({ ...input, apiKey, baseUrl, wire: options.wire });
	try {
		const compiled = resolveScenario(ctx.mode, modelId, ctx.scenario);
		if (!compiled.ok || compiled.scenario.profile.provider !== "xai") return { result: { ok: false, code: "invalid_scenario", message: "The scenario could not be resolved.", issues: (compiled.ok ? [{ path: "/provider", code: "adapter_mismatch" }] : compiled.issues).map((issue) => ({ ...issue, expected: "registered compatible scenario" })) }, meta: turnMeta("chat-completions", modelId, false, 0, [], notSentUsage(), newRunId()) };
		const turn = await runAgentLoop(modelId, ctx, signal, step, newRunId(), { scenario: compiled.scenario, deadline, cacheKey: ctx.cacheKey, onProviderError: (error) => logException(options.log, error, apiKey, modelId, signal) });
		if (!turn.result.ok && turn.result.code === "provider_failed") return { ...turn, result: { ...turn.result, code: "xai_chat_failed", message: "The xAI chat request could not be completed." } };
		return turn;
	} catch (err) {
		const safe = safeErrorMessage(err, [apiKey]);
		const aborted = safe.code === "AbortError" || safe.message.toLowerCase().includes("abort") || signal.aborted;
		// The caller only sees a generic failure; the host log must name the exception (redacted, 280 chars).
		if (!aborted) logException(options.log, err, apiKey, modelId, signal);
		return {
			result: {
				ok: false,
				code: aborted ? "aborted" : "xai_chat_failed",
				message: aborted ? "The run was cancelled. Usage is unknown, not zero." : "The xAI chat request could not be completed."
			},
			meta: turnMeta("chat-completions", modelId, false, 0, [], unknownUsage(aborted ? "cancelled" : "error", 0), newRunId())
		};
	} finally {
		if (previous) setRenderEmptyPolicy(previous);
	}
}

type MappedRequest = Extract<ReturnType<typeof mapChatRunRequest>, { ok: true }>["request"];

/** What the model turn needs from the mapped request (an empty page when none came). */
function turnInput(req: MappedRequest): TurnContext {
	return {
		brief: req.brief,
		scenario: req.scenario,
		mode: req.mode,
		conversation: req.conversation,
		page: req.currentPage ?? emptyPage({ title: "New page" }),
		shownPage: req.shownPage ?? null,
		expectedRevision: req.expectedRevision,
		scopeBlockIds: req.scopeBlockIds,
		cacheKey: req.cacheKey,
		...(req.today ? { today: req.today } : {})
	};
}

/**
 * The answer of one finished turn, the body of POST /v1/run: the result (our own run budget firing, not a client cancel,
 * becomes runtime_timeout) with what the run proved and used. `status` is the HTTP status the runtime sends.
 */
function turnAnswer(req: MappedRequest, turn: { result: TurnResult; meta: LiveTurnMeta }, budgetMs: number, clientAborted: boolean) {
	const { meta } = turn;
	const checked =
		!turn.result.ok && (turn.result.code === "aborted" || turn.result.code === "runtime_timeout") && !clientAborted
			? { ok: false as const, code: "runtime_timeout", message: `The model did not finish within ${Math.round(budgetMs / 1000)} s. Try again or pick a faster model. No other model was substituted.` }
			: turn.result;
	const live = Boolean(checked.ok && (meta.toolCallingWorked || isAgentReply(checked)));
	return {
		status: checked.ok ? 200 : 422,
		checked,
		live,
		body: {
			...checked,
			liveModel: live,
			liveXai: live,
			toolCallingProven: meta.toolCallingWorked,
			mode: req.mode,
			runtime: "xai-grok" as const,
			modelId: meta.modelId,
			requestedModelId: req.modelId,
			path: meta.path,
			runId: meta.runId,
			toolsUsed: meta.toolsCalled,
			scenario: meta.scenario,
			providerRetries: meta.providerRetries,
			runTrace: meta.runTrace,
			usage: meta.usage
		}
	};
}

exports["HOST_HELD_KEY"] = HOST_HELD_KEY;
exports["runCatalogTurn"] = runCatalogTurn;
exports["turnInput"] = turnInput;
exports["turnAnswer"] = turnAnswer;

});

__def("packages/provider-xai/src/wire.ts", function (exports) {
exports["providerStep"] = __req("packages/provider-xai/src/provider.ts")["providerStep"];
exports["OPENROUTER_FORWARD_BASE"] = __req("packages/provider-xai/src/openrouter.ts")["OPENROUTER_FORWARD_BASE"];
exports["HOST_HELD_KEY"] = __req("packages/provider-xai/src/turn.ts")["HOST_HELD_KEY"];
exports["runCatalogTurn"] = __req("packages/provider-xai/src/turn.ts")["runCatalogTurn"];
exports["turnAnswer"] = __req("packages/provider-xai/src/turn.ts")["turnAnswer"];
exports["turnInput"] = __req("packages/provider-xai/src/turn.ts")["turnInput"];



});

__def("apps/xai-runtime/src/chat-tools.ts", function (exports) {
const { DEFAULT_XAI_BASE_URL } = __req("packages/chat-agent/src/index.ts");
const { installPropsGate } = __req("packages/builder-core/src/catalog/props-gate.ts");
const { runCatalogTurn } = __req("packages/provider-xai/src/wire.ts");
exports["turnAnswer"] = __req("packages/provider-xai/src/wire.ts")["turnAnswer"];
exports["turnInput"] = __req("packages/provider-xai/src/wire.ts")["turnInput"];
installPropsGate();

const log = (event: Record<string, unknown>) => console.error(JSON.stringify(event));

function runXaiCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string = DEFAULT_XAI_BASE_URL, deadline?: number) {
	return runCatalogTurn(apiKey, modelId, ctx, signal, baseUrl, deadline, { log });
}

exports["runXaiCatalogTurn"] = runXaiCatalogTurn;

});

__def("apps/xai-runtime/src/discover.ts", function (exports) {
const { CANDIDATE_CHAT_MODEL, classifyDiscoveredModels, readEnv, readXaiKeyState, redactValue, xaiBaseUrl } = __req("packages/chat-agent/src/index.ts");
type DiscoveredModels = {
	ok: boolean;
	code: string;
	ids: string[];
	chatIds: string[];
	imageIds: string[];
	candidate: string | null;
	languageModelCount: number | null;
	imageModelCount: number | null;
	toolCallingProven: false;
};

function idsFromPayload(payload: unknown): string[] {
	if (!payload || typeof payload !== "object") return [];
	const rec = payload as Record<string, unknown>;
	const rows = Array.isArray(rec.data) ? rec.data : Array.isArray(rec.models) ? rec.models : [];
	return rows
		.map((row) => {
			if (typeof row === "string") return row;
			if (row && typeof row === "object") {
				const item = row as { id?: unknown; name?: unknown };
				return String(item.id || item.name || "");
			}
			return "";
		})
		.filter(Boolean);
}

async function getJson(baseUrl: string, path: string, apiKey: string, signal: AbortSignal): Promise<{ status: number; payload: unknown }> {
	const res = await fetch(`${baseUrl}${path}`, {
		method: "GET",
		headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
		signal
	});
	let payload: unknown;
	try {
		payload = await res.json();
	} catch {
		payload = null;
	}
	void redactValue({ authorization: "Bearer [redacted]" });
	return { status: res.status, payload };
}

async function discoverAccountModels(
	env: EnvMap = readEnv(),
	signal?: AbortSignal
): Promise<DiscoveredModels> {
	const key = readXaiKeyState(env);
	if (!key.present) {
		return {
			ok: false,
			code: "xai_api_key_missing",
			ids: [],
			chatIds: [],
			imageIds: [],
			candidate: null,
			languageModelCount: null,
			imageModelCount: null,
			toolCallingProven: false
		};
	}
	const apiKey = env.XAI_API_KEY!.trim();
	const base = xaiBaseUrl(env);
	const ac = signal ?? AbortSignal.timeout(15_000);
	try {
		const [models, language, images] = await Promise.all([
			getJson(base, "/models", apiKey, ac),
			getJson(base, "/language-models", apiKey, ac),
			getJson(base, "/image-generation-models", apiKey, ac)
		]);
		if (models.status !== 200 && language.status !== 200) {
			return {
				ok: false,
				code: "xai_models_list_failed",
				ids: [],
				chatIds: [],
				imageIds: [],
				candidate: null,
				languageModelCount: null,
				imageModelCount: null,
				toolCallingProven: false
			};
		}
		const ids = [...new Set([...idsFromPayload(models.payload), ...idsFromPayload(language.payload)])];
		const classified = classifyDiscoveredModels(ids);
		const imageFromEndpoint = idsFromPayload(images.payload);
		const imageIds = [...new Set([...classified.imageIds, ...imageFromEndpoint])];
		const chatIds = classified.chatIds.filter((id) => !imageIds.includes(id));
		return {
			ok: chatIds.length > 0,
			code: chatIds.length ? "xai_models_discovered" : "xai_no_chat_models",
			ids,
			chatIds,
			imageIds,
			candidate: chatIds.includes(CANDIDATE_CHAT_MODEL) ? CANDIDATE_CHAT_MODEL : (chatIds[0] ?? null),
			languageModelCount: language.status === 200 ? idsFromPayload(language.payload).length : null,
			imageModelCount: images.status === 200 ? imageFromEndpoint.length : null,
			toolCallingProven: false
		};
	} catch {
		return {
			ok: false,
			code: "xai_models_list_unavailable",
			ids: [],
			chatIds: [],
			imageIds: [],
			candidate: null,
			languageModelCount: null,
			imageModelCount: null,
			toolCallingProven: false
		};
	}
}

exports["discoverAccountModels"] = discoverAccountModels;

});

__def("apps/xai-runtime/src/status.ts", function (exports) {
const { CANDIDATE_CHAT_MODEL, RUNTIME_AUTH_ENV, XAI_RUNTIME_NOTES, XAI_SECRET_ENV, hasPublicSecretLeak, isSharedPublicSurface, readBasicAuthConfig, readEnv, readXaiKeyState } = __req("packages/chat-agent/src/index.ts");
const { discoverAccountModels } = __req("apps/xai-runtime/src/discover.ts");
type XaiRuntimeStatus = {
	runtime: "xai-grok";
	ready: boolean;
	/** Capability: this host can run a live Grok turn. Not a per-turn tool proof. */
	liveModel: boolean;
	code: string;
	key: { present: boolean; source: string | null };
	auth: { basicRequired: boolean; loopbackOnly: boolean };
	models: {
		listed: boolean;
		chatIds: string[];
		imageIds: string[];
		candidate: string | null;
		/** Status never claims a tool loop. Proven per /v1/run. */
		toolCallingProven: boolean;
	};
	sdk: { openaiProvider: boolean; ai: boolean };
	notes: typeof XAI_RUNTIME_NOTES;
	envNames: { xai: string[]; basicAuth: string[] };
	publicSecretLeak: string[];
};

async function sdkPresent(): Promise<{ openaiProvider: boolean; ai: boolean }> {
	const present = (load: () => Promise<unknown>) => load().then(() => true, () => false);
	return { openaiProvider: await present(() => import("@ai-sdk/openai")), ai: await present(() => import("ai")) };
}

async function runtimeStatus(env: EnvMap = readEnv()): Promise<XaiRuntimeStatus> {
	const leaks = hasPublicSecretLeak(env);
	const key = readXaiKeyState(env);
	const { configured: basicRequired } = readBasicAuthConfig(env);
	const shared = isSharedPublicSurface(env);
	const loopbackOnly = !shared;
	const sdk = await sdkPresent();

	let listed = false;
	let chatIds: string[] = [];
	let imageIds: string[] = [];
	let candidate: string | null = null;
	let discoverCode = key.present ? "xai_models_list_pending" : "xai_api_key_missing";

	if (key.present) {
		const discovered = await discoverAccountModels(env);
		listed = discovered.ok || discovered.chatIds.length > 0 || discovered.ids.length > 0;
		chatIds = discovered.chatIds;
		imageIds = discovered.imageIds;
		candidate = discovered.candidate;
		discoverCode = discovered.code;
	}

	let code: string;
	if (leaks.length) code = "public_secret_forbidden";
	else if (!key.present) code = "xai_api_key_missing";
	else if (shared && !basicRequired) code = "basic_auth_required_before_shared_bind";
	else if (!listed) code = discoverCode;
	else if (!candidate) code = "xai_no_chat_models";
	else code = "xai_runtime_ready";

	const ready = code === "xai_runtime_ready";

	return {
		runtime: "xai-grok",
		ready,
		liveModel: ready,
		code,
		key: { present: key.present, source: key.source },
		auth: { basicRequired, loopbackOnly },
		models: {
			listed,
			chatIds,
			imageIds,
			candidate: candidate ?? (key.present ? null : CANDIDATE_CHAT_MODEL),
			toolCallingProven: false
		},
		sdk,
		notes: XAI_RUNTIME_NOTES,
		envNames: { xai: XAI_SECRET_ENV, basicAuth: RUNTIME_AUTH_ENV },
		publicSecretLeak: leaks
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runtimeStatus().then((status) => {
		process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
	});
}

exports["runtimeStatus"] = runtimeStatus;

});

__def("apps/xai-runtime/src/media-asset.ts", function (exports) {

const ASSET_HOSTS = new Set(["imgen.x.ai", "files-cdn.x.ai"]);
const MAX_ASSET_BYTES = 4_000_000;
const ASSET_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const ASSET_TIMEOUT_MS = 20_000;

type AssetFailure = { status: number; code: string };

function fail(failure: AssetFailure, message: string): Response {
	return new Response(JSON.stringify({ ok: false, code: failure.code, message }), { status: failure.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

/** The address when the proxy may read it, else null. */
function assetUrl(raw: unknown): URL | null {
	if (typeof raw !== "string" || raw.length > 2048) return null;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" || url.username || url.password || url.port || !ASSET_HOSTS.has(url.hostname)) return null;
	return url;
}

async function readCapped(res: Response, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
	if (!res.body) return null;
	const reader = res.body.getReader();
	const parts: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.length;
		if (total > max) {
			await reader.cancel().catch(() => undefined);
			return null;
		}
		parts.push(value);
	}
	const out = new Uint8Array(new ArrayBuffer(total));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function logAsset(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_media", action: "asset", ...event }));
}

type Fetched = { ok: true; bytes: Uint8Array<ArrayBuffer>; type: string; host: string } | { ok: false; failure: AssetFailure; host: string };

/** Reads an allowed picture (https, xAI image host, no redirects, picture type) up to `max` bytes. */
async function fetchAllowedPicture(raw: unknown, max: number, fetchImpl: typeof fetch = fetch): Promise<Fetched> {
	const url = assetUrl(raw);
	if (!url) return { ok: false, failure: { status: 422, code: "asset_not_allowed" }, host: "" };
	let res: Response;
	try {
		res = await fetchImpl(url, { redirect: "error", headers: { accept: "image/*" }, signal: AbortSignal.timeout(ASSET_TIMEOUT_MS) });
	} catch {
		return { ok: false, failure: { status: 502, code: "asset_unreachable" }, host: url.hostname };
	}
	const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
	const length = Number(res.headers.get("content-length") ?? 0);
	const failure: AssetFailure | null = !res.ok
		? { status: res.status === 404 || res.status === 410 ? 404 : 502, code: `asset_upstream_${res.status}` }
		: !ASSET_TYPES.has(type)
			? { status: 415, code: "asset_not_image" }
			: length > max
				? { status: 413, code: "asset_too_large" }
				: null;
	if (failure) {
		await res.body?.cancel().catch(() => undefined);
		return { ok: false, failure, host: url.hostname };
	}
	const bytes = await readCapped(res, max);
	return bytes ? { ok: true, bytes, type, host: url.hostname } : { ok: false, failure: { status: 413, code: "asset_too_large" }, host: url.hostname };
}

async function handleAsset(raw: unknown, fetchImpl: typeof fetch = fetch): Promise<Response> {
	const started = Date.now();
	const got = await fetchAllowedPicture(raw, MAX_ASSET_BYTES, fetchImpl);
	if (!got.ok) {
		if (got.failure.code !== "asset_not_allowed") logAsset({ ok: false, code: got.failure.code, host: got.host, ms: Date.now() - started });
		return fail(got.failure, got.failure.code === "asset_not_allowed" ? "Only https pictures of the xAI image hosts are proxied." : "The picture could not be read.");
	}
	logAsset({ ok: true, host: got.host, bytes: got.bytes.length, ms: Date.now() - started });
	return new Response(got.bytes, { status: 200, headers: { "content-type": got.type, "content-length": String(got.bytes.length), "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

exports["ASSET_HOSTS"] = ASSET_HOSTS;
exports["MAX_ASSET_BYTES"] = MAX_ASSET_BYTES;
exports["ASSET_TYPES"] = ASSET_TYPES;
exports["fetchAllowedPicture"] = fetchAllowedPicture;
exports["handleAsset"] = handleAsset;

});

__def("apps/xai-runtime/src/media-encode.ts", function (exports) {
const { fetchAllowedPicture } = __req("apps/xai-runtime/src/media-asset.ts");
const MAX_ENCODE_BYTES = 4_000_000;
const MAX_URL_BYTES = 24_000_000;
/** The base64 answer must stay under Vercel's 4.5 MB response cap. */
const MAX_ANSWER_BYTES = 3_200_000;
const ENCODE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

type Tier = { width: number; quality: number; sharpen: number };
/** 1920 q82; 1280 q78 with a mild sharpen (sigma); 960 q72. */
const TIERS: Tier[] = [
	{ width: 960, quality: 72, sharpen: 0 },
	{ width: 1280, quality: 78, sharpen: 0.6 },
	{ width: 1920, quality: 82, sharpen: 0 }
];
/**
 * The grade before encoding. `contrast`: -0.06 is 6% less contrast around mid grey. `cool`: 0.03 lowers red and raises blue
 * by 3% (a slightly cooler white balance). Subtle on purpose: page art direction may be warm (embers, candle light).
 */
const FILTERS = { contrast: -0.06, cool: 0.03 } as const;
const FILTER_LIMITS = { contrast: [-0.2, 0.1], cool: [-0.1, 0.1] } as const;

type Filters = { contrast: number; cool: number };
type Variant = { width: number; height: number; bytes: number; quality: number; sharpen: number; type: "image/webp"; data: string };
type Sharp = typeof import("sharp").default;

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const clamp = (value: number, [min, max]: [number, number]) => Math.min(max, Math.max(min, value));

/** The grade of one request: the defaults, or a `contrast` / `cool` query value inside its limits. */
function filtersOf(url: URL): Filters {
	const read = (name: keyof Filters) => {
		const raw = url.searchParams.get(name);
		const value = raw === null ? Number.NaN : Number(raw);
		return Number.isFinite(value) ? clamp(value, FILTER_LIMITS[name]) : FILTERS[name];
	};
	return { contrast: read("contrast"), cool: read("cool") };
}

/** Output widths for an original `width` px wide: each tier capped at the original, one size per width (the smaller tier wins). */
function plan(width: number): Tier[] {
	const out = new Map<number, Tier>();
	for (const tier of TIERS) {
		const target = Math.min(tier.width, width);
		if (!out.has(target)) out.set(target, { ...tier, width: target });
	}
	return [...out.values()];
}

async function encodeOne(sharp: Sharp, input: Uint8Array, tier: Tier, filters: Filters): Promise<Variant> {
	const a = 1 + filters.contrast;
	let pipeline = sharp(input, { failOn: "error" })
		.rotate()
		.resize({ width: tier.width, withoutEnlargement: true })
		.recomb([
			[1 - filters.cool, 0, 0],
			[0, 1, 0],
			[0, 0, 1 + filters.cool]
		])
		.linear(a, 128 * (1 - a));
	if (tier.sharpen > 0) pipeline = pipeline.sharpen({ sigma: tier.sharpen });
	const { data, info } = await pipeline.webp({ quality: tier.quality, effort: 4 }).toBuffer({ resolveWithObject: true });
	return { width: info.width, height: info.height, bytes: data.length, quality: tier.quality, sharpen: tier.sharpen, type: "image/webp", data: data.toString("base64") };
}

function logEncode(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_media", action: "encode", ...event }));
}

async function readImage(request: Request): Promise<Uint8Array | null> {
	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > MAX_ENCODE_BYTES) return null;
	const bytes = new Uint8Array(await request.arrayBuffer());
	return bytes.length > 0 && bytes.length <= MAX_ENCODE_BYTES ? bytes : null;
}

type Input = { ok: true; bytes: Uint8Array; type: string } | { ok: false; response: Response };

/** The original: read from `url` (xAI image hosts only) or taken from the body. */
async function inputOf(request: Request, url: URL): Promise<Input> {
	const source = url.searchParams.get("url");
	if (source !== null) {
		const got = await fetchAllowedPicture(source, MAX_URL_BYTES);
		return got.ok ? { ok: true, bytes: got.bytes, type: got.type } : { ok: false, response: json(got.failure.status, { ok: false, code: got.failure.code, message: "The picture could not be read from that address." }) };
	}
	const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
	if (!ENCODE_TYPES.has(type)) return { ok: false, response: json(415, { ok: false, code: "encode_not_image", message: "The body must be the picture itself: jpeg, png, webp, avif or gif." }) };
	const bytes = await readImage(request);
	return bytes ? { ok: true, bytes, type } : { ok: false, response: json(413, { ok: false, code: "encode_too_large", message: "The picture is empty or larger than 4 MB." }) };
}

async function handleEncode(request: Request, loadSharp: () => Promise<Sharp> = async () => (await import("sharp")).default): Promise<Response> {
	const url = new URL(request.url);
	const got = await inputOf(request, url);
	if (!got.ok) return got.response;
	const { bytes: input, type } = got;
	const filters = filtersOf(url);
	const started = Date.now();
	try {
		const sharp = await loadSharp();
		const meta = await sharp(input, { failOn: "error" }).rotate().metadata();
		const width = meta.autoOrient?.width ?? meta.width;
		const height = meta.autoOrient?.height ?? meta.height;
		if (!width || !height) throw new Error("no size");
		const variants: Variant[] = [];
		let total = 0;
		for (const tier of plan(width)) {
			const variant = await encodeOne(sharp, input, tier, filters);
			total += variant.data.length;
			if (total > MAX_ANSWER_BYTES) break;
			variants.push(variant);
		}
		if (!variants.length) throw new Error("no variant fits the answer");
		logEncode({ ok: true, width, bytes: input.length, out: variants.map((v) => [v.width, v.bytes]), ms: Date.now() - started });
		return json(200, { ok: true, original: { width, height, bytes: input.length, type }, filters, variants });
	} catch (err) {
		const code = err instanceof Error && /unsupported|corrupt|bad|invalid|no size/i.test(err.message) ? "encode_unreadable" : "encode_failed";
		logEncode({ ok: false, code, bytes: input.length, ms: Date.now() - started });
		return json(422, { ok: false, code, message: "The picture could not be converted; keep the original." });
	}
}

exports["MAX_ENCODE_BYTES"] = MAX_ENCODE_BYTES;
exports["MAX_URL_BYTES"] = MAX_URL_BYTES;
exports["ENCODE_TYPES"] = ENCODE_TYPES;
exports["TIERS"] = TIERS;
exports["FILTERS"] = FILTERS;
exports["FILTER_LIMITS"] = FILTER_LIMITS;
exports["handleEncode"] = handleEncode;

});

__def("packages/provider-xai/src/images.ts", function (exports) {
const { IMAGE_MODELS } = __req("packages/agent-manifests/src/index.ts");
const { classifyProviderFailure } = __req("packages/provider-xai/src/errors.ts");
const XAI_IMAGE_MODEL = IMAGE_MODELS.xai;
/** Aspect ratios the generations endpoint accepts that the page blocks use. */
const IMAGE_ASPECTS = ["1:1", "4:3", "3:4", "16:9", "21:9"] as const;
const MAX_IMAGE_CANDIDATES = 3;
const MAX_IMAGE_PROMPT = 4000;

type Transport = { apiKey: string; baseUrl: string; signal?: AbortSignal };
type Failure = { ok: false; code: string; message: string; status?: number };

function isImageAspect(value: unknown): value is ImageAspect {
	return IMAGE_ASPECTS.some((aspect) => aspect === value);
}

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const field = (value: unknown, key: string): unknown => (isJson(value) ? value[key] : undefined);

const REQUEST_ID = /^[A-Za-z0-9-]{8,80}$/;
const isImageRequestId = (value: unknown): value is string => typeof value === "string" && REQUEST_ID.test(value);

async function failure(res: Response): Promise<Failure> {
	const body = await res.text().catch(() => "");
	const failed = classifyProviderFailure(res.status, body.slice(0, 240));
	return { ok: false, code: failed.code, message: failed.message, status: res.status };
}

/** Start one deferred generation of `n` candidates. Nothing is retried. */
async function submitImages(input: Transport & { prompt: string; aspect: ImageAspect; n: number }): Promise<ImageSubmit> {
	const n = Math.min(Math.max(Math.trunc(input.n), 1), MAX_IMAGE_CANDIDATES);
	const prompt = input.prompt.trim().slice(0, MAX_IMAGE_PROMPT);
	if (!prompt) return { ok: false, code: "empty_prompt", message: "The image brief is empty. No request was sent." };
	const res = await fetch(`${input.baseUrl}/images/generations`, {
		method: "POST",
		headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ model: XAI_IMAGE_MODEL, prompt, n, aspect_ratio: input.aspect, response_format: "url", deferred: true }),
		signal: input.signal
	});
	if (!res.ok) return failure(res);
	const requestId = field(await res.json().catch(() => null), "request_id");
	if (!isImageRequestId(requestId)) return { ok: false, code: "malformed_response", message: "The image request returned no request id." };
	return { ok: true, requestId };
}

function httpsUrls(data: unknown): string[] {
	if (!Array.isArray(data)) return [];
	return data.map((item) => field(item, "url")).filter((url): url is string => typeof url === "string" && url.startsWith("https://") && url.length <= 2048);
}

/** Read one deferred request: pending, done (temporary https URLs and the billed cost), or failed. */
async function pollImages(input: Transport & { requestId: string }): Promise<ImagePoll> {
	if (!isImageRequestId(input.requestId)) return { ok: false, code: "bad_request_id", message: "Unknown image request." };
	const res = await fetch(`${input.baseUrl}/images/${encodeURIComponent(input.requestId)}`, {
		headers: { Authorization: `Bearer ${input.apiKey}`, Accept: "application/json" },
		signal: input.signal
	});
	if (res.status === 202 || res.status === 404) {
		await res.body?.cancel().catch(() => undefined);
		return { ok: true, status: "pending" };
	}
	if (!res.ok) return failure(res);
	const payload: unknown = await res.json().catch(() => null);
	const status = field(payload, "status");
	if (status === "pending") return { ok: true, status: "pending" };
	const code = field(field(payload, "error"), "code");
	if (status === "failed") return { ok: false, code: typeof code === "string" ? `image_${code}` : "image_failed", message: "The image model could not draw this brief." };
	const urls = httpsUrls(field(payload, "data"));
	if (!urls.length) return { ok: false, code: "malformed_response", message: "The image request finished without pictures." };
	const ticks = field(field(payload, "usage"), "cost_in_usd_ticks");
	return { ok: true, status: "done", urls, costUsdTicks: typeof ticks === "number" && Number.isFinite(ticks) ? ticks : null };
}

exports["XAI_IMAGE_MODEL"] = XAI_IMAGE_MODEL;
exports["IMAGE_ASPECTS"] = IMAGE_ASPECTS;
exports["MAX_IMAGE_CANDIDATES"] = MAX_IMAGE_CANDIDATES;
exports["MAX_IMAGE_PROMPT"] = MAX_IMAGE_PROMPT;
exports["isImageAspect"] = isImageAspect;
exports["isImageRequestId"] = isImageRequestId;
exports["submitImages"] = submitImages;
exports["pollImages"] = pollImages;

});

__def("packages/provider-xai/src/index.ts", function (exports) {
exports["providerStep"] = __req("packages/provider-xai/src/provider.ts")["providerStep"];
exports["xaiCapabilities"] = __req("packages/provider-xai/src/capabilities.ts")["xaiCapabilities"];
exports["IMAGE_ASPECTS"] = __req("packages/provider-xai/src/images.ts")["IMAGE_ASPECTS"];
exports["MAX_IMAGE_CANDIDATES"] = __req("packages/provider-xai/src/images.ts")["MAX_IMAGE_CANDIDATES"];
exports["MAX_IMAGE_PROMPT"] = __req("packages/provider-xai/src/images.ts")["MAX_IMAGE_PROMPT"];
exports["XAI_IMAGE_MODEL"] = __req("packages/provider-xai/src/images.ts")["XAI_IMAGE_MODEL"];
exports["isImageAspect"] = __req("packages/provider-xai/src/images.ts")["isImageAspect"];
exports["isImageRequestId"] = __req("packages/provider-xai/src/images.ts")["isImageRequestId"];
exports["pollImages"] = __req("packages/provider-xai/src/images.ts")["pollImages"];
exports["submitImages"] = __req("packages/provider-xai/src/images.ts")["submitImages"];
exports["HOST_HELD_KEY"] = __req("packages/provider-xai/src/turn.ts")["HOST_HELD_KEY"];
exports["runCatalogTurn"] = __req("packages/provider-xai/src/turn.ts")["runCatalogTurn"];
exports["turnAnswer"] = __req("packages/provider-xai/src/turn.ts")["turnAnswer"];
exports["turnInput"] = __req("packages/provider-xai/src/turn.ts")["turnInput"];



});

__def("apps/xai-runtime/src/media.ts", function (exports) {
const { isProviderId, readXaiKeyState, safeErrorMessage, secretValues, xaiBaseUrl } = __req("packages/chat-agent/src/index.ts");
const { handleAsset } = __req("apps/xai-runtime/src/media-asset.ts");
const { handleEncode } = __req("apps/xai-runtime/src/media-encode.ts");
const { MAX_IMAGE_PROMPT, XAI_IMAGE_MODEL, isImageAspect, pollImages, submitImages } = __req("packages/provider-xai/src/index.ts");
const MAX_BODY = 16_000;
const POLL_MS = 20_000;

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const isBody = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
	const raw = await request.text();
	if (raw.length > MAX_BODY) return null;
	try {
		const body: unknown = JSON.parse(raw || "{}");
		return isBody(body) ? body : null;
	} catch {
		return null;
	}
}

/** One sanitized log line: action, outcome, timing and cost; never the prompt, URLs or headers. */
function logMedia(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_media", ...event }));
}

async function handleMedia(request: Request, env: EnvMap): Promise<Response> {
	if (new URL(request.url).searchParams.get("action") === "encode") return handleEncode(request);
	const body = await readBody(request);
	if (!body) return json(400, { ok: false, code: "invalid_body", message: "Send one JSON object." });
	if (body.action === "asset") return handleAsset(body.url);
	// Provider per role (ADR 0068): a web host draws with xAI only. `provider` absent or "xai" draws here; OpenRouter
	// pictures are refused before any provider call (the desktop refuses them too while they are switched off), and
	// `model`, when sent, must be the xAI image model: never a chat model, never another provider's.
	if (body.action === "generate" && body.provider !== undefined && body.provider !== "xai") {
		if (isProviderId(body.provider))
			return json(409, { ok: false, code: "provider_role_disabled", message: "This host does not draw pictures with that provider. No provider call was made." });
		return json(422, { ok: false, code: "invalid_request", message: "provider is xai or openrouter." });
	}
	if (body.action === "generate" && body.model !== undefined && body.model !== XAI_IMAGE_MODEL)
		return json(422, { ok: false, code: "model_not_allowed", message: "That model does not draw pictures on this host. No provider call was made." });
	if (!readXaiKeyState(env).present) return json(503, { ok: false, code: "xai_api_key_missing", message: "XAI_API_KEY is not provisioned here. No provider call was made." });
	const transport = { apiKey: env.XAI_API_KEY!.trim(), baseUrl: xaiBaseUrl(env), signal: AbortSignal.timeout(POLL_MS) };
	const started = Date.now();
	try {
		if (body.action === "generate") {
			const prompt = typeof body.prompt === "string" ? body.prompt : "";
			if (!prompt.trim() || prompt.length > MAX_IMAGE_PROMPT || !isImageAspect(body.aspect)) return json(422, { ok: false, code: "invalid_request", message: "A prompt (up to 4000 characters) and a supported aspect are required." });
			const n = typeof body.n === "number" ? body.n : 3;
			const out = await submitImages({ ...transport, prompt, aspect: body.aspect, n });
			logMedia({ action: "generate", ok: out.ok, code: out.ok ? "ok" : out.code, aspect: body.aspect, n, ms: Date.now() - started });
			return json(out.ok ? 202 : 502, { ...out, model: XAI_IMAGE_MODEL });
		}
		if (body.action === "result") {
			const out = await pollImages({ ...transport, requestId: typeof body.requestId === "string" ? body.requestId : "" });
			if (!out.ok || out.status === "done") logMedia({ action: "result", ok: out.ok, code: out.ok ? "done" : out.code, images: out.ok ? out.urls.length : 0, costUsdTicks: out.ok ? out.costUsdTicks : null });
			return json(out.ok ? 200 : 502, { ...out, model: XAI_IMAGE_MODEL });
		}
		return json(422, { ok: false, code: "unknown_action", message: "action is generate, result or asset." });
	} catch (err) {
		const safe = safeErrorMessage(err, secretValues(env));
		return json(502, { ok: false, code: safe.code || "media_failed", message: "The image request could not be completed. No automatic retry was sent." });
	}
}

exports["handleMedia"] = handleMedia;

});

__def("apps/xai-runtime/src/design.ts", function (exports) {
const { readXaiKeyState, resolveChatModelRequest, safeErrorMessage, secretValues, xaiBaseUrl } = __req("packages/chat-agent/src/index.ts");
const { xaiCapabilities } = __req("packages/provider-xai/src/index.ts");
const { runtimeStatus } = __req("apps/xai-runtime/src/status.ts");
const MAX_BODY = 128_000;
const MAX_MESSAGES = 40;
const MAX_CONTENT = 16_000;
const MAX_TOKENS = 8192;
const TIMEOUT_MS = 60_000;

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const isBody = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

type ChatRole = "system" | "user" | "assistant";

function readMessages(value: unknown): Array<{ role: ChatRole; content: string }> | null {
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;
	const out: Array<{ role: ChatRole; content: string }> = [];
	for (const row of value) {
		if (!isBody(row)) return null;
		const role = row.role;
		const content = typeof row.content === "string" ? row.content : typeof row.text === "string" ? row.text : null;
		if ((role !== "system" && role !== "user" && role !== "assistant") || content === null || content.length > MAX_CONTENT) return null;
		out.push({ role, content });
	}
	return out;
}

function assistantText(payload: unknown): string | null {
	if (!isBody(payload) || !Array.isArray(payload.choices)) return null;
	const choice = payload.choices[0];
	if (!isBody(choice)) return null;
	const message = choice.message;
	if (!isBody(message)) return null;
	if (typeof message.content === "string") return message.content;
	if (Array.isArray(message.content)) {
		const parts = message.content.flatMap((part) => (isBody(part) && typeof part.text === "string" ? [part.text] : []));
		return parts.length ? parts.join("") : null;
	}
	return null;
}

function logDesign(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_design", ...event }));
}

async function handleDesign(request: Request, env: EnvMap): Promise<Response> {
	const raw = await request.text();
	if (raw.length > MAX_BODY) return json(413, { ok: false, code: "too_large", message: "payload too large" });
	let body: unknown;
	try {
		body = JSON.parse(raw || "{}");
	} catch {
		return json(400, { ok: false, code: "invalid_json", message: "invalid json" });
	}
	if (!isBody(body)) return json(400, { ok: false, code: "invalid_body", message: "Send one JSON object." });
	const messages = readMessages(body.messages);
	if (!messages) return json(422, { ok: false, code: "invalid_request", message: "messages is a non-empty list of role and content." });
	const requestedId = typeof body.modelId === "string" ? body.modelId : "";
	if (!requestedId.trim()) return json(422, { ok: false, code: "missing_model_id", message: "Select a Grok chat model before sending." });
	if (!readXaiKeyState(env).present) return json(503, { ok: false, code: "xai_api_key_missing", message: "XAI_API_KEY is not provisioned here. No provider call was made." });
	const status = await runtimeStatus(env);
	const resolved = resolveChatModelRequest({
		requestedId,
		discoveredChatIds: status.models.listed ? status.models.chatIds : undefined,
		allowUnlistedTrial: !status.ready
	});
	if (!resolved.ok) return json(422, { ok: false, code: resolved.code, message: resolved.message });
	if (!status.ready) return json(503, { ok: false, code: status.code, message: "xAI runtime is not ready. No provider call was made." });
	const capabilities = xaiCapabilities(resolved.modelId);
	if (!capabilities) return json(422, { ok: false, code: "unknown_chat_model", message: "That model is not enabled for Design on this host. No provider call was made." });
	const started = Date.now();
	try {
		const res = await fetch(`${xaiBaseUrl(env)}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.XAI_API_KEY!.trim()}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({
				model: resolved.modelId,
				messages,
				stream: false,
				[capabilities.completionTokenParameter]: MAX_TOKENS,
				temperature: capabilities.fixedTemperature
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) {
			logDesign({ ok: false, code: "provider_error", status: res.status, modelId: resolved.modelId, ms: Date.now() - started });
			return json(502, { ok: false, code: "provider_error", message: "The design request could not be completed. No automatic retry was sent." });
		}
		const payload: unknown = await res.json();
		const text = assistantText(payload);
		if (text === null) {
			logDesign({ ok: false, code: "malformed_response", modelId: resolved.modelId, ms: Date.now() - started });
			return json(502, { ok: false, code: "malformed_response", message: "The provider answer had no assistant text." });
		}
		logDesign({ ok: true, code: "ok", modelId: resolved.modelId, ms: Date.now() - started });
		return json(200, { ok: true, text });
	} catch (err) {
		const safe = safeErrorMessage(err, secretValues(env));
		logDesign({ ok: false, code: safe.code || "design_failed", modelId: resolved.modelId, ms: Date.now() - started });
		return json(502, { ok: false, code: safe.code || "design_failed", message: "The design request could not be completed. No automatic retry was sent." });
	}
}

exports["handleDesign"] = handleDesign;

});

__def("apps/xai-runtime/src/http.ts", function (exports) {
const { installRenderProbe, probeFromModule } = __req("packages/builder-core/src/index.ts");
const { clampRunBudgetMs, contractFingerprint, gateRequest, isSharedPublicSurface, mapChatRunRequest, readEnv, readXaiKeyState, safeErrorMessage, xaiBaseUrl, secretValues, stripRuntimePrefix } = __req("packages/chat-agent/src/index.ts");
const { runXaiCatalogTurn, turnAnswer, turnInput } = __req("apps/xai-runtime/src/chat-tools.ts");
const { runtimeStatus } = __req("apps/xai-runtime/src/status.ts");
const { handleMedia } = __req("apps/xai-runtime/src/media.ts");
const { handleDesign } = __req("apps/xai-runtime/src/design.ts");
exports["VERCEL_HOBBY_SAFE_MAX_DURATION_SEC"] = __req("packages/chat-agent/src/index.ts")["VERCEL_HOBBY_SAFE_MAX_DURATION_SEC"];
const MAX_BODY = 256_000;

let probeReady: Promise<void> | null = null;

/**
 * Install the render probe (ADR 0035) from the compiled registry blocks. The entry sets `globalThis.__buildyRenderLoader`
 * (the Vercel bundle: ../_render/blocks.mjs; server.ts: the same file in the repo). Without the module every write fails with
 * `render_probe_unavailable`: a page is never accepted on a check that did not run.
 */
function ensureRenderProbe(): Promise<void> {
	probeReady ??= (async () => {
		try {
			const loader = (globalThis as { __buildyRenderLoader?: () => Promise<RenderModule> }).__buildyRenderLoader;
			if (!loader) throw new Error("no render loader");
			const mod = await loader();
			installRenderProbe(probeFromModule(mod), { required: true });
		} catch (err) {
			console.error(JSON.stringify({ runtime: "xai-grok", event: "render_probe_unavailable", ...safeErrorMessage(err) }));
			installRenderProbe(null, { required: true });
		}
	})();
	return probeReady;
}

function toolCounts(names: string[]): Array<{ name: string; count: number }> {
	const map = new Map<string, number>();
	for (const name of names) map.set(name, (map.get(name) ?? 0) + 1);
	return [...map.entries()].map(([name, count]) => ({ name, count }));
}

/** One JSON line. No brief, page, headers, secrets, or raw provider payloads. */
function logSanitizedRun(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", ...event }));
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store"
		}
	});
}

function combinedAbort(request: Request, ms: number): AbortSignal {
	const timeout = AbortSignal.timeout(ms);
	if (typeof AbortSignal.any === "function") {
		return AbortSignal.any([request.signal, timeout]);
	}
	return timeout;
}

type RunMeta = Awaited<ReturnType<typeof runXaiCatalogTurn>>["meta"];
type RunSurface = { surface: "vercel" | "node" };

/** The sanitized log line of one finished run: counts and codes only. */
function logRun(surface: RunSurface["surface"], mode: unknown, checked: { ok: boolean; code?: string; proposal?: unknown }, meta: RunMeta, live: boolean): void {
	logSanitizedRun({
		event: "xai_run",
		surface,
		runId: meta.runId,
		ok: checked.ok,
		code: checked.ok ? "ok" : checked.code,
		mode,
		reply: checked.ok ? (checked.proposal ? "proposal" : "text") : "error",
		path: meta.path,
		modelId: meta.modelId,
		liveModel: live,
		liveXai: live,
		toolCallingProven: meta.toolCallingWorked,
		steps: meta.steps,
		...(meta.providerStatus ? { providerStatus: meta.providerStatus, providerMs: meta.providerMs ?? null } : {}),
		tools: toolCounts(meta.toolsCalled),
		usage: {
			reportedBy: meta.usage.reportedBy,
			aggregation: meta.usage.aggregation ?? null,
			status: meta.usage.status,
			steps: meta.usage.steps,
			promptTokens: meta.usage.promptTokens,
			completionTokens: meta.usage.completionTokens,
			totalTokens: meta.usage.totalTokens,
			cachedTokens: meta.usage.cachedTokens ?? null,
			lastPromptTokens: meta.usage.lastStep?.promptTokens ?? null,
			lastCompletionTokens: meta.usage.lastStep?.completionTokens ?? null
		}
	});
}

/** The JSON body of a request, or the refusal that answers it (too large, not JSON). */
async function readRunBody(request: Request): Promise<{ body: Record<string, unknown> } | { refusal: Response }> {
	const raw = await request.text();
	if (raw.length > MAX_BODY) return { refusal: jsonResponse(413, { error: { code: "too_large", message: "payload too large" }, liveModel: false }) };
	if (!raw.trim()) return { body: {} };
	try {
		return { body: JSON.parse(raw) as Record<string, unknown> };
	} catch {
		return { refusal: jsonResponse(400, { error: { code: "invalid_json", message: "invalid json" }, liveModel: false }) };
	}
}

/** A run that the runtime cannot start (no key, not ready), as the response that says so; no provider call was made. */
function notReadyResponse(env: EnvMap, status: Awaited<ReturnType<typeof runtimeStatus>>, modelId: string): Response | null {
	if (!readXaiKeyState(env).present) {
		return jsonResponse(503, {
			error: { code: "xai_api_key_missing", message: "XAI_API_KEY is not provisioned here. No provider call was made." },
			liveModel: false,
			modelId
		});
	}
	if (status.ready) return null;
	return jsonResponse(503, {
		error: { code: status.code, message: "xAI runtime is not ready. This is not a live Grok reply. No provider call was made." },
		modelId,
		status,
		liveModel: false
	});
}

async function handleRun(request: Request, env: EnvMap, opts: RunSurface): Promise<Response> {
	const status = await runtimeStatus(env);
	const read = await readRunBody(request);
	if ("refusal" in read) return read.refusal;
	const { body } = read;
	// Version skew: a tab built from another deploy validates with another contract and would
	// reject proposals it cannot render. Refuse before spending a model call.
	if (body.contract !== contractFingerprint()) {
		const modelId = typeof body.modelId === "string" ? body.modelId : "";
		return jsonResponse(409, {
			ok: false,
			code: "client_outdated",
			message: "This tab runs an older version of the app. Reload the page to continue.",
			modelId,
			requestedModelId: modelId,
			liveModel: false
		});
	}
	const mapped = mapChatRunRequest(body, {
		discoveredChatIds: status.models.listed ? status.models.chatIds : undefined,
		allowUnlistedTrial: !status.ready
	});
	if (!mapped.ok) {
		return jsonResponse(422, { ok: false, code: mapped.code, message: mapped.message, requestedId: mapped.requestedId, liveModel: false });
	}
	const notReady = notReadyResponse(env, status, mapped.request.modelId);
	if (notReady) return notReady;
	await ensureRenderProbe();
	const ms = clampRunBudgetMs(body.abortMs, env);
	const deadline = Date.now() + ms;
	const signal = combinedAbort(request, ms);
	try {
		const turn = await runXaiCatalogTurn(env.XAI_API_KEY!.trim(), mapped.request.modelId, turnInput(mapped.request), signal, xaiBaseUrl(env), deadline);
		// Our own run budget fired (not a client cancel): a clean timeout code, never platform text.
		const answer = turnAnswer(mapped.request, turn, ms, request.signal.aborted);
		logRun(opts.surface, mapped.request.mode, answer.checked, turn.meta, answer.live);
		return jsonResponse(answer.status, answer.body);
	} catch (err) {
		const safe = safeErrorMessage(err, secretValues(env));
		const aborted = signal.aborted || safe.code === "AbortError" || safe.message.toLowerCase().includes("abort");
		return jsonResponse(aborted ? 499 : 500, {
			ok: false,
			code: aborted ? "aborted" : safe.code,
			message: aborted ? "The run was cancelled. Usage is unknown, not zero." : "The xAI chat request could not be completed. No automatic retry was sent.",
			liveModel: false
		});
	}
}

async function handleRuntimeFetch(request: Request, env: EnvMap = readEnv(), opts: RunSurface = { surface: "node" }): Promise<Response> {
	const allowLoopback = opts.surface === "node" && !isSharedPublicSurface(env);
	const blocked = gateRequest(request, env, { allowLoopbackUnauthenticated: allowLoopback });
	if (blocked) return blocked;

	const path = stripRuntimePrefix(new URL(request.url).pathname);
	const method = (request.method || "GET").toUpperCase();

	if (method === "OPTIONS") {
		return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
	}

	try {
		if (method === "GET" && (path === "/healthz" || path === "/health")) {
			return jsonResponse(200, { ok: true, runtime: "xai-grok" });
		}
		if (method === "GET" && (path === "/v1/status" || path === "/v1/runtime")) {
			const status = await runtimeStatus(env);
			return jsonResponse(status.key.present ? 200 : 503, { ...status, contract: contractFingerprint() });
		}
		if (method === "POST" && path === "/v1/run") return await handleRun(request, env, opts);
		if (method === "POST" && (path === "/v1/media" || path.startsWith("/v1/media/"))) return await handleMedia(request, env);
		if (method === "POST" && path === "/v1/design") return await handleDesign(request, env);
		return jsonResponse(404, { error: { code: "not_found", message: "Unknown runtime path." } });
	} catch (err) {
		const safe = safeErrorMessage(err, secretValues(env));
		return jsonResponse(500, { error: safe, liveModel: false });
	}
}

exports["handleRuntimeFetch"] = handleRuntimeFetch;

});

__def("apps/xai-runtime/src/vercel-fetch.ts", function (exports) {
const { runtimeEnv } = __req("apps/xai-runtime/src/config.ts");
const { handleRuntimeFetch } = __req("apps/xai-runtime/src/http.ts");
const config = {
	maxDuration: 300
};

const __default = {
	async fetch(request: Request): Promise<Response> {
		return handleRuntimeFetch(request, runtimeEnv(), { surface: "vercel" });
	}
};

exports["config"] = config;
exports.default = __default;

});

const __entry = __req("apps/xai-runtime/src/vercel-fetch.ts");
export const config = __entry.config;
export default __entry.default;
