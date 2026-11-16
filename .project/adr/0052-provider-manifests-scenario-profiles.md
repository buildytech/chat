# ADR 0052: Public provider manifests and registered scenario versions

Accepted, 2026-11-16. Continues ADR 0051 and the agent-system plan.

agent-manifests is a data-only package without dependencies. It owns the existing xAI model catalog, default model and adapter policy. chat-agent and provider-xai both depend on it; neither needs a reverse dependency on the other for provider metadata. Account discovery remains separate. Existing Grok exports are compatibility aliases, not a second catalog. The builder core cannot import optional agent configuration.

Scenario profiles are JSON documents validated with an internal JSON Schema and program checks. A profile identifies an immutable id/version, mode, provider, versioned prompt/context/nudge/tool-set/execution references, and optional lower budgets. No credential, endpoint, executable code or inline prompt is accepted. Compile checks resolve references, model policy, tools, handler allowlist, required write capability and server ceilings. Ask and Build retain their existing proposal behavior.

The live runtime resolves only registered profiles; requests may supply an id/version reference. Missing references select the explicit mode's default version, never a mode inferred from prose. Unknown versions, mode mismatches and adapter mismatches fail before a completion request. Draft compilation does not register or activate a profile. A compiled snapshot is frozen for the turn and controls its prompts, tools and budgets.

Configuration identity hashes canonical profile data, bound model, provider manifest, resolved system prompt, tools and effective budgets. It is a diagnostic identity, not authorization or a security signature. Context/nudge/execution implementation changes require new referenced policy versions; versions are not guessed from function serialization. The run response carries the profile reference and fingerprint without changing the portable-session schema or adding telemetry.

Shipped versions are not edited in place: append a new version and explicitly change the mode default when activating it. Preserve old references while supported; refusal is preferable to silently substituting a new version. Budget defaults remain hard server ceilings. Runtime protection, credentials and deadlines remain host responsibilities.

The browser execution map/editor is a separate UI delivery. It must read this registry/compiler and the observed run reference, rather than maintain a parallel map. This delivery implements manifests, profile compilation/registration and live execution; it does not yet implement browser editing or draft activation.

Provider references include providerVersion; unknown manifest versions fail. Model binding is explicit: author-selected, or a fixed id that must match the requested model (never silently substituted). Registry format version and immutable scenario content version are distinct. Defaults live in the registry JSON. When retiring an implementation, explicitly retire affected live versions and retain their historical definitions outside the active registry.
