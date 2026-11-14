// Lint gate (plan item 6, audit D-01). Flat config. `npm run lint` is part of `npm run check`.
//  - no-explicit-any, import cycles, package and module boundaries (layering below), the Svelte plugin,
//  - size: max-lines warns at 300 and max-lines-per-function at 80; `lint:ratchet` keeps the warnings from growing.
// Layering (a layer imports only layers on its left): page-contract <- ports, builder-core <- chat-agent <- apps; the core of
// chat-web imports no module (ADR 0041); modules import the core, never each other.
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

const SRC = ["apps/chat-web/src/**/*.{ts,svelte}", "apps/chat-web/*.ts", "packages/*/src/**/*.ts", "apps/xai-runtime/src/**/*.ts"];
const restrict = (patterns, message) => ({ "no-restricted-imports": ["error", { patterns: patterns.map((group) => ({ group: [group], message })) }] });
const layer = (files, forbidden, message) => ({ files, rules: restrict(forbidden, message) });

export default tseslint.config(
	{ ignores: ["**/build/**", "**/build-nochat/**", "**/.svelte-kit/**", "**/node_modules/**", "registry/**", "catalog/**", "api/**", "tmp/**", "deploy/**", "services/**", "design/**", "packages/page-contract/fixtures/**", "apps/chat-web/static/**", "**/*.config.js", "**/*.d.ts", "middleware.js"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs["flat/recommended"],
	{
		files: SRC,
		languageOptions: { globals: { ...globals.browser, ...globals.node, __MODULE_CHAT__: "readonly" }, parserOptions: { parser: tseslint.parser, extraFileExtensions: [".svelte"] } },
		plugins: { "import-x": importX },
		settings: { "import-x/resolver-next": [createTypeScriptImportResolver({ project: ["apps/chat-web/tsconfig.json", "tsconfig.json"], alwaysTryTypes: true, noWarnOnMultipleProjects: true })], "import-x/extensions": [".ts", ".svelte", ".js"], "import-x/parsers": { "@typescript-eslint/parser": [".ts"], "svelte-eslint-parser": [".svelte"] } },
		rules: {
			"@typescript-eslint/no-explicit-any": "error",
			// Plain Sets and Maps in the stores are deliberately non-reactive (bookkeeping), reactive state is `$state`.
			"svelte/prefer-svelte-reactivity": "off",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
			"import-x/no-cycle": ["error", { maxDepth: 12, ignoreExternal: true }],
			"max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
			"max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
			"no-restricted-syntax": ["error", { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "No `as any`." }]
		}
	},
	{ files: ["**/*.svelte"], languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: [".svelte"] } } },
	{ files: ["**/*.svelte.ts"], languageOptions: { parser: tseslint.parser } },
	// Boundaries.
	layer(["packages/page-contract/src/**"], ["@buildytech/*", "**/apps/**"], "page-contract is the bottom layer: it imports no other package."),
	layer(["packages/ports/src/**"], ["@buildytech/builder-core", "@buildytech/chat-agent", "**/apps/**"], "ports imports page-contract only."),
	layer(["packages/builder-core/src/**"], ["@buildytech/chat-agent", "@buildytech/ports", "**/apps/**"], "builder-core is the page core: it knows no chat and no app."),
	layer(["packages/chat-agent/src/**"], ["@buildytech/ports", "**/apps/**"], "chat-agent imports builder-core and page-contract only."),
	layer(["apps/chat-web/src/**"], ["@buildytech/ports"], "chat-web does not import ports."),
	{
		files: ["apps/chat-web/src/**/*.{ts,svelte}"],
		ignores: ["apps/chat-web/src/modules/**", "apps/chat-web/src/hooks.client.ts"],
		rules: restrict(["@buildytech/chat-agent", "$modules", "$modules/**"], "The core imports no module and not the chat-agent package (ADR 0041); register through lib/modules.")
	},
	// Resolved-path zones: the core (everything but src/modules and the hook that loads them) never reaches src/modules, and a module never another module.
	{
		files: ["apps/chat-web/src/**/*.{ts,svelte}"],
		plugins: { "import-x": importX },
		rules: {
			"import-x/no-restricted-paths": ["error", { basePath: process.cwd(), zones: [
				{ target: "./apps/chat-web/src/!(modules|hooks.client.ts)/**", from: "./apps/chat-web/src/modules", message: "The core imports no module (ADR 0041)." },
				{ target: "./apps/chat-web/src/modules/chat", from: "./apps/chat-web/src/modules/!(chat)", message: "A module imports the core, never another module." }
			] }]
		}
	},
	// The validator strips control characters from untrusted text on purpose.
	{ files: ["packages/page-contract/src/validate.ts"], rules: { "no-control-regex": "off" } },
	// Tests and scripts: size limits do not apply.
	{ files: ["**/*.test.ts", "scripts/**"], rules: { "max-lines": "off", "max-lines-per-function": "off" } }
);
