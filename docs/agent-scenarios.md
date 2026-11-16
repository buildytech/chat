# Agent configuration

- Public providers/models: packages/agent-manifests/src; data only, no credentials or transports.
- Executable adapters: packages/provider-xai/src; server only.
- Registered scenarios: packages/chat-agent/src/scenarios/builtins.v1.json; schema and compiler in the same folder.
- Prompt implementations: packages/chat-agent/src/agent/prompts.ts. Profiles refer to versioned fragments; prompt text is not copied into profiles.
- Tool definitions: packages/chat-agent/src/agent/agent-tools.v1.json. Profiles reference its version and may narrow tools only when compatible with the prompt/mode.
- Hard limits: packages/chat-agent/src/agent/budget.ts. Profile limits may lower these ceilings.

Use compileScenario to validate/inspect a draft locally. Only resolveScenario can select a registered scenario for live execution. Compilation alone never makes a draft runnable. The current runtime binds xAI credentials outside the profile and rejects a profile for another adapter.

A run may include `scenario: { id: "page.ask", version: 1 }` alongside mode/modelId. A missing reference uses that mode's registered default; a mismatched mode or unknown version fails. A profile body is rejected. The response's scenario reference/fingerprint identifies the actual compiled configuration; no key, endpoint or author context is included.

To change shipped behavior, append a new profile version, update the explicit default if activating it, and add replay/validation tests. Bump prompt/context/nudge/execution reference versions when their implementation changes. Update the manifest version when its policy changes; model account availability still comes from discovery. Never silently activate a newly discovered model.

Browser viewing and editing are not implemented yet. That UI must consume the same compiler and registry. It must keep drafts, validation, replay, approval and activation distinct; ordinary run requests must continue to accept references only.

Provider references include providerVersion; unknown manifest versions fail. Model binding is explicit: author-selected, or a fixed id that must match the requested model (never silently substituted). Registry format version and immutable scenario content version are distinct. Defaults live in the registry JSON. When retiring an implementation, explicitly retire affected live versions and retain their historical definitions outside the active registry.

The pinned provider id/version is passed through the neutral request to the server adapter. An unknown version or adapter mismatch is refused before HTTP; no latest-version fallback is used for a pinned request. The response includes providerVersion with the scenario identity.
