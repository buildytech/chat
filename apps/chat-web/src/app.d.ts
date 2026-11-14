declare global {
	/** Build-time module flags (vite.config.ts define, ADR 0041): false folds the module and its dynamic import out of the bundle. */
	const __MODULE_CHAT__: boolean;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module "@buildytech/page-contract/fixtures/north-harbor-kitchen.json" {
	const value: unknown;
	export default value;
}

export {};
