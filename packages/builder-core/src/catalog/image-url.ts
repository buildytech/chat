/**
 * Picture addresses (ADR 0049). A block picture is an optional text prop named `image` or `imageDark` (a section, with `imageAlt`)
 * or `avatar` (a team member). Empty or absent shows the registry placeholder. A value is kept only when it is an https URL or a relative path
 * (no scheme, no spaces); anything else (http:, data:, javascript:, free text) is dropped from the write with a note, the way an
 * unknown icon is, so a page never carries an address the runtime would have to refuse.
 */

/** The address props of the media places of the block contracts (hero-simple `image`/`imageDark`, team-simple `members[].avatar`). */
const IMAGE_NAMES: ReadonlySet<string> = new Set(["image", "imageDark", "avatar"]);

/** A prop of this name, of kind text, is a picture address. */
export const isImageName = (name: string): boolean => IMAGE_NAMES.has(name);

const MAX_LENGTH = 2048;

/** An https URL with a host, or a relative path (`/photos/a.jpg`, `./a.jpg`, `../a.jpg`, `photos/a.jpg`). Empty is "no picture" and is fine. */
export function isImageUrl(value: string): boolean {
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
	return true;
}
