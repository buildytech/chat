import type { CatalogSnapshot } from "./types";

/** Ambient type so svelte-check does not infer a 5k-line JSON literal. */
declare const snapshot: CatalogSnapshot;
export default snapshot;
