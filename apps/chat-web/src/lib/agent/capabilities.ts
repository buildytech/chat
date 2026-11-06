/**
 * Capability flags the UI may branch on. Never `if (runtime === …)` (ADR-0004).
 * Gateway / AdapterRegistry / cursor-sdk are not implemented in this pass.
 */
export type AgentCapabilities = {
	streaming: boolean;
	abort: boolean;
};

/** Mock ChatCore path: no SSE, no remote abort. */
export const mockCapabilities: AgentCapabilities = {
	streaming: false,
	abort: false
};
