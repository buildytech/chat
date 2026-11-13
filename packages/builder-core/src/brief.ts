import { SCENARIO_IDS, type ScenarioId } from "./copy.ts";

export function isScenarioId(value: unknown): value is ScenarioId {
	return typeof value === "string" && (SCENARIO_IDS as readonly string[]).includes(value);
}
