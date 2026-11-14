import type { ClientInit } from '@sveltejs/kit';
import { loadModules } from './modules';

// Before the first navigation: the optional modules register their messages, project keys and panels first.
export const init: ClientInit = async () => {
	await loadModules();
};
