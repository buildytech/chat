import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import path from 'node:path';

/** Standalone Creator embed for WordPress — no SvelteKit client router. */
export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			$ui: path.resolve('./src/ui'),
			$utils: path.resolve('./src/utils')
		}
	},
	build: {
		outDir: 'build-wp',
		emptyOutDir: true,
		sourcemap: true,
		lib: {
			entry: path.resolve('./src/embed/wp-main.ts'),
			formats: ['es'],
			fileName: () => 'wp-embed.js'
		},
		rollupOptions: {
			output: {
				assetFileNames: 'wp-embed.[ext]'
			}
		},
		target: 'es2022',
		cssCodeSplit: false
	}
});
