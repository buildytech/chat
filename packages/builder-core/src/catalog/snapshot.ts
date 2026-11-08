import raw from "./snapshot.json" with { type: "json" };
import { parseCatalogSnapshot } from "./parse-snapshot.ts";

export { parseCatalogSnapshot } from "./parse-snapshot.ts";

export const catalogSnapshot = parseCatalogSnapshot(raw);

export function catalogProvenance(): Pick<
	typeof catalogSnapshot,
	| "provider"
	| "repo"
	| "pinnedCommit"
	| "sourceArtifact"
	| "sourceDigest"
	| "sourceVersion"
	| "schemaVersion"
	| "counts"
> {
	return {
		provider: catalogSnapshot.provider,
		repo: catalogSnapshot.repo,
		pinnedCommit: catalogSnapshot.pinnedCommit,
		sourceArtifact: catalogSnapshot.sourceArtifact,
		sourceDigest: catalogSnapshot.sourceDigest,
		sourceVersion: catalogSnapshot.sourceVersion,
		schemaVersion: catalogSnapshot.schemaVersion,
		counts: catalogSnapshot.counts
	};
}
