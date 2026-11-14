/**
 * Build-time switches of the optional builder modules (ADR 0041), 12-factor: one env var per module, read by
 * `vite.config.ts` and turned into a constant the bundler folds, so a module that is off is not in the bundle.
 * `VITE_MODULE_CHAT`: on unless set to 0, false, off or no (any case). Default on.
 */
const OFF = new Set(["0", "false", "off", "no"]);

export function moduleEnabled(value: string | undefined): boolean {
	return !OFF.has((value ?? "").trim().toLowerCase());
}
