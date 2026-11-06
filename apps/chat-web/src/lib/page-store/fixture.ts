import { parseDraftPage, type Page } from "@buildytech/page-contract";
import raw from "@buildytech/page-contract/fixtures/north-harbor-kitchen.json";

/**
 * Single mock Page DTO for Creator Workspace.
 * Ordinary restaurant landing: unique slug, nested ordered sections, no UTM/multilanding.
 * Parsed at module load so the in-memory Store never holds an unvalidated object.
 */
export const mockLandingPage: Page = parseDraftPage(raw);
