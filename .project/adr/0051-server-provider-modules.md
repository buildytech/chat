# ADR 0051: Server provider modules behind the neutral agent protocol

Accepted, 2026-11-16. Follow-up to the agent-system refactor.

packages/provider-xai is the first server-only provider package. It owns xAI HTTP serialization, decoding and adapter capabilities. The runtime binds credentials, endpoint, protection and deadline; chat-agent owns the loop and tool gates. Browser code cannot import provider packages (source gate plus browser:null export condition).

xaiCapabilities describes the adapter's implementation, not speculative model specifications: Chat Completions, no streaming implementation, fixed temperature, completion-token parameter, named-choice fallback policy and enabled/disabled/unknown model status. It reads the existing model catalog; account availability is still discovery's responsibility. Unsupported model/choice/token inputs fail before HTTP, without substitution.

The existing model catalog remains in chat-agent for the browser selector and host request mapping. Do not copy it into the adapter or introduce a reverse chat-agent -> provider-xai dependency. A later provider-manifest/profile boundary must remove that transitional ownership without a package cycle. This step does not claim that all xAI host configuration has already left chat-agent.

All packages remain private. No new endpoint, service, client credential storage, model activation or paid benchmark is introduced. The runtime generator resolves the new workspace package; ratchets/dead-code checks include its source and the browser import gate covers every provider package.
