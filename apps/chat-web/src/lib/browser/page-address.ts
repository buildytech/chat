/** Page DTO slugs are a single segment; host routes are reserved. */
export function pageSlug(address: string): string | null {
	const slug = address.trim().replace(/^\//, "");
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 48) return null;
	if (["build", "preview", "runtime", "api"].includes(slug)) return null;
	return slug;
}
