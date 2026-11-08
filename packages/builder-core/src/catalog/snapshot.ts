import raw from "./snapshot.json" with { type: "json" };
import type { CatalogSnapshot } from "./types.ts";

export const catalogSnapshot: CatalogSnapshot = raw;

export function catalogProvenance(): Pick<
	CatalogSnapshot,
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
