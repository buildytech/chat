import type { ParamMatcher } from '@sveltejs/kit';

/**
 * `/build`: the alias of the app page for Open in BuildY links (`/build?collection=...`), which the chat module opens.
 * With the chat off the alias does not exist (the address is just a page address, like any other).
 */
export const match: ParamMatcher = (param) => __MODULE_CHAT__ && param === 'build';
